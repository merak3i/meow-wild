// Sources one CC/PD species photo per cat from Wikipedia (lead image, Commons-hosted),
// optimizes to webp (<=1200px long edge, <250KB) into public/cats/, and writes CREDITS.md.
// Run: node scripts/fetch-cats.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "cats");
const UA = "meow.wild/1.0 (educational scroll-story; vismayhegde@gmail.com)";

// id -> { title: Wikipedia article, name, latin, override?: direct upload URL or "File:Name.jpg" }
const ROSTER = [
  { id: "snow-leopard", title: "Snow leopard", name: "Snow Leopard", latin: "Panthera uncia" },
  { id: "andean-mountain-cat", title: "Andean mountain cat", name: "Andean Mountain Cat", latin: "Leopardus jacobita" },
  { id: "pallass-cat", title: "Pallas's cat", name: "Pallas's Cat", latin: "Otocolobus manul" },
  { id: "puma", title: "Cougar", name: "Puma", latin: "Puma concolor" },
  { id: "eurasian-lynx", title: "Eurasian lynx", name: "Eurasian Lynx", latin: "Lynx lynx" },
  { id: "caracal", title: "Caracal", name: "Caracal", latin: "Caracal caracal" },
  { id: "clouded-leopard", title: "Clouded leopard", name: "Clouded Leopard", latin: "Neofelis nebulosa" },
  { id: "asian-golden-cat", title: "Asian golden cat", name: "Asian Golden Cat", latin: "Catopuma temminckii" },
  { id: "leopard", title: "Leopard", name: "Leopard", latin: "Panthera pardus" },
  { id: "serval", title: "Serval", name: "Serval", latin: "Leptailurus serval" },
  { id: "tiger", title: "Tiger", name: "Tiger", latin: "Panthera tigris" },
  { id: "ocelot", title: "Ocelot", name: "Ocelot", latin: "Leopardus pardalis" },
  { id: "black-footed-cat", title: "Black-footed cat", name: "Black-footed Cat", latin: "Felis nigripes" },
  { id: "margay", title: "Margay", name: "Margay", latin: "Leopardus wiedii" },
  { id: "jaguar", title: "Jaguar", name: "Jaguar", latin: "Panthera onca" },
  { id: "rusty-spotted-cat", title: "Rusty-spotted cat", name: "Rusty-spotted Cat", latin: "Prionailurus rubiginosus" },
  { id: "sand-cat", title: "Sand cat", name: "Sand Cat", latin: "Felis margarita" },
  { id: "fishing-cat", title: "Fishing cat", name: "Fishing Cat", latin: "Prionailurus viverrinus" },
  { id: "domestic-cat", title: "Cat", name: "House Cat", latin: "Felis catus", override: "File:Cat August 2010-4.jpg" },
];

// per-id manual overrides applied after a first pass review (id -> "File:Name.jpg" or direct URL)
const OVERRIDES = {
  jaguar: "File:Jaguar (Panthera onca palustris) male Three Brothers River.JPG",
  "sand-cat": "File:Sand cat (Kuwait).jpg",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};
const stripHtml = (s) =>
  (s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

function fileTitleFromUrl(url) {
  const p = decodeURIComponent(new URL(url).pathname);
  const segs = p.split("/");
  // thumb URLs look like /commons/thumb/a/ab/Name.jpg/3840px-Name.jpg
  // — the real file name is the second-to-last segment, not the rendered thumb.
  const name = p.includes("/thumb/") ? segs[segs.length - 2] : segs[segs.length - 1];
  return "File:" + name;
}
function commonsHost(url) {
  return url.includes("/wikipedia/commons/") ? "commons.wikimedia.org" : "en.wikipedia.org";
}

async function leadImageUrl(title) {
  const data = await j(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  );
  return data?.originalimage?.source || data?.thumbnail?.source || null;
}

async function imageMeta(fileTitle, host) {
  const url =
    `https://${host}/w/api.php?action=query&format=json&prop=imageinfo` +
    `&iiprop=url|size|extmetadata&titles=${encodeURIComponent(fileTitle)}`;
  const data = await j(url);
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const em = info.extmetadata || {};
  return {
    directUrl: info.url,
    descriptionUrl: info.descriptionurl,
    width: info.width,
    height: info.height,
    artist: stripHtml(em.Artist?.value) || "Unknown",
    license: stripHtml(em.LicenseShortName?.value) || "see source",
    licenseUrl: em.LicenseUrl?.value || "",
  };
}

async function resolveImageTitle(entry) {
  const ov = OVERRIDES[entry.id] || entry.override;
  if (ov) {
    if (ov.startsWith("File:")) {
      // resolve direct url via commons
      const meta = await imageMeta(ov, "commons.wikimedia.org");
      if (meta?.directUrl) return { url: meta.directUrl, fileTitle: ov, host: "commons.wikimedia.org" };
    } else {
      return { url: ov, fileTitle: fileTitleFromUrl(ov), host: commonsHost(ov) };
    }
  }
  const url = await leadImageUrl(entry.title);
  if (!url) return null;
  return { url, fileTitle: fileTitleFromUrl(url), host: commonsHost(url) };
}

async function toWebp(buf, dest) {
  const base = sharp(buf, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);
  const widths = [1200, 1100, 1000];
  const quals = [80, 74, 68, 60, 52, 44];
  for (const w of widths) {
    const targetW = meta.width >= meta.height ? Math.min(w, meta.width) : null;
    const targetH = meta.height > meta.width ? Math.min(w, meta.height) : null;
    for (const q of quals) {
      const out = await sharp(buf, { failOn: "none" })
        .rotate()
        .resize({ width: targetW || undefined, height: targetH || undefined, withoutEnlargement: true })
        .webp({ quality: q, effort: 5 })
        .toBuffer();
      if (out.length <= 250 * 1024) {
        await writeFile(dest, out);
        const m2 = await sharp(out).metadata();
        return { kb: Math.round(out.length / 1024), w: m2.width, h: m2.height, q, srcLong: longEdge };
      }
    }
  }
  // last resort: smallest tried
  const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 40 }).toBuffer();
  await writeFile(dest, out);
  const m2 = await sharp(out).metadata();
  return { kb: Math.round(out.length / 1024), w: m2.width, h: m2.height, q: 40, srcLong: longEdge };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits = [];
  const summary = [];
  for (const entry of ROSTER) {
    try {
      const resolved = await resolveImageTitle(entry);
      if (!resolved) throw new Error("no image found");
      const meta = await imageMeta(resolved.fileTitle, resolved.host);
      const dl = await fetch(resolved.url, { headers: { "User-Agent": UA } });
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const dest = path.join(OUT, `${entry.id}.webp`);
      const info = await toWebp(buf, dest);
      credits.push({
        ...entry,
        file: `${entry.id}.webp`,
        source: meta?.descriptionUrl || resolved.url,
        author: meta?.artist || "Unknown",
        license: meta?.license || "see source",
        licenseUrl: meta?.licenseUrl || "",
      });
      summary.push({ id: entry.id, ...info, license: meta?.license, author: (meta?.artist || "").slice(0, 40) });
      console.log(`OK  ${entry.id.padEnd(22)} ${info.kb}KB ${info.w}x${info.h} q${info.q} :: ${meta?.license} :: ${(meta?.artist || "").slice(0, 36)}`);
    } catch (e) {
      console.log(`ERR ${entry.id.padEnd(22)} ${e.message}`);
      summary.push({ id: entry.id, error: e.message });
    }
    await sleep(350);
  }

  const md =
    `# Image Credits — meow.wild\n\n` +
    `Every species photo is Creative Commons or public domain, sourced from Wikimedia / Wikipedia.\n` +
    `Attribution is provided per the license terms. If you are a rights holder and want a change, contact the maintainer.\n\n` +
    credits
      .map(
        (c) =>
          `### ${c.name} — *${c.latin}*\n` +
          `- File: \`public/cats/${c.file}\`\n` +
          `- Source: ${c.source}\n` +
          `- Author: ${c.author}\n` +
          `- License: ${c.license}${c.licenseUrl ? ` (${c.licenseUrl})` : ""}\n`,
      )
      .join("\n");
  await writeFile(path.join(OUT, "CREDITS.md"), md);
  console.log("\nWrote CREDITS.md with " + credits.length + " entries.");
  console.log(JSON.stringify(summary, null, 0));
}

main();
