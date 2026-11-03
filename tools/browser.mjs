import { chromium } from '@playwright/test';
import { readdir,access } from 'node:fs/promises';
import path from 'node:path';
export async function launchBrowser(){
  let executablePath=process.env.BOOK_BROWSER_PATH;
  if(!executablePath&&process.platform==='win32'&&process.env.LOCALAPPDATA){const root=path.join(process.env.LOCALAPPDATA,'ms-playwright');const folders=await readdir(root).catch(()=>[]);for(const dir of folders.filter(s=>/^chromium-/.test(s)).reverse()){const candidate=path.join(root,dir,'chrome-win64','chrome.exe');if(await access(candidate).then(()=>true,()=>false)){executablePath=candidate;break}}}
  return chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
}
