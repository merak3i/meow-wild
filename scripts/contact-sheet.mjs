import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "cats");
const ids = ["snow-leopard","andean-mountain-cat","pallass-cat","puma","eurasian-lynx","caracal","clouded-leopard","asian-golden-cat","leopard","serval","tiger","ocelot","black-footed-cat","margay","jaguar","rusty-spotted-cat","sand-cat","fishing-cat","domestic-cat"];
const cols=4, cw=360, ch=270, pad=6;
const rows=Math.ceil(ids.length/cols);
const W=cols*(cw+pad)+pad, H=rows*(ch+pad)+pad;
const base=sharp({create:{width:W,height:H,channels:3,background:"#222"}});
const comp=[];
for (let i=0;i<ids.length;i++){
  const cell=await sharp(path.join(OUT,ids[i]+".webp")).resize(cw,ch,{fit:"cover"}).toBuffer();
  const r=Math.floor(i/cols), c=i%cols;
  comp.push({input:cell,top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
}
await base.composite(comp).webp({quality:78}).toFile(path.join(__dirname,"..","contact-sheet.webp"));
console.log("done "+W+"x"+H);
