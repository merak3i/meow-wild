/**
 * Every recording on the page and where it came from. Each one was trimmed,
 * cleaned of hum and hiss, and levelled for this page. Edits of share-alike
 * recordings are shared under the same licence. BBC recordings are used under
 * the BBC's RemArc licence, which allows non-commercial use only.
 */
export interface SoundCredit {
  /** cat id, or "music", "walk", "beat" */
  id: string;
  /** shown instead of the cat's name for entries that are not a cat */
  label?: string;
  /** what you hear */
  what: string;
  author: string;
  /** the collection it came from */
  via: string;
  source: string;
  license: string;
  licenseUrl?: string;
}

const BY_3 = { license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0" };
const BY_4 = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0" };
const BY_NC_3 = { license: "CC BY-NC 3.0", licenseUrl: "https://creativecommons.org/licenses/by-nc/3.0" };
const BY_NC_SA_4 = { license: "CC BY-NC-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0" };
const BY_SA_3_DE = { license: "CC BY-SA 3.0 DE", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/" };
const CC0 = { license: "CC0 1.0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0" };
const REMARC = { license: "BBC RemArc licence", licenseUrl: "https://sound-effects.bbcrewind.co.uk/licensing" };

const TSA = "Animal Sound Archive, Museum für Naturkunde Berlin";
const TSA_URL = "https://suche.tierstimmenarchiv.de/";
const BBC = (id: string) => `https://sound-effects.bbcrewind.co.uk/search?q=${id}`;

export const SOUND_CREDITS: SoundCredit[] = [
  {
    id: "snow-leopard",
    what: "Snow Leopard Snuffles",
    author: "LA Zoo",
    via: "YouTube",
    source: "https://www.youtube.com/watch?v=VVKGo5ZDUC4",
    license: "CC BY",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
  },
  {
    id: "pallass-cat",
    what: "A male's hiss and spit (TSA:1881)",
    author: "Günter Tembrock",
    via: TSA,
    source: TSA_URL,
    ...BY_SA_3_DE,
  },
  {
    id: "puma",
    what: "Cameron Park, California, 2024",
    author: "Martin Mortensen",
    via: "iNaturalist",
    source: "https://www.inaturalist.org/sounds/1189983",
    ...BY_4,
  },
  {
    id: "eurasian-lynx",
    what: "One or two lynxes growling",
    author: "YleArkisto",
    via: "Freesound",
    source: "https://freesound.org/people/YleArkisto/sounds/243496/",
    ...BY_4,
  },
  {
    id: "caracal",
    what: "Caracal07",
    author: "druulian",
    via: "Freesound",
    source: "https://freesound.org/people/druulian/sounds/647637/",
    ...CC0,
  },
  {
    id: "clouded-leopard",
    what: "Call, London Zoo, 1937 (bbc.co.uk, © copyright 1937 BBC)",
    author: "Ludwig Koch",
    via: "BBC Sound Effects",
    source: BBC("NHU05102202"),
    ...REMARC,
  },
  {
    id: "asian-golden-cat",
    what: "A male's mews, Zoo Dresden, 1995",
    author: "Günter Tembrock",
    via: TSA,
    source: TSA_URL,
    ...BY_SA_3_DE,
  },
  {
    id: "leopard",
    what: "One recorded cough, repeated into a sawing call",
    author: "drobiumdesign",
    via: "Freesound",
    source: "https://freesound.org/people/drobiumdesign/sounds/346402/",
    ...BY_3,
  },
  {
    id: "serval",
    what: "Threat, Whipsnade Zoo, 1966 (bbc.co.uk, © copyright 1966 BBC)",
    author: "John Burton",
    via: "BBC Sound Effects",
    source: BBC("NHU05088111"),
    ...REMARC,
  },
  {
    id: "tiger",
    what: "tiger roar",
    author: "videog",
    via: "Freesound",
    source: "https://freesound.org/people/videog/sounds/149190/",
    ...BY_4,
  },
  {
    id: "ocelot",
    what: "A male's mews, Zoo Rostock, 1977",
    author: "Günter Tembrock",
    via: TSA,
    source: TSA_URL,
    ...BY_SA_3_DE,
  },
  {
    id: "margay",
    what: "Mother and kitten, Yucatán, 2021",
    author: "Juan Cruzado Cortés",
    via: "iNaturalist",
    source: "https://www.inaturalist.org/sounds/188740",
    ...BY_NC_SA_4,
  },
  {
    id: "jaguar",
    what: "Jaguar saw, Attica Zoological Park",
    author: "About Zoos",
    via: "Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Jaguar_saw.flac",
    ...BY_4,
  },
  {
    id: "sand-cat",
    what: "London Zoo, 1952 (bbc.co.uk, © copyright 1952 BBC)",
    author: "Eric Simms",
    via: "BBC Sound Effects",
    source: BBC("NHU05076184"),
    ...REMARC,
  },
  {
    id: "fishing-cat",
    what: "A hiss at the observer, Zoo Halle, 1965",
    author: "Günter Tembrock",
    via: TSA,
    source: TSA_URL,
    ...BY_SA_3_DE,
  },
  {
    id: "domestic-cat",
    what: "Whiskers' purr",
    author: "Adam Cuerden",
    via: "Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Whiskers%27_purr.ogg",
    license: "Public domain",
  },
  {
    id: "walk",
    label: "The walk",
    what: "Narration written by Vismay, voiced with ElevenLabs (Eleven v4, the Kiaan voice: calm, gentle audiobook narrator)",
    author: "Vismay Hegde (script) · ElevenLabs (voice)",
    via: "Meow Creative Haus",
    source: "https://meowcreativehaus.xyz",
    license: "© 2026 Meow Creative Haus",
  },
  {
    id: "beat",
    label: "Walk music",
    what: "A slow way down (2026), an ambient beat made for this page, every sound synthesised in code",
    author: "merak3i",
    via: "Meow Creative Haus",
    source: "https://meowcreativehaus.xyz",
    license: "© 2026 Meow Creative Haus",
  },
  {
    id: "music",
    label: "Music",
    what: "The Dark Glow of the Mountains (2009)",
    author: "Chris Zabriskie",
    via: "Internet Archive",
    source: "https://archive.org/details/The_Dark_Glow_of_the_Mountains-10049",
    ...BY_NC_3,
  },
];
