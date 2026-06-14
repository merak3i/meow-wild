// Sources one CC/PD habitat backdrop PER CAT (its real environment) from Wikimedia,
// optimizes to webp into public/scenes/<catId>.webp, writes HABITAT-CREDITS.md.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "scenes");
const UA = "meow.wild/1.0 (educational; vismayhegde@gmail.com)";

// id -> habitat search query (LANDSCAPE only, no animal). OVERRIDES wins.
const HABITATS = [
  { id: "snow-leopard", q: "Himalaya mountains snow" },
  { id: "andean-mountain-cat", q: "Andes altiplano landscape" },
  { id: "pallass-cat", q: "Mongolia steppe landscape" },
  { id: "puma", q: "Patagonia mountains landscape" },
  { id: "eurasian-lynx", q: "taiga forest snow" },
  { id: "caracal", q: "Karoo semi-desert scrub landscape" },
  { id: "clouded-leopard", q: "rainforest mist mountains" },
  { id: "asian-golden-cat", q: "Sikkim Himalaya forest landscape" },
  { id: "leopard", q: "savanna acacia Africa" },
  { id: "serval", q: "savanna grassland wetland" },
  { id: "tiger", q: "India sal forest landscape" },
  { id: "ocelot", q: "Amazon rainforest landscape" },
  { id: "black-footed-cat", q: "Karoo landscape South Africa" },
  { id: "margay", q: "rainforest canopy trees" },
  { id: "jaguar", q: "Pantanal wetland" },
  { id: "rusty-spotted-cat", q: "dry forest landscape Sri Lanka" },
  { id: "sand-cat", q: "desert sand dunes" },
  { id: "fishing-cat", q: "mangrove wetland landscape" },
  { id: "domestic-cat", q: "green rolling hills meadow sunset" },
];

// lock the genuinely good first-pass picks; the rest re-search
const OVERRIDES = {
  "clouded-leopard": "File:Mystic Layers of Agumbe.jpg",
  margay: "File:Taman Negara, Malaysia, Tall trees in canopy.jpg",
  jaguar: "File:Pantanal (54587786303).jpg",
  "sand-cat": "File:Little Sahara (26851345445).jpg",
  caracal: "File:Kruger National Park (ZA), Landschaft -- 2024 -- 0031.jpg",
  "asian-golden-cat": "File:Landscape of the mountains in Bhutan.jpg",
};

const JUNK = /peafowl|francolin|redstart|babbler|harrier|warbler|robin|thrush|finch|sparrow|bulbul|drongo|eagle|owl|hawk|kite|duck|heron|egret|stork|crane|\bbird\b|woman|women|\bman\b|\bmen\b|people|person|portrait|wedding|monkey|macaque|langur|deer|antelope|elephant|rhino|buffalo|zebra|giraffe|\blion\b|leopard|tiger|cheetah|snake|lizard|gecko|butterfly|moth|dragonfly|spider|beetle|frog|toad|turtle|crab|fish|insect|flower|fungi|mushroom|fire|smoke|satellite|nasa|modis|\bmap\b|diagram|chart|graph|stamp|coin|flag|logo|building|church|temple|mosque|\bcity\b|street|\bcar\b|boat|ship|museum/i;
const PREF = /landscape|view|valley|mountain|forest|desert|dune|wetland|marsh|savanna|grassland|steppe|park|scener|vista|panorama|hill|meadow|garden|lake|river|jungle|canyon|plateau|tundra|taiga|countryside|field|woodland|sunset|sunrise|moor|highland|altiplano|pantanal/i;

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
  return { url: i.url, page: i.descriptionurl, author: stripHtml(em.Artist?.value) || "Unknown", license: stripHtml(em.LicenseShortName?.value) || "see source", licenseUrl: em.LicenseUrl?.value || "" };
}

async function pick(h) {
  if (OVERRIDES[h.id]) return OVERRIDES[h.id];
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(h.q)}&prop=imageinfo&iiprop=url|size|extmetadata`;
  const d = await j(u);
  const cands = Object.values(d?.query?.pages || {})
    .map((p) => {
      const i = p.imageinfo?.[0];
      if (!i) return null;
      const lic = i.extmetadata?.LicenseShortName?.value || "?";
      return { title: p.title, w: i.width, h: i.height, lic, ratio: i.width / i.height };
    })
    .filter(Boolean)
    .filter((r) => /CC|Public/i.test(r.lic) && r.ratio >= 1.2 && r.ratio <= 2.7 && r.w >= 1500 && !/\.svg$/i.test(r.title) && !JUNK.test(r.title))
    .sort((a, b) => {
      const la = PREF.test(a.title) ? 1 : 0;
      const lb = PREF.test(b.title) ? 1 : 0;
      if (la !== lb) return lb - la;
      return b.w * b.h - a.w * a.h;
    });
  return cands[0]?.title;
}

async function toWebp(buf, dest) {
  for (const q of [68, 60, 52, 45, 38]) {
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();
    if (out.length <= 360 * 1024) {
      await writeFile(dest, out);
      const m = await sharp(out).metadata();
      return { kb: Math.round(out.length / 1024), w: m.width, h: m.height, q };
    }
  }
  const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600 }).webp({ quality: 38 }).toBuffer();
  await writeFile(dest, out);
  const m = await sharp(out).metadata();
  return { kb: Math.round(out.length / 1024), w: m.width, h: m.height, q: 38 };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits = [];
  for (const h of HABITATS) {
    try {
      const fileTitle = await pick(h);
      if (!fileTitle) throw new Error("no candidate");
      const m = await meta(fileTitle);
      const dl = await fetch(m.url, { headers: { "User-Agent": UA } });
      const buf = Buffer.from(await dl.arrayBuffer());
      const info = await toWebp(buf, path.join(OUT, `${h.id}.webp`));
      credits.push({ id: h.id, ...m, ...info, fileTitle });
      console.log(`OK ${h.id.padEnd(20)} ${info.kb}KB ${info.w}x${info.h} :: ${m.license} :: ${(m.author || "").slice(0, 26)} :: ${fileTitle.replace("File:", "").slice(0, 48)}`);
    } catch (e) {
      console.log(`ERR ${h.id.padEnd(20)} ${e.message}`);
    }
  }
  const md = `# Per-animal habitat backdrops — meow.wild\n\nLandscape backdrops (Creative Commons / public domain) chosen for each species' real habitat. From Wikimedia Commons.\n\n` +
    credits.map((c) => `### ${c.id}\n- File: public/scenes/${c.id}.webp\n- Source: ${c.page}\n- Author: ${c.author}\n- License: ${c.license}${c.licenseUrl ? ` (${c.licenseUrl})` : ""}\n`).join("\n");
  await writeFile(path.join(OUT, "HABITAT-CREDITS.md"), md);
  console.log("Wrote HABITAT-CREDITS.md (" + credits.length + ")");
}
main();
