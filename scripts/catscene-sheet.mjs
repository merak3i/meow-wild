import sharp from "sharp";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "public", "scenes");
const ids = ["snow-leopard","andean-mountain-cat","pallass-cat","puma","eurasian-lynx","caracal","clouded-leopard","asian-golden-cat","leopard","serval","tiger","ocelot","black-footed-cat","margay","jaguar","rusty-spotted-cat","sand-cat","fishing-cat","domestic-cat"];
const cw=470, ch=200, pad=4, cols=4;
const rows=Math.ceil(ids.length/cols);
const W=cols*(cw+pad)+pad, H=rows*(ch+pad)+pad;
const comp=[];
for (let i=0;i<ids.length;i++){
  const f=path.join(DIR,ids[i]+".webp");
  let cell;
  if (existsSync(f)) cell=await sharp(f).resize(cw,ch,{fit:"cover"}).toBuffer();
  else cell=await sharp({create:{width:cw,height:ch,channels:3,background:"#400"}}).webp().toBuffer();
  const r=Math.floor(i/cols), c=i%cols;
  comp.push({input:cell,top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
  comp.push({input:Buffer.from(`<svg width="${cw}" height="24"><text x="6" y="17" font-size="15" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-family="sans-serif">${ids[i]}</text></svg>`),top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
}
await sharp({create:{width:W,height:H,channels:3,background:"#222"}}).composite(comp).webp({quality:74}).toFile(path.join(__dirname,"..","catscene-sheet.webp"));
console.log("done");
