(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const INTRO_LEVEL = {
    id: '__intro_showcase__',
    pack: 'custom',
    name: 'Intro Showcase',
    par: 2,
    unlockStars: 0,
    map: [
      '#######',
      '#     #',
      '#@ $. #',
      '#     #',
      '#######'
    ]
  };

  const BEATS = [
    {
      title: 'Crate Expectations',
      subtitle: '500 verified 3D voxel puzzle dioramas — from warmups to grandmaster vaults.'
    },
    {
      title: 'Push Crates to Crystal Pads',
      subtitle: 'Plan every move carefully — crates can only be pushed, never pulled.'
    },
    {
      title: 'Beat Par for 3★ & Voxel Coins',
      subtitle: 'Unlock 3D themes, bot skins, crate styles, and 400 master puzzles.'
    }
  ];

  const bootStartMs =
    typeof global.__VS_BOOT_START === 'number'
      ? global.__VS_BOOT_START
      : (global.performance ? global.performance.now() : Date.now());

  let introActive = false;
  let introOrbiting = false;
  let introTimers = [];
  let restoreLevelIndex = 0;

  function byId(id) {
    return global.document ? global.document.getElementById(id) : null;
  }

  function nowMs() {
    return global.performance ? global.performance.now() : Date.now();
  }

  // --- Loading Screen Controller ---
  const Loader = {
    setProgress(percent, statusText) {
      const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
      const fill = byId('loader-progress-fill');
      const status = byId('loader-status');
      if (fill) fill.style.width = `${clamped}%`;
      if (status && typeof statusText === 'string') {
        status.textContent = statusText;
      }
    },

    showError(message) {
      const status = byId('loader-status');
      const retryBtn = byId('btn-loader-retry');
      if (status) {
        status.textContent = message || 'Failed to load 3D engine. Check your connection and retry.';
        status.style.color = '#fda4af';
      }
      if (retryBtn) {
        retryBtn.style.display = 'inline-flex';
        retryBtn.onclick = () => global.location.reload();
      }
    },

    finish(minDurationMs = 900) {
      Loader.setProgress(100, 'Ready!');
      const elapsed = nowMs() - bootStartMs;
      const waitMs = Math.max(0, minDurationMs - elapsed);

      return new Promise((resolve) => {
        const afterFrame = () => {
          global.setTimeout(() => {
            const screen = byId('screen-loader');
            if (screen) {
              screen.classList.add('loader-hidden');
              global.setTimeout(() => {
                screen.style.display = 'none';
              }, 380);
            }
            resolve();
          }, waitMs);
        };

        if (typeof global.requestAnimationFrame === 'function') {
          global.requestAnimationFrame(() => global.requestAnimationFrame(afterFrame));
        } else {
          afterFrame();
        }
      });
    }
  };

  // --- Live 3D Intro Choreography ---
  function clearIntroTimers() {
    for (let i = 0; i < introTimers.length; i++) {
      global.clearTimeout(introTimers[i]);
    }
    introTimers.length = 0;
  }

  function scheduleIntro(fn, delayMs) {
    const id = global.setTimeout(() => {
      if (!introActive) return;
      fn();
    }, delayMs);
    introTimers.push(id);
  }

  function setBeat(index, showCta) {
    const beat = BEATS[index] || BEATS[0];
    const titleEl = byId('intro-title');
    const subEl = byId('intro-subtitle');
    const cardEl = byId('intro-caption-card');
    const ctaBtn = byId('btn-intro-cta');
    const dotsWrap = byId('intro-dots');

    if (titleEl) titleEl.textContent = beat.title;
    if (subEl) subEl.textContent = beat.subtitle;

    if (dotsWrap) {
      const dots = dotsWrap.querySelectorAll('.intro-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === index);
      });
    }

    if (ctaBtn) {
      ctaBtn.classList.toggle('hidden', !showCta);
    }

    if (cardEl) {
      cardEl.classList.remove('intro-caption-pop');
      void cardEl.offsetWidth;
      cardEl.classList.add('intro-caption-pop');
    }
  }

  function buildIntroBoard() {
    const state = VS.Game.state;
    VS.Game.clearWinTimers();
    state.gridHeight = INTRO_LEVEL.map.length;
    state.gridWidth = Math.max(...INTRO_LEVEL.map.map((r) => r.length));
    state.walls.clear();
    state.floors.clear();
    state.goals.clear();
    state.crates = [];
    state.goalMeshes.clear();
    state.floorMeshes = [];
    state.history = [];
    state.moves = 0;
    state.pushes = 0;
    state.won = false;
    state.isAnimating = false;

    VS.Renderer.buildBoard(INTRO_LEVEL);
    VS.Game.updateCrateVisuals();

    // Start high & wide for cinematic fly-in
    const aspect = global.innerWidth / Math.max(global.innerHeight, 1);
    const targetDist = aspect < 0.85 ? 11.4 : 9.2;

    state.camAutoFollow = false;
    state.camLookX = 0;
    state.camLookZ = 0;
    state.camTargetX = 0;
    state.camTargetZ = 0;
    state.camYaw = -0.75;
    state.camPitch = 1.24;
    state.camDistance = 17.5;

    state.camTargetYaw = 0.36;
    state.camTargetPitch = 0.78;
    state.camTargetDistance = targetDist;
  }

  function demoStep(dx, dy) {
    const state = VS.Game.state;
    VS.Game.snapAnimations();

    state.player.targetYaw = Math.atan2(dx, dy);
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    const crate = VS.Game.getCrateAt(nx, ny);

    if (crate) {
      const cx = nx + dx;
      const cy = ny + dy;
      crate.animFrom = VS.Renderer.gridToWorld(crate.x, crate.y);
      crate.x = cx;
      crate.y = cy;
      crate.animTo = VS.Renderer.gridToWorld(cx, cy);
      crate.animT = 0;

      const destWorld = VS.Renderer.gridToWorld(cx, cy);
      const crateSkin = VS.Cosmetics ? VS.Cosmetics.getActiveCrateSkin() : null;
      const lockColor = crateSkin ? crateSkin.lockParticleColor : 0x34d399;
      const pushColor = crateSkin ? crateSkin.pushParticleColor : 0xfbbf24;

      if (state.goals.has(`${cx},${cy}`)) {
        if (VS.Sound) VS.Sound.playGoalLock();
        VS.Renderer.spawnParticles(destWorld.x, 0.5, destWorld.z, lockColor, 18, 0.1);
      } else {
        if (VS.Sound) VS.Sound.playPush();
        VS.Renderer.spawnParticles(destWorld.x, 0.15, destWorld.z, pushColor, 6, 0.05);
      }
    } else if (VS.Sound) {
      VS.Sound.playStep();
    }

    state.player.animFrom = VS.Renderer.gridToWorld(state.player.x, state.player.y);
    state.player.x = nx;
    state.player.y = ny;
    state.player.animTo = VS.Renderer.gridToWorld(nx, ny);
    state.player.animT = 0;
    state.isAnimating = true;

    VS.Game.updateCrateVisuals();
  }

  function play(options) {
    const opts = options || {};
    clearIntroTimers();

    restoreLevelIndex =
      typeof opts.restoreLevelIndex === 'number' ? opts.restoreLevelIndex : 0;

    introActive = true;
    introOrbiting = false;

    // Hide any open modals and HUD cleanly
    ['modal-menu', 'modal-settings', 'modal-levels', 'modal-shop', 'modal-win'].forEach((id) => {
      if (VS.UI) VS.UI.hideModal(id);
    });
    VS.Game.state.menuOpen = false;
    if (VS.Platform) VS.Platform.gameplayStop();

    if (global.document && global.document.body) {
      global.document.body.classList.add('intro-active');
    }

    buildIntroBoard();
    setBeat(0, false);

    const overlay = byId('intro-overlay');
    if (overlay) {
      overlay.classList.remove('modal-hidden');
    }

    // Beat 2: Bot approaches & pushes crate onto glowing pad
    scheduleIntro(() => {
      setBeat(1, false);
      demoStep(1, 0);
    }, 1450);

    scheduleIntro(() => {
      demoStep(1, 0);
    }, 2150);

    // Beat 3: Celebration particle burst + gentle orbit + Play CTA
    scheduleIntro(() => {
      introOrbiting = true;
      setBeat(2, true);
      const colors = [0x34d399, 0x38bdf8, 0xfbbf24, 0xf472b6];
      colors.forEach((col, i) => {
        scheduleIntro(() => {
          VS.Renderer.spawnParticles(0.5, 1.0, 0, col, 14, 0.14);
        }, i * 110);
      });
    }, 3050);

    // Auto-complete into Main Menu
    scheduleIntro(() => {
      finish();
    }, 5800);
  }

  function finish() {
    if (!introActive) return;
    clearIntroTimers();
    introActive = false;
    introOrbiting = false;

    const overlay = byId('intro-overlay');
    if (overlay) {
      overlay.classList.add('modal-hidden');
    }
    if (global.document && global.document.body) {
      global.document.body.classList.remove('intro-active');
    }

    if (VS.Storage) {
      VS.Storage.updateSetting('introSeen', true);
    }

    const state = VS.Game.state;
    state.camPitch = VS.CONFIG.CAMERA_DEFAULT_PITCH;
    state.camTargetPitch = VS.CONFIG.CAMERA_DEFAULT_PITCH;
    state.camYaw = VS.CONFIG.CAMERA_ISO_OFFSET;
    state.camTargetYaw = VS.CONFIG.CAMERA_ISO_OFFSET;

    VS.Game.loadLevel(restoreLevelIndex);
    if (VS.UI) {
      VS.UI.openMainMenu();
    }
  }

  function isActive() {
    return introActive;
  }

  function isOrbiting() {
    return introOrbiting;
  }

  VS.Loader = Loader;
  VS.Intro = {
    play,
    skip: finish,
    finish,
    isActive,
    isOrbiting
  };
})(window);
