import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const inventory=JSON.parse(await readFile('book_update/data/asset-inventory.json','utf8'));
const retouched=JSON.parse(await readFile('data/cat-eye-retouch.json','utf8').catch(()=>'[]'));
for(const item of inventory){
  const original=await readFile(item.file);
  const actual=createHash('sha256').update(original).digest('hex');
  const correction=retouched.find(r=>r.file===item.file&&r.beforeSha256===item.sha256);
  if(actual!==item.sha256&&actual!==correction?.afterSha256)throw new Error(`Checksum mismatch: ${item.file}`);
  await sharp(original).resize({width:1600,withoutEnlargement:true}).webp({quality:88,effort:5}).toFile(item.file.replace(/\.png$/,'.webp'));
}
console.log(`${inventory.length} PNG masters verified; WebP delivery copies prepared.`);
