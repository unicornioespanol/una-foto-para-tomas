import { defineConfig } from 'vite';
import {recordedAudioAssets} from './tools/audio-assets.mjs';
export default defineConfig({base:'/',plugins:[recordedAudioAssets()],server:{watch:{ignored:['**/backups/**','**/runtime/**','**/test-results/**','**/offline/**']},proxy:{'/api':'http://127.0.0.1:3000'}},build:{target:'es2020',rollupOptions:{input:{book:'index.html',admin:'admin.html',research:'research.html'}}}});
