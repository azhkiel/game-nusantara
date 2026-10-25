// 100% Procedural Web Audio API Sound Synthesizer for Nusantara Street 3D

class SoundManager {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  private lastEngineTick: number = 0;
  private lastSirenTick: number = 0;
  private sirenPhase: number = 0;

  // Continuous Ambient Rain Sound (Suara Latar Rintik Hujan)
  private isRainActive: boolean = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainMasterGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && this.isRainActive && !this.rainSource) {
      this.initRainLoop(this.ctx);
    }
    return this.ctx;
  }

  private initRainLoop(ctx: AudioContext) {
    if (this.rainSource) return;

    // Create a 3.5-second seamless stereo buffer with warm pink-noise rain wash + distinct raindrop patters ("rintik-rintik")
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 3.5);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let dropletEnv = 0;
      let dropletPhase = 0;
      let dropletFreq = 2200;

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        // Kellet's pink-noise filter approximation for natural rain wash
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        const pink = (b0 + b1 + b2 + white * 0.1848) * 0.08;

        // Random individual raindrop patters ("rintik hujan")
        if (dropletEnv <= 0.001 && Math.random() < 0.0028) {
          dropletEnv = 0.35 + Math.random() * 0.45;
          dropletFreq = 1650 + Math.random() * 1900;
          dropletPhase = 0;
        }

        let droplet = 0;
        if (dropletEnv > 0.001) {
          dropletPhase += (dropletFreq * Math.PI * 2) / sampleRate;
          droplet = (Math.sin(dropletPhase) * 0.5 + white * 0.5) * dropletEnv * 0.22;
          dropletEnv *= 0.992;
        }

        data[i] = pink + droplet;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Bandpass + Lowpass shaping for realistic outdoor rain on asphalt & foliage
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1850, ctx.currentTime);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(240, ctx.currentTime);

    const masterGain = ctx.createGain();
    const targetVol = this.isRainActive && !this.muted ? 0.22 : 0.0001;
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.3);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.start();
    this.rainSource = source;
    this.rainMasterGain = masterGain;
  }

  public setRainAmbience(active: boolean) {
    this.isRainActive = active;
    if (active && !this.muted) {
      const ctx = this.ensureContext();
      if (ctx) {
        if (!this.rainSource) {
          this.initRainLoop(ctx);
        } else if (this.rainMasterGain) {
          this.rainMasterGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.28);
        }
      }
    } else if (this.ctx && this.rainMasterGain) {
      this.rainMasterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    }
  }

  public setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (this.ctx && this.rainMasterGain) {
      const targetVol = this.isRainActive && !this.muted ? 0.22 : 0.0001;
      this.rainMasterGain.gain.setTargetAtTime(
        targetVol,
        this.ctx.currentTime,
        0.18
      );
    } else if (!this.muted && this.isRainActive) {
      this.setRainAmbience(true);
    }
  }

  public playTeloletHorn(isBusOrAngkot: boolean = true) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (isBusOrAngkot) {
      // Iconic Indonesian "Om Telolet Om!" 6-note horn melody
      const notes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        osc2.frequency.setValueAtTime(freq * 1.005, now + idx * 0.11);

        gain.gain.setValueAtTime(0.001, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.1);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.11);
        osc2.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.105);
        osc2.stop(now + idx * 0.11 + 0.105);
      });
    } else {
      // Crisp double-beep scooter/Bajaj horn "Tin-Tin!"
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now + offset);
        gain.gain.setValueAtTime(0.09, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.095);
      });
    }
  }

  public playEnginePulse(speedRatio: number, vehicleType: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    const interval = Math.max(45, 130 - Math.abs(speedRatio) * 85);
    if (nowMs - this.lastEngineTick < interval) return;
    this.lastEngineTick = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let baseFreq = 65;
    if (vehicleType === 'bajaj') {
      osc.type = 'sawtooth';
      baseFreq = 85 + Math.abs(speedRatio) * 110;
    } else if (vehicleType === 'ojol_motor') {
      osc.type = 'triangle';
      baseFreq = 105 + Math.abs(speedRatio) * 145;
    } else {
      osc.type = 'sine';
      baseFreq = 55 + Math.abs(speedRatio) * 95;
    }

    osc.frequency.setValueAtTime(baseFreq, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playSirenPulse(wantedStars: number) {
    if (wantedStars <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastSirenTick < 420) return;
    this.lastSirenTick = nowMs;
    this.sirenPhase = 1 - this.sirenPhase;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = this.sirenPhase === 0 ? 640 : 880;
    const endFreq = this.sirenPhase === 0 ? 880 : 640;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + 0.36);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.39);
  }

  public playCashReward() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [587.33, 880, 1174.66];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.24);
    });
  }

  public playInteractChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playImpactThud() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playThunderRumble() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(82, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }
}

export const soundFX = new SoundManager();

