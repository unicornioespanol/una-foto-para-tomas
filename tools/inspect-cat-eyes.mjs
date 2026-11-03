import sharp from 'sharp';import {readdir,writeFile,mkdir} from 'node:fs/promises';
await mkdir('test-results/cat-eyes',{recursive:true});
const files=[...(await readdir('assets/scenes')).filter(f=>f.endsWith('.png')).map(f=>'assets/scenes/'+f),...(await readdir('assets/references')).filter(f=>f.endsWith('.png')&&f!=='approved-style.png').map(f=>'assets/references/'+f),...(await readdir('assets/album')).filter(f=>f.endsWith('-gato.png')).map(f=>'assets/album/'+f),'assets/activities/memory-cat.png'];
const candidates=[];
for(const file of files){
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});const {width:w,height:h,channels:c}=info;const mask=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++){const r=data[i*c],g=data[i*c+1],b=data[i*c+2];if(r>140&&g>95&&g/r>.6&&(b<g*.8||r>190&&g>190&&b>150))mask[i]=1}
 for(let i=0;i<mask.length;i++)if(mask[i]){const todo=[i],pixels=[];mask[i]=0;let minX=w,minY=h,maxX=0,maxY=0;
  while(todo.length){const p=todo.pop(),x=p%w,y=Math.floor(p/w);pixels.push(p);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const n of [p-1,p+1,p-w,p+w])if(n>=0&&n<mask.length&&mask[n]){mask[n]=0;todo.push(n)}}
  const bw=maxX-minX+1,bh=maxY-minY+1;if(pixels.length<5||pixels.length>450||bw>29||bh>29)continue;
  let dark=0,total=0;for(let y=Math.max(0,minY-3);y<=Math.min(h-1,maxY+3);y++)for(let x=Math.max(0,minX-3);x<=Math.min(w-1,maxX+3);x++)if(x<minX||x>maxX||y<minY||y>maxY){const j=(y*w+x)*c;total++;if(data[j]<80&&data[j+1]<75&&data[j+2]<70)dark++}
  if(dark/total<.68)continue;
  const id=candidates.length;candidates.push({id,file,x:minX,y:minY,width:bw,height:bh,area:pixels.length});
 }
}
await writeFile('test-results/cat-eyes/candidates.json',JSON.stringify(candidates,null,2));
for(let batch=0;batch<Math.ceil(candidates.length/40);batch++){
 const items=candidates.slice(batch*40,batch*40+40),tiles=[];
 for(let k=0;k<items.length;k++){const e=items[k],m=await sharp(e.file).metadata();const left=Math.max(0,Math.min(m.width-60,e.x+e.width/2-30)|0),top=Math.max(0,Math.min(m.height-60,e.y+e.height/2-30)|0);const pic=await sharp(e.file).extract({left,top,width:60,height:60}).resize(180,180).png().toBuffer();const label=Buffer.from(`<svg width="200" height="32"><text x="5" y="21" font-size="12">${e.id}: ${e.file.split('/').at(-1)}</text></svg>`);tiles.push({input:pic,left:(k%5)*200+10,top:Math.floor(k/5)*220+30},{input:label,left:(k%5)*200,top:Math.floor(k/5)*220})}
 await sharp({create:{width:1000,height:Math.ceil(items.length/5)*220,channels:3,background:'#eee9dd'}}).composite(tiles).png().toFile(`test-results/cat-eyes/candidates-${batch}.png`);
}
console.log(`${candidates.length} candidate eye regions in ${files.length} cat-bearing/reference scenes; diagnostics only, no masters changed.`);
