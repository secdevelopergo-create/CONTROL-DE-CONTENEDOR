// Web Audio API synthesizer for operational warehouse feedback with clear acoustic differentiation

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    const saved = localStorage.getItem('sound_enabled');
    if (saved !== null) {
      this.enabled = saved === 'true';
    }
  }

  toggleSound(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('sound_enabled', String(this.enabled));
    return this.enabled;
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Normal scan success (+1, +N): Pleasant, crisp ascending chime
  playScanSuccess() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.08); // E6

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // 2. Reference COMPLETE (all packages accounted for): Celebratory 4-note major fanfare
  playItemComplete() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0 },    // C5
        { freq: 659.25, time: 0.06 }, // E5
        { freq: 783.99, time: 0.12 }, // G5
        { freq: 1046.5, time: 0.18 }, // C6
      ];

      notes.forEach((note) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        gain.gain.setValueAtTime(0.16, now + note.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + 0.24);
      });
    } catch {
      // Fallback
    }
  }

  // 3. SOBRANTE Warning (Attempting or registering more packages than expected):
  // Urgent harsh dual-pulse buzz
  playOverageWarning() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Pulse 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.linearRampToValueAtTime(160, now + 0.1);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Pulse 2 (urgent follow-up)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(260, now + 0.12);
      osc2.frequency.linearRampToValueAtTime(180, now + 0.24);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.25);
    } catch {
      // Fallback
    }
  }

  // 4. UNIDENTIFIED Reference (Reference not in Excel manifest):
  // Distinctive inquiring dissonant double-tone (alerts worker that item is unexpected)
  playUnidentifiedAlert() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(370, now); // F#4
      osc.frequency.setValueAtTime(466, now + 0.08); // A#4 (tritone / minor feel)

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Fallback
    }
  }

  // 5. UNDO operation: Soft descending tone
  playUndo() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.14);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Fallback
    }
  }
}

export const sounds = new SoundEffects();
