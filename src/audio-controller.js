/** One file player. No synthesis, autoplay, guessed timestamps or effects. */
export class AudioController {
  constructor({env=globalThis,onState=()=>{},onSegment=()=>{}}={}){
    this.env=env;this.onState=onState;this.onSegment=onSegment;
    this.available=typeof env.Audio==='function';this.state=this.available?'idle':'unsupported';
    this.source='file';this.rate=1;this.lang='es';this.generation=0;this.media=null;this.segments=[];this.descriptor=null;
  }
  setOptions(){/* Saved TTS preferences never alter the user's recordings. */}
  setState(state,detail=''){
    this.state=state;
    this.onState({state,detail,source:'file',rate:1,lang:this.lang,mediaToken:this.generation,position:this.media?.currentTime??0});
  }
  invalidate(){
    this.generation++;const old=this.media;this.media=null;
    if(old){old.pause();old.removeAttribute('src');old.load();}this.onSegment(null);
  }
  play(segments=[],audio=null){
    this.invalidate();this.segments=segments;this.descriptor=audio;
    if(!this.available){this.setState('unsupported');return false}
    if(!audio?.src){this.setState('missing');return false}
    const media=new this.env.Audio();this.media=media;media.preload='metadata';media.playbackRate=1;
    this.lang=audio.lang??'es';this.key=audio.key??null;
    const token=this.generation;const current=()=>token===this.generation&&this.media===media;
    media.addEventListener('playing',()=>{if(current())this.setState('speaking')});
    media.addEventListener('ended',()=>{if(current()){this.onSegment(null);this.setState('ended')}});
    media.addEventListener('pause',()=>{if(current()&&!media.ended&&this.state==='speaking')this.setState('paused')});
    media.addEventListener('error',()=>{if(current()){this.invalidate();this.setState('error','file-error')}});
    media.src=audio.src;this.setState('starting');this.start(media,token);return true;
  }
  start(media,token){
    const attempt=this.attempt=(this.attempt??0)+1;
    try{const promise=media.play();promise?.catch(error=>{if(this.media!==media||this.generation!==token||this.attempt!==attempt||this.state==='paused')return;this.invalidate();this.setState('error',error.name==='NotAllowedError'?'interaction-required':'file-error')})}
    catch{if(this.media===media&&this.generation===token){this.invalidate();this.setState('error','file-error')}}
  }
  pause(){if(this.media&&['starting','speaking'].includes(this.state)){this.attempt=(this.attempt??0)+1;this.media.pause();this.setState('paused')}}
  resume(){if(!this.media||this.state!=='paused')return false;this.setState('starting');this.start(this.media,this.generation);return true}
  stop(){this.invalidate();this.setState(this.available?'idle':'unsupported')}
  destroy(){this.stop()}
}
