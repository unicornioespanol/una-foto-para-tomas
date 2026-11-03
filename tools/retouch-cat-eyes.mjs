// User-requested, local raster correction. No image generation or CSS overlays.
import sharp from 'sharp';import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const regions={
 'assets/scenes/a05-desktop.png':[[806,653,14,13],[831,676,16,17]],
 'assets/scenes/a05-mobile.png':[[706,819,14,20]],
 'assets/scenes/a06-desktop.png':[[1102,739,4,13]],
 'assets/scenes/b05-desktop.png':[[1138,567,7,14]],
 'assets/scenes/b05-mobile.png':[[902,754,3,13],[930,760,5,15]]
};
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');const report=[];
for(const [file,eyes] of Object.entries(regions)){
 const backup='backups/before-final-audio/'+file;await mkdir(dirname(backup),{recursive:true});
 await copyFile(file,backup,1).catch(error=>{if(error.code!=='EEXIST')throw error});
 const original=await readFile(backup);const {data:before,info}=await sharp(original).raw().toBuffer({resolveWithObject:true});const data=Buffer.from(before);const {width,height,channels}=info;
 for(const [x,y,w,h] of eyes){
  const pixels=[];for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){const i=(py*width+px)*channels;const [r,g,b]=before.subarray(i,i+3);if(r>140&&g>95&&g/r>.6&&b<g*.8)pixels.push([px,py,i])}
  if(pixels.length<8)throw new Error(`Eye mask not verified: ${file}`);
  const cx=pixels.reduce((s,p)=>s+p[0],0)/pixels.length,cy=pixels.reduce((s,p)=>s+p[1],0)/pixels.length;
  let xx=0,yy=0,xy=0;for(const [px,py] of pixels){xx+=(px-cx)**2;yy+=(py-cy)**2;xy+=(px-cx)*(py-cy)}const angle=.5*Math.atan2(2*xy,xx-yy),cos=Math.cos(angle),sin=Math.sin(angle);
  const projected=pixels.map(([px,py])=>[(px-cx)*cos+(py-cy)*sin,-(px-cx)*sin+(py-cy)*cos]);
  const major=Math.max(1,...projected.map(p=>Math.abs(p[0]))),minor=Math.max(.8,...projected.map(p=>Math.abs(p[1])));
  pixels.forEach(([_px,_py,i],k)=>{const [u,v]=projected[k];const radius=(u/(major*.82))**2+(v/Math.max(.65,minor*.46))**2;const pupil=Math.max(0,Math.min(1,(1.2-radius)*3));for(let ch=0;ch<3;ch++){const iris=before[i+ch]*.65+[205,143,48][ch]*.35;data[i+ch]=Math.round(iris*(1-pupil*.96)+[25,22,18][ch]*pupil*.96)}});
 }
 let changed=0;for(let i=0;i<before.length;i+=channels)if(before[i]!==data[i]||before[i+1]!==data[i+1]||before[i+2]!==data[i+2]){const x=i/channels%width,y=Math.floor(i/channels/width);if(!eyes.some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h))throw new Error('Change outside iris');changed++}
 const result=await sharp(data,{raw:{width,height,channels}}).png().toBuffer();await writeFile(file,result);
 await copyFile(file.replace('.png','.webp'),backup.replace('.png','.webp'),1).catch(e=>{if(e.code!=='EEXIST')throw e});
 await sharp(result).resize({width:1600,withoutEnlargement:true}).webp({quality:88,effort:5}).toFile(file.replace('.png','.webp'));
 report.push({file,regions:eyes,changedPixels:changed,totalPixels:width*height,beforeSha256:hash(original),afterSha256:hash(result)});
 // A small before/after proof strip; the master stays at its exact resolution.
 const [x,y,w,h]=eyes[0],left=Math.max(0,x-18),top=Math.max(0,y-18),crop={left,top,width:Math.min(90,width-left),height:Math.min(75,height-top)};
 const a=await sharp(original).extract(crop).resize(360,300,{fit:'fill'}).png().toBuffer(),b=await sharp(result).extract(crop).resize(360,300,{fit:'fill'}).png().toBuffer();
 await sharp({create:{width:720,height:300,channels:3,background:'#efe8dc'}}).composite([{input:a,left:0,top:0},{input:b,left:360,top:0}]).png().toFile('test-results/cat-eyes/retouched-'+file.split('/').at(-1));
}
await writeFile('data/cat-eye-retouch.json',JSON.stringify(report,null,2)+'\n');console.log(report.map(r=>({file:r.file,changedPixels:r.changedPixels,percent:(r.changedPixels/r.totalPixels*100).toFixed(4)})));
