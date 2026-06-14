import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "public", "scenes");
const ids = ["snowline","alpine","cloud","montane","rainforest","floor"];
const cw=600, ch=240, pad=4, cols=2;
const rows=Math.ceil(ids.length/cols);
const W=cols*(cw+pad)+pad, H=rows*(ch+pad)+pad;
const comp=[];
for (let i=0;i<ids.length;i++){
  let cell;
  try { cell = await sharp(path.join(DIR,ids[i]+".webp")).resize(cw,ch,{fit:"cover"}).toBuffer(); }
  catch(e){ cell = await sharp({create:{width:cw,height:ch,channels:3,background:"#333"}}).webp().toBuffer(); }
  const r=Math.floor(i/cols), c=i%cols;
  comp.push({input:cell,top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
  comp.push({input:Buffer.from(`<svg width="${cw}" height="28"><text x="8" y="20" font-size="18" fill="white" stroke="black" stroke-width="0.5" font-family="sans-serif">${ids[i]}</text></svg>`),top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
}
await sharp({create:{width:W,height:H,channels:3,background:"#222"}}).composite(comp).webp({quality:78}).toFile(path.join(__dirname,"..","scene-sheet.webp"));
console.log("done");
