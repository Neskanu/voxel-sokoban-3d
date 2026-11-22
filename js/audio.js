(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.adMuted = false;
      this.platformMuted = false;
      this.initialized = false;
      this.stepSynth = null;
      this.pushSynth = null;
      this.chimeSynth = null;
    }

    syncMute() {
      if (this.initialized && typeof global.Tone !== 'undefined' && global.Tone.Destination) {
        global.Tone.Destination.mute = this.adMuted || this.platformMuted || !this.enabled;
      }
    }

    async unlock() {
      if (this.initialized || typeof global.Tone === 'undefined') return;
      try {
        await global.Tone.start();
        this.stepSynth = new global.Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 2,
          envelope: { attack: 0.004, decay: 0.08, sustain: 0, release: 0.05 }
        }).toDestination();
        this.stepSynth.volume.value = -14;

        this.pushSynth = new global.Tone.MembraneSynth({
          pitchDecay: 0.06,
          octaves: 3,
          envelope: { attack: 0.005, decay: 0.16, sustain: 0.02, release: 0.08 }
        }).toDestination();
        this.pushSynth.volume.value = -8;

        this.chimeSynth = new global.Tone.PolySynth(global.Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 }
        }).toDestination();
        this.chimeSynth.volume.value = -10;

        this.initialized = true;
        this.syncMute();
      } catch (err) {
        console.warn('Audio unlock deferred:', err);
      }
    }

    setEnabled(val) {
      this.enabled = Boolean(val);
      this.syncMute();
    }

    setAdMuted(val) {
      this.adMuted = Boolean(val);
      this.syncMute();
    }

    setPlatformMuted(val) {
      this.platformMuted = Boolean(val);
      this.syncMute();
    }

    isPlatformMuted() {
      return this.platformMuted;
    }

    isEnabled() {
      return this.enabled;
    }

    canPlay() {
      return this.enabled && !this.adMuted && !this.platformMuted && this.initialized;
    }

    playStep() {
      if (!this.canPlay()) return;
      try {
        this.stepSynth.triggerAttackRelease('C3', '32n');
      } catch (e) {}
    }

    playPush() {
      if (!this.canPlay()) return;
      try {
        this.pushSynth.triggerAttackRelease('G2', '16n');
      } catch (e) {}
    }

    playBump() {
      if (!this.canPlay()) return;
      try {
        this.stepSynth.triggerAttackRelease('E2', '32n');
      } catch (e) {}
    }

    playGoalLock() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        this.chimeSynth.triggerAttackRelease('E5', '16n', now);
        this.chimeSynth.triggerAttackRelease('G#5', '16n', now + 0.06);
        this.chimeSynth.triggerAttackRelease('B5', '8n', now + 0.12);
      } catch (e) {}
    }

    playUndo() {
      if (!this.canPlay()) return;
      try {
        this.chimeSynth.triggerAttackRelease('D4', '32n');
      } catch (e) {}
    }

    playCoin() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        this.chimeSynth.triggerAttackRelease('G5', '16n', now);
        this.chimeSynth.triggerAttackRelease('C6', '8n', now + 0.07);
      } catch (e) {}
    }

    playUnlock() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        ['E5', 'A5', 'C#6'].forEach((note, idx) => {
          this.chimeSynth.triggerAttackRelease(note, '8n', now + idx * 0.07);
        });
      } catch (e) {}
    }

    playWin() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        ['C5', 'E5', 'G5', 'C6'].forEach((note, idx) => {
          this.chimeSynth.triggerAttackRelease(note, '8n', now + idx * 0.09);
        });
      } catch (e) {}
    }
  }

  VS.Sound = new SoundEngine();
})(window);
