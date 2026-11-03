import {emitKeypressEvents} from 'node:readline';
import {stdin,stdout} from 'node:process';

export async function readSecret(prompt){
  if(!stdin.isTTY||!stdout.isTTY)throw new Error('Interactive terminal required; alternatively use --password-file with a private local file');
  stdout.write(prompt);emitKeypressEvents(stdin);const wasRaw=stdin.isRaw;stdin.setRawMode(true);stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function finish(error){stdin.off('keypress',onKey);stdin.setRawMode(Boolean(wasRaw));stdin.pause();stdout.write('\n');error?reject(error):resolve(value)}
    function onKey(text,key={}){
      if(key.ctrl&&key.name==='c')return finish(new Error('Cancelled'));
      if(key.name==='return'||key.name==='enter')return finish();
      if(key.name==='backspace'){value=value.slice(0,-1);return}
      if(!key.ctrl&&!key.meta&&text&&!/[\x00-\x1f\x7f]/.test(text))value+=text;
    }
    stdin.on('keypress',onKey);
  });
}
