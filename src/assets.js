import portraitDesktop from '../assets/references/scene02-desktop.png';
import portraitMobile from '../assets/references/scene02-mobile.png';
import choiceDesktop from '../assets/references/scene04-desktop.png';
import choiceMobile from '../assets/references/scene04-mobile.png';
import { el } from './dom.js';
import activityAssets from '../data/activity-assets.json';
export { activityAssets };
export { portraitDesktop };
const sceneFiles = import.meta.glob('../assets/scenes/**/*.webp', { eager: true, query: '?url', import: 'default' });
const albumFiles = import.meta.glob('../assets/album/*.webp', { eager: true, query: '?url', import: 'default' });
const activityFiles = import.meta.glob('../assets/activities/*.webp', { eager: true, query: '?url', import: 'default' });
function localAsset(path) { return path ? sceneFiles[`../${path.replace(/\.png$/,'.webp')}`] : null; }
export function activityArt(key,alt=''){
  const path=key.split('.').reduce((value,k)=>value?.[k],activityAssets);
  const img=el('img','activity-art');img.src=activityFiles[`../${path?.replace(/\.png$/,'.webp')}`]??localAsset(path)??'';img.alt=alt;img.decoding='async';return img;
}
export function albumArt(album) {
  const key=`../assets/album/${album.place}-${album.object}`;
  return albumFiles[`${key}.webp`] ?? albumFiles[`${key}.png`] ?? null;
}
export const images = { portrait: { desktop: portraitDesktop, mobile: portraitMobile }, choice: { desktop: choiceDesktop, mobile: choiceMobile } };
export const descriptions = {
  handover: 'La abuela entrega la foto de Tomás a Lucía.', portrait: 'Lucía mira el retrato de Tomás junto a su abuela y la ofrenda.',
  wind: 'El viento lleva la foto hacia el patio.', choice: 'Lucía tiene el marco vacío. La abuela muestra el patio y los lápices.',
  'cat-photo': 'Un gato negro está encima de la foto de Tomás.', ball: 'Lucía mueve una pelota y recupera la foto.',
  'cat-memory': 'En otra foto, Tomás tiene un gato en la cabeza.', 'drawing-start': 'Lucía dibuja a Tomás con gafas y un bigote enorme.',
  guitar: 'La abuela canta con una guitarra.', 'drawing-done': 'El dibujo de Tomás tiene una gran boca y una guitarra.',
  family: 'La familia se reúne alrededor de la ofrenda.', 'family-song': 'La familia canta y el gato sale al patio.', 'family-story': 'La familia escucha una historia de Tomás.'
};
export function sceneArt(scene, route, manifest) {
  const config = manifest?.scenes.find(s=>s.id === scene);
  const variant = config?.variants?.[route];
  const final = variant?.finalImages ?? config?.finalImages;
  const desktop = localAsset(final?.desktop);
  const sources = desktop ? { desktop, mobile: localAsset(final?.mobile) ?? desktop } : images[scene];
  const wrap = el('div', sources ? 'scene-art' : 'scene-art scene-pending');
  if(desktop) wrap.classList.add('scene-final');
  if (sources) {
    const picture = el('picture');
    const source = el('source'); source.media = '(max-width: 899px)'; source.srcset = sources.mobile;
    const img = el('img'); img.src = sources.desktop; img.width = 1672; img.height = 941; img.alt = descriptions[scene]; img.decoding = 'async';
    img.addEventListener('error', ()=> { wrap.replaceChildren(el('p','','Ilustración en preparación'), el('p','pending-description',descriptions[scene])); wrap.classList.add('scene-pending'); });
    picture.append(source,img); wrap.append(picture);
  } else {
    wrap.append(el('span','pending-mark','✳'), el('p','pending-label','Ilustración en preparación'), el('p','pending-description',descriptions[scene] ?? config?.id ?? ''));
  }
  if (route && ['family','family-song','family-story','drawing-done'].includes(scene)) {
    const slot = el('p','sr-only',route === 'photo' ? 'En la ofrenda: la foto de Tomás.' : 'En la ofrenda: el dibujo de Tomás con guitarra.');
    slot.dataset.slot = route === 'photo' ? 'photo-tomas' : 'drawing-tomas-guitar'; wrap.append(slot);
  }
  return wrap;
}
// Crops are viewports onto the approved raster, never recreated characters.
export const crops = {
  lucia: [1168,216,180,255], abuela: [800,16,230,250], tomas: [1044,259,145,162],
  flowers: [495,267,233,244], water: [812,439,54,65], bread: [639,437,120,67], photo: [1044,259,145,162],
  gato: [1438,597,185,252]
};
export function cropArt(id, label = '') {
  const mapping={lucia:'P1.characters.lucia',abuela:'P1.characters.abuela',tomas:'P1.portrait',flowers:'P2.flores',water:'P2.agua',bread:'P2.pan',photo:'P2.foto'};
  if(mapping[id])return activityArt(mapping[id],label);
  const [x,y,w,h] = crops[id];
  const wrap = el('span',`crop crop-${id}`); wrap.style.aspectRatio = `${w}/${h}`;
  const img = el('img'); img.src = portraitDesktop; img.alt = label; img.width = 1672; img.height = 941;
  Object.assign(img.style,{ width: `${1672/w*100}%`, left: `${-x/w*100}%`, top: `${-y/h*100}%` });
  wrap.append(img); return wrap;
}
