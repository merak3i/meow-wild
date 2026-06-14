import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "public", "cats");
const ids = ["snow-leopard","andean-mountain-cat","pallass-cat","puma","eurasian-lynx","caracal","clouded-leopard","asian-golden-cat","leopard","serval","tiger","ocelot","black-footed-cat","margay","jaguar","rusty-spotted-cat","sand-cat","fishing-cat","domestic-cat"];
const cols=4, cw=360, ch=300, pad=4;
const rows=Math.ceil(ids.length/cols);
const W=cols*(cw+pad)+pad, H=rows*(ch+pad)+pad;
const comp=[];
for (let i=0;i<ids.length;i++){
  const cell=await sharp(path.join(DIR,ids[i]+".webp")).resize(cw-20,ch-20,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}})
    .extend({top:10,bottom:10,left:10,right:10,background:{r:0,g:0,b:0,alpha:0}})
    .flatten({background:"#6f7d72"}).toBuffer();
  const r=Math.floor(i/cols), c=i%cols;
  comp.push({input:cell,top:pad+r*(ch+pad),left:pad+c*(cw+pad)});
}
await sharp({create:{width:W,height:H,channels:3,background:"#6f7d72"}}).composite(comp).webp({quality:80}).toFile(path.join(__dirname,"..","cut-sheet.webp"));
console.log("done "+W+"x"+H);
