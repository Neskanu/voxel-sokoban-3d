(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const BGM_TRACKS = [
    'assets/audio/bgm-1.mp3',
    'assets/audio/bgm-2.mp3'
  ];
  const BGM_VOLUME = 0.28;

  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.musicEnabled = true;
      this.adMuted = false;
      this.platformMuted = false;
      this.tabHidden = false;
      this.initialized = false;
      this.unlocked = false;

      this.stepSynth = null;
      this.pushSynth = null;
      this.slideSynth = null;
      this.chimeSynth = null;
      this.uiSynth = null;

      this.bgmEl = null;
      this.bgmIndex = 0;

      if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener('visibilitychange', () => {
          this.tabHidden = Boolean(global.document.hidden);
          this.syncMute();
        });
      }
    }

    initBgmElement() {
      if (this.bgmEl || typeof global.Audio === 'undefined') return;
      try {
        const audio = new global.Audio();
        audio.preload = 'none';
        audio.volume = BGM_VOLUME;
        audio.src = BGM_TRACKS[this.bgmIndex];
        audio.addEventListener('ended', () => {
          this.bgmIndex = (this.bgmIndex + 1) % BGM_TRACKS.length;
          audio.src = BGM_TRACKS[this.bgmIndex];
          if (this.shouldPlayMusic()) {
            const p = audio.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        });
        this.bgmEl = audio;
      } catch (e) {
        this.bgmEl = null;
      }
    }

    shouldPlayMusic() {
      return this.unlocked && this.musicEnabled && !this.adMuted && !this.platformMuted && !this.tabHidden;
    }

    syncMusic() {
      if (!this.bgmEl) return;
      this.bgmEl.muted = this.adMuted || this.platformMuted || !this.musicEnabled;
      this.bgmEl.volume = BGM_VOLUME;
      if (this.shouldPlayMusic()) {
        if (this.bgmEl.paused) {
          const p = this.bgmEl.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      } else if (!this.bgmEl.paused) {
        try {
          this.bgmEl.pause();
        } catch (e) {}
      }
    }

    resumeContextIfNeeded() {
      if (
        this.initialized &&
        this.unlocked &&
        !this.adMuted &&
        !this.platformMuted &&
        !this.tabHidden &&
        global.Tone &&
        global.Tone.context &&
        global.Tone.context.state !== 'running' &&
        typeof global.Tone.context.resume === 'function'
      ) {
        try {
          const p = global.Tone.context.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
    }

    syncMute() {
      if (this.initialized && typeof global.Tone !== 'undefined' && global.Tone.Destination) {
        global.Tone.Destination.mute = this.adMuted || this.platformMuted || this.tabHidden || !this.enabled;
      }
      this.resumeContextIfNeeded();
      this.syncMusic();
    }

    async unlock() {
      this.unlocked = true;
      this.initBgmElement();
      this.resumeContextIfNeeded();
      this.syncMusic();

      if (this.initialized || typeof global.Tone === 'undefined') return;
      try {
        await global.Tone.start();
        this.stepSynth = new global.Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 2,
          envelope: { attack: 0.004, decay: 0.075, sustain: 0, release: 0.05 }
        }).toDestination();
        this.stepSynth.volume.value = -15;

        this.pushSynth = new global.Tone.MembraneSynth({
          pitchDecay: 0.06,
          octaves: 3,
          envelope: { attack: 0.005, decay: 0.16, sustain: 0.02, release: 0.08 }
        }).toDestination();
        this.pushSynth.volume.value = -9;

        const slideFilter = new global.Tone.Filter(900, 'bandpass').toDestination();
        this.slideSynth = new global.Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.006, decay: 0.09, sustain: 0, release: 0.04 }
        }).connect(slideFilter);
        this.slideSynth.volume.value = -19;

        this.chimeSynth = new global.Tone.PolySynth(global.Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 }
        }).toDestination();
        this.chimeSynth.volume.value = -10;

        this.uiSynth = new global.Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.003, decay: 0.045, sustain: 0, release: 0.03 }
        }).toDestination();
        this.uiSynth.volume.value = -18;

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

    setMusicEnabled(val) {
      this.musicEnabled = Boolean(val);
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

    isMusicEnabled() {
      return this.musicEnabled;
    }

    isAnyAudioEnabled() {
      return this.enabled || this.musicEnabled;
    }

    canPlay() {
      return this.enabled && !this.adMuted && !this.platformMuted && !this.tabHidden && this.initialized;
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
        if (this.slideSynth) {
          this.slideSynth.triggerAttackRelease('16n');
        }
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
        this.chimeSynth.triggerAttackRelease('G#5', '16n', now + 0.055);
        this.chimeSynth.triggerAttackRelease('B5', '8n', now + 0.11);
      } catch (e) {}
    }

    playUndo() {
      if (!this.canPlay()) return;
      try {
        this.chimeSynth.triggerAttackRelease('D4', '32n');
      } catch (e) {}
    }

    playClick() {
      if (!this.canPlay() || !this.uiSynth) return;
      try {
        this.uiSynth.triggerAttackRelease('A5', '64n');
      } catch (e) {}
    }

    playDeadlock() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        this.chimeSynth.triggerAttackRelease('F3', '16n', now);
        this.chimeSynth.triggerAttackRelease('D#3', '8n', now + 0.09);
      } catch (e) {}
    }

    playHint() {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        this.chimeSynth.triggerAttackRelease('A5', '16n', now);
        this.chimeSynth.triggerAttackRelease('E6', '8n', now + 0.07);
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
        ['C5', 'E5', 'G5', 'B5', 'C6'].forEach((note, idx) => {
          this.chimeSynth.triggerAttackRelease(note, '8n', now + idx * 0.08);
        });
      } catch (e) {}
    }

    playStarPop(starNumber) {
      if (!this.canPlay() || typeof global.Tone === 'undefined') return;
      try {
        const now = global.Tone.now();
        if (starNumber === 1) {
          this.chimeSynth.triggerAttackRelease('E5', '16n', now);
        } else if (starNumber === 2) {
          this.chimeSynth.triggerAttackRelease('G#5', '16n', now);
        } else {
          this.chimeSynth.triggerAttackRelease('B5', '16n', now);
          this.chimeSynth.triggerAttackRelease('E6', '8n', now + 0.05);
        }
      } catch (e) {}
    }
  }

  VS.Sound = new SoundEngine();
})(window);
