// Web Audio API Synthesizer for retro/playful game sounds

class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private flightNoiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private flightFilterNode: BiquadFilterNode | null = null;
  private flightGainNode: GainNode | null = null;

  constructor() {
    // Context is initialized lazily on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    // Resume context if suspended (browser security)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted && this.flightGainNode) {
      this.flightGainNode.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.1);
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  // Play a simple button click sound
  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Play a "stretched slingshot" tension sound
  public playTension(forceRatio: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Frequency increases as tension/force grows
    const freq = 100 + forceRatio * 180;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq + 5, t + 0.05);

    // Add slight tremolo
    gain.gain.setValueAtTime(0.04 * forceRatio, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Play launch swoosh
  public playLaunch(isNaan: boolean) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = isNaan ? 0.35 : 0.25;

    // Create noise source
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    
    // Sweep frequency up then down rapidly
    if (isNaan) {
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
      filter.frequency.exponentialRampToValueAtTime(300, t + duration);
      filter.Q.setValueAtTime(3.0, t);
    } else {
      // Baguette: sharper, faster whoosh
      filter.frequency.setValueAtTime(150, t);
      filter.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
      filter.frequency.exponentialRampToValueAtTime(400, t + duration);
      filter.Q.setValueAtTime(5.0, t);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // Continuous flight sound, parameters modulated by speed and height
  public startFlightLoop(type: 'naan' | 'baguette') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopFlightLoop();

    const t = this.ctx.currentTime;

    // Create white noise source buffer
    const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds loopable
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(type === 'naan' ? 2.5 : 4.0, t);
    filter.frequency.setValueAtTime(type === 'naan' ? 400 : 600, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.2); // fade in

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);

    this.flightNoiseNode = noise as any;
    this.flightFilterNode = filter;
    this.flightGainNode = gain;
  }

  // Update flight loops based on real-time speed
  public updateFlightLoop(speed: number, maxSpeed: number) {
    if (this.isMuted || !this.ctx || !this.flightFilterNode || !this.flightGainNode) return;

    const t = this.ctx.currentTime;
    const ratio = Math.max(0.1, Math.min(1.5, speed / (maxSpeed || 1)));

    // Modulate bandpass frequency with speed
    const baseFreq = 400;
    const targetFreq = baseFreq + ratio * 600;
    this.flightFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.1);

    // Modulate gain with speed
    const targetGain = 0.02 + ratio * 0.08;
    this.flightGainNode.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  public stopFlightLoop() {
    const t = this.ctx?.currentTime || 0;
    
    if (this.flightGainNode && this.ctx) {
      const gNode = this.flightGainNode;
      gNode.gain.setTargetAtTime(0, t, 0.05); // quick fade out
    }
    
    setTimeout(() => {
      if (this.flightNoiseNode) {
        try {
          (this.flightNoiseNode as any).stop();
          (this.flightNoiseNode as any).disconnect();
        } catch(e) {}
        this.flightNoiseNode = null;
      }
      if (this.flightFilterNode) {
        this.flightFilterNode.disconnect();
        this.flightFilterNode = null;
      }
      if (this.flightGainNode) {
        this.flightGainNode.disconnect();
        this.flightGainNode = null;
      }
    }, 100);
  }

  // Play impact sound (landing)
  public playHit(type: 'naan' | 'baguette') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopFlightLoop();

    const t = this.ctx.currentTime;

    // Sub-bass thud (sine sweep)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(type === 'naan' ? 90 : 130, t);
    subOsc.frequency.exponentialRampToValueAtTime(10, t + 0.3);

    subGain.gain.setValueAtTime(0.3, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.3);

    // Crunchy sound (lowpass noise)
    const duration = type === 'naan' ? 0.2 : 0.4; // Baguette sticks and cracks, Naan flops
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'naan' ? 200 : 350, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(type === 'naan' ? 0.15 : 0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // Success fanfare (arpeggio)
  public playSuccess() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + idx * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.3);
    });
  }
}

export const audioManager = new AudioManager();
