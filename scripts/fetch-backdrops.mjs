// Sources one CC/PD ultra-realistic landscape backdrop per biome from Wikimedia,
// optimizes to webp into public/scenes/, writes public/scenes/CREDITS.md.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "scenes");
const UA = "meow.wild/1.0 (educational; vismayhegde@gmail.com)";

// biome -> search query; OVERRIDES wins (File:Name.jpg)
const BIOMES = [
  { id: "snowline", q: "Himalaya snow peaks panorama" },
  { id: "alpine", q: "alpine mountain meadow tundra landscape" },
  { id: "cloud", q: "cloud forest fog tropical mountain" },
  { id: "montane", q: "green forested mountains landscape" },
  { id: "rainforest", q: "tropical rainforest canopy mist green" },
  { id: "floor", q: "savanna acacia sunset Africa landscape" },
];
const OVERRIDES = {
  snowline: "File:Panorama of Himalayas from Ranikhet, Uttarakhand, India.jpg",
  montane: "File:Sunset Divide.jpg",
  cloud: "File:Malasari kabut.jpg",
  rainforest: "File:Lush green foliage over tropical forest and karst hills in Surat Thani, Thailand.jpg",
  floor: "File:004 Sunrise at Serengeti National Park Photo by Giles Laurent.jpg",
};

const j = async (u) => {
  const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};
const stripHtml = (s) => (s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function meta(fileTitle) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&titles=${encodeURIComponent(fileTitle)}`;
  const d = await j(u);
  const p = Object.values(d?.query?.pages || {})[0];
  const i = p?.imageinfo?.[0];
  if (!i) return null;
  const em = i.extmetadata || {};
  return { url: i.url, page: i.descriptionurl, w: i.width, h: i.height, author: stripHtml(em.Artist?.value) || "Unknown", license: stripHtml(em.LicenseShortName?.value) || "see source", licenseUrl: em.LicenseUrl?.value || "" };
}

async function pick(biome) {
  if (OVERRIDES[biome.id]) return OVERRIDES[biome.id];
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(biome.q)}&prop=imageinfo&iiprop=url|size|extmetadata`;
  const d = await j(u);
  const cands = Object.values(d?.query?.pages || {})
    .map((p) => {
      const i = p.imageinfo?.[0];
      if (!i) return null;
      const lic = i.extmetadata?.LicenseShortName?.value || "?";
      return { title: p.title, w: i.width, h: i.height, lic, ratio: i.width / i.height };
    })
    .filter(Boolean)
    .filter((r) => /CC|Public/i.test(r.lic) && r.ratio >= 1.2 && r.ratio <= 2.8 && r.w >= 2000)
    .sort((a, b) => b.w * b.h - a.w * a.h);
  return cands[0]?.title;
}

async function toWebp(buf, dest) {
  for (const q of [70, 62, 55, 48, 42, 36]) {
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();
    if (out.length <= 380 * 1024) {
      await writeFile(dest, out);
      const m = await sharp(out).metadata();
      return { kb: Math.round(out.length / 1024), w: m.width, h: m.height, q };
    }
  }
  const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600 }).webp({ quality: 36 }).toBuffer();
  await writeFile(dest, out);
  const m = await sharp(out).metadata();
  return { kb: Math.round(out.length / 1024), w: m.width, h: m.height, q: 36 };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits = [];
  for (const b of BIOMES) {
    try {
      const fileTitle = await pick(b);
      if (!fileTitle) throw new Error("no candidate");
      const m = await meta(fileTitle);
      const dl = await fetch(m.url, { headers: { "User-Agent": UA } });
      const buf = Buffer.from(await dl.arrayBuffer());
      const info = await toWebp(buf, path.join(OUT, `${b.id}.webp`));
      credits.push({ id: b.id, ...m, ...info, fileTitle });
      console.log(`OK ${b.id.padEnd(11)} ${info.kb}KB ${info.w}x${info.h} q${info.q} :: ${m.license} :: ${(m.author || "").slice(0, 32)} :: ${fileTitle.replace("File:", "")}`);
    } catch (e) {
      console.log(`ERR ${b.id} ${e.message}`);
    }
  }
  const md = `# Backdrop Credits — meow.wild scenes\n\nLandscape backdrops, Creative Commons / public domain, from Wikimedia Commons.\n\n` +
    credits.map((c) => `### ${c.id}\n- File: public/scenes/${c.id}.webp\n- Source: ${c.page}\n- Author: ${c.author}\n- License: ${c.license}${c.licenseUrl ? ` (${c.licenseUrl})` : ""}\n`).join("\n");
  await writeFile(path.join(OUT, "CREDITS.md"), md);
  console.log("Wrote scenes/CREDITS.md");
}
main();
