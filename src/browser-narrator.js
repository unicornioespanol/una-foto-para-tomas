/** Web Speech adapter. Call play/resume directly in a click/key handler. */
export class BrowserNarrator {
  constructor({ env = globalThis, onState = () => {}, onSegment = () => {} } = {}) {
    this.env = env;
    this.synth = env.speechSynthesis;
    this.onState = onState;
    this.onSegment = onSegment;
    this.available = Boolean(this.synth && env.SpeechSynthesisUtterance);
    this.rate = .9;
    this.preferredVoiceURI = null;
    this.lang = 'es-MX';
    this.segments = [];
    this.index = 0;
    this.generation = 0;
    this.state = this.available ? 'idle' : 'unsupported';
    this.voices = [];
    this.voiceListener = () => this.refreshVoices();
    this.synth?.addEventListener?.('voiceschanged', this.voiceListener);
    this.refreshVoices();
  }
  refreshVoices() {
    this.voices = this.synth?.getVoices?.() ?? [];
    return this.voices.filter(v => /^es(?:[-_]|$)/i.test(v.lang));
  }
  chooseVoice() {
    const voices = this.refreshVoices();
    return voices.find(v => v.voiceURI === this.preferredVoiceURI)
      ?? voices.find(v => /^es[-_]MX$/i.test(v.lang))
      ?? voices.find(v => /^es[-_]ES$/i.test(v.lang))
      ?? voices[0] ?? null;
  }
  setOptions({ rate = this.rate, voiceURI = this.preferredVoiceURI } = {}) {
    this.rate = Math.min(1.1, Math.max(.75, Number(rate) || .9));
    this.preferredVoiceURI = voiceURI;
  }
  setState(state, detail = '') {
    this.state = state;
    this.onState({ state, detail, index: this.index });
  }
  clearWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = undefined;
  }
  invalidate() {
    this.generation += 1;
    this.clearWatchdog();
    this.synth?.cancel();
    this.currentUtterance = null;
  }
  play(segments) {
    this.invalidate();
    this.segments = segments.filter(s => (s.speechText ?? s.text ?? '').trim());
    this.index = 0;
    if (!this.available) { this.setState('unsupported'); return false; }
    this.voice = this.chooseVoice();
    if (!this.voice) { this.setState('voice-unavailable'); return false; }
    return this.speakCurrent();
  }
  speakCurrent() {
    if (this.index >= this.segments.length) {
      this.currentUtterance = null;
      this.onSegment(null);
      this.setState('ended');
      return true;
    }
    const token = this.generation;
    const segment = this.segments[this.index];
    const utterance = new this.env.SpeechSynthesisUtterance(segment.speechText ?? segment.text);
    utterance.voice = this.voice;
    utterance.lang = this.voice.lang || this.lang;
    utterance.rate = this.rate;
    utterance.pitch = 1;
    this.currentUtterance = utterance; // Retain a strong reference until end/cancel.
    this.setState('starting');
    utterance.onstart = () => {
      if (token !== this.generation || this.currentUtterance !== utterance) return;
      this.clearWatchdog();
      this.onSegment(segment.id);
      this.setState('speaking');
    };
    utterance.onend = () => {
      if (token !== this.generation || this.currentUtterance !== utterance) return;
      this.clearWatchdog();
      this.index += 1;
      this.speakCurrent();
    };
    utterance.onerror = event => {
      if (token !== this.generation || this.currentUtterance !== utterance) return;
      this.invalidate();
      this.onSegment(null);
      this.setState('error', event.error || 'speech-error');
    };
    this.watchdog = setTimeout(() => {
      if (token !== this.generation) return;
      this.invalidate();
      this.onSegment(null);
      this.setState('error', 'start-timeout');
    }, 10000);
    try { this.synth.speak(utterance); }
    catch (error) {
      this.invalidate();
      this.onSegment(null);
      this.setState('error', error.message);
      return false;
    }
    return true;
  }
  pause() {
    if (!['starting', 'speaking'].includes(this.state)) return;
    this.invalidate();
    this.onSegment(null);
    this.setState('paused');
  }
  resume() {
    if (this.state !== 'paused') return false;
    this.voice = this.chooseVoice();
    if (!this.voice) { this.setState('voice-unavailable'); return false; }
    // Intentionally restarts the current phrase, not an unreliable word offset.
    return this.speakCurrent();
  }
  stop() {
    this.invalidate();
    this.onSegment(null);
    this.setState(this.available ? 'idle' : 'unsupported');
  }
  destroy() {
    this.stop();
    this.synth?.removeEventListener?.('voiceschanged', this.voiceListener);
  }
}
