(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  function byId(id) {
    return global.document.getElementById(id);
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable);
  }

  function setupPointerAndCanvasControls(dom) {
    if (!dom) return;

    // --- Touch Swipe-to-Pan, Tap-to-Move & Pinch-to-Zoom ---
    let prevTouchX = 0;
    let prevTouchY = 0;
    let touchDragDist = 0;
    let touchWasPinch = false;
    let pinchStartDist = 0;
    let pinchStartCamDist = 12;

    dom.addEventListener('touchstart', (e) => {
      VS.Sound.unlock();
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartCamDist = VS.Game.state.camDistance;
        touchWasPinch = true;
        return;
      }
      if (e.touches.length !== 1) return;
      prevTouchX = e.touches[0].clientX;
      prevTouchY = e.touches[0].clientY;
      touchDragDist = 0;
      touchWasPinch = false;
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = pinchStartDist / Math.max(dist, 10);
        VS.Renderer.setCameraDistance(pinchStartCamDist * scale);
        return;
      }
      if (e.touches.length !== 1 || touchWasPinch) return;

      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const dx = curX - prevTouchX;
      const dy = curY - prevTouchY;
      touchDragDist += Math.hypot(dx, dy);

      if (touchDragDist > 6) {
        VS.Renderer.panByScreenDelta(dx, dy);
      }

      prevTouchX = curX;
      prevTouchY = curY;
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      if (!touchWasPinch && touchDragDist <= 10 && e.changedTouches.length === 1) {
        VS.Game.handleTapTile(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    }, { passive: true });

    // --- Mouse Drag (Left: Orbit, Right/Middle/Shift: Pan) & Click-to-Move ---
    let isDragging = false;
    let isPanningMouse = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let dragDistance = 0;

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('mousedown', (e) => {
      VS.Sound.unlock();
      isDragging = true;
      isPanningMouse = e.button === 2 || e.button === 1 || e.shiftKey;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      dragDistance = 0;
    });

    global.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      dragDistance += Math.hypot(dx, dy);

      if (isPanningMouse) {
        VS.Renderer.panByScreenDelta(dx, dy);
      } else {
        VS.Renderer.orbitByDelta(dx, dy);
      }

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    global.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      const wasLeftClick = !isPanningMouse;
      isDragging = false;
      isPanningMouse = false;
      if (wasLeftClick && dragDistance < 8) {
        VS.Game.handleTapTile(e.clientX, e.clientY);
      }
    });

    dom.addEventListener('wheel', (e) => {
      VS.Renderer.zoomByDelta(e.deltaY);
    }, { passive: true });
  }

  function setupKeyboardControls() {
    global.addEventListener('keydown', (e) => {
      if (VS.Intro && VS.Intro.isActive()) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          VS.Intro.skip();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (VS.UI.closeTopModal()) {
          e.preventDefault();
        }
        return;
      }

      if (isEditableTarget(e.target) || VS.Game.state.menuOpen || VS.UI.isAnyModalOpen()) {
        return;
      }

      const key = e.key.toLowerCase();
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // Support Ctrl+Z / Cmd+Z for undo while letting all other browser shortcuts (Ctrl+R, Ctrl+W, etc.) pass through
      if (hasModifier) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'z') {
          e.preventDefault();
          VS.Game.undoMove();
        }
        return;
      }

      if (e.repeat && (key === 'z' || key === 'r')) return;

      if (key === 'arrowup' || key === 'w') {
        if (key === 'arrowup') e.preventDefault();
        const [gx, gy] = VS.Game.screenDirToGrid('up');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowdown' || key === 's') {
        if (key === 'arrowdown') e.preventDefault();
        const [gx, gy] = VS.Game.screenDirToGrid('down');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowleft' || key === 'a') {
        if (key === 'arrowleft') e.preventDefault();
        const [gx, gy] = VS.Game.screenDirToGrid('left');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowright' || key === 'd') {
        if (key === 'arrowright') e.preventDefault();
        const [gx, gy] = VS.Game.screenDirToGrid('right');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'z' || key === 'backspace') {
        if (key === 'backspace') e.preventDefault();
        VS.Game.undoMove();
      } else if (key === 'r') {
        VS.Game.loadLevel(VS.Game.state.levelIndex);
      } else if (key === 'q') {
        VS.Game.state.camTargetYaw -= Math.PI / 2;
      } else if (key === 'e') {
        VS.Game.state.camTargetYaw += Math.PI / 2;
      }
    });
  }

  function setupButtonControls() {
    // --- On-Screen D-Pad ---
    global.document.querySelectorAll('.dpad-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        global.setTimeout(() => btn.classList.remove('pressed'), 110);
        const [gx, gy] = VS.Game.screenDirToGrid(btn.dataset.dir);
        VS.Game.attemptMove(gx, gy);
      });
    });

    // --- Bottom Actions ---
    byId('btn-undo').addEventListener('click', () => VS.Game.undoMove());

    byId('btn-reset').addEventListener('click', () => {
      if (VS.Game.state.menuOpen || VS.UI.isAnyModalOpen()) return;
      VS.Sound.unlock();
      VS.Game.loadLevel(VS.Game.state.levelIndex);
    });

    // --- Top HUD ---
    byId('btn-rotate').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.Renderer.rotateCamera90();
    });

    byId('btn-sound').addEventListener('click', () => {
      VS.Sound.unlock();
      const s = VS.Storage.getSettings();
      VS.Storage.updateSetting('sound', !s.sound);
      VS.UI.applySettings();
    });

    byId('btn-home').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openMainMenu();
    });

    byId('btn-hud-settings').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openSettings();
    });

    byId('btn-levels').addEventListener('click', () => {
      VS.UI.openLevelSelectForCurrentPack();
    });

    byId('btn-hud-shop').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openShop();
    });

    // --- Main Menu ---
    byId('btn-menu-play').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.closeMainMenu();
    });

    byId('btn-menu-shop').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openShop();
    });

    byId('btn-menu-pro').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openProModal();
    });

    byId('btn-menu-levels').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openLevelSelectForCurrentPack();
    });

    byId('btn-menu-settings').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openSettings();
    });

    // --- Settings Modal ---
    byId('btn-close-settings').addEventListener('click', () => {
      VS.UI.closeSettings();
    });

    byId('toggle-sound').addEventListener('click', () => {
      VS.Sound.unlock();
      const s = VS.Storage.getSettings();
      VS.Storage.updateSetting('sound', !s.sound);
      VS.UI.applySettings();
    });

    byId('toggle-dpad').addEventListener('click', () => {
      const s = VS.Storage.getSettings();
      VS.Storage.updateSetting('showDpad', !s.showDpad);
      VS.UI.applySettings();
    });

    byId('toggle-autofollow').addEventListener('click', () => {
      const s = VS.Storage.getSettings();
      const next = !s.autoFollow;
      VS.Storage.updateSetting('autoFollow', next);
      VS.Game.state.camAutoFollow = next;
      VS.UI.applySettings();
    });

    byId('btn-replay-intro').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) {
        VS.Intro.play({ restoreLevelIndex: VS.Game.state.levelIndex });
      }
    });

    byId('btn-intro-skip').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) VS.Intro.skip();
    });

    byId('btn-intro-cta').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) VS.Intro.skip();
    });

    byId('btn-restore-purchases').addEventListener('click', async () => {
      VS.Sound.unlock();
      const statusEl = byId('restore-status');
      if (!VS.Monetization) return;
      const res = await VS.Monetization.restorePurchases();
      if (statusEl) {
        statusEl.textContent = res.ok ? 'Purchases restored!' : 'No previous purchases found.';
      }
    });

    byId('btn-dev-toggle-pro').addEventListener('click', () => {
      if (!VS.Monetization) return;
      const nowPro = VS.Monetization.devTogglePro();
      const note = byId('dev-monetization-note');
      if (note) note.textContent = `Mock Pro is now ${nowPro ? 'ENABLED' : 'DISABLED'}.`;
    });

    byId('btn-dev-add-coins').addEventListener('click', () => {
      if (!VS.Monetization) return;
      const total = VS.Monetization.devAddCoins(500);
      const note = byId('dev-monetization-note');
      if (note) note.textContent = `Added +500 coins (Balance: ${total}).`;
    });

    byId('btn-dev-reset-cooldowns').addEventListener('click', () => {
      if (!VS.Monetization) return;
      VS.Monetization.devResetCooldowns();
      const note = byId('dev-monetization-note');
      if (note) note.textContent = 'Ad cooldowns reset (interstitial armed).';
    });

    byId('btn-dev-reset-economy').addEventListener('click', () => {
      if (!VS.Monetization) return;
      VS.Monetization.devResetMockEconomy();
      const note = byId('dev-monetization-note');
      if (note) note.textContent = 'Mock purchases, packs & coins reset.';
    });

    byId('toggle-dev-ad-fail').addEventListener('click', () => {
      if (!VS.Monetization || !VS.MockAdapter) return;
      const next = !VS.MockAdapter.getSimulateAdFail();
      VS.Monetization.devSetSimulateAdFail(next);
      const note = byId('dev-monetization-note');
      if (note) note.textContent = `Simulate Ad No-Fill: ${next ? 'ON' : 'OFF'}.`;
    });

    byId('btn-reset-progress').addEventListener('click', () => {
      VS.UI.handleResetProgressClick();
    });

    // --- Level Select & Import Modal ---
    byId('tab-classic').addEventListener('click', () => VS.UI.setActivePackTab('classic'));
    byId('tab-starter').addEventListener('click', () => VS.UI.setActivePackTab('starter'));
    byId('tab-premium').addEventListener('click', () => VS.UI.setActivePackTab('premium'));
    byId('tab-import').addEventListener('click', () => VS.UI.setActivePackTab('import'));
    byId('btn-level-lock-action').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.triggerCurrentLockAction();
    });
    byId('btn-parse-xsb').addEventListener('click', () => VS.UI.handleXsbImport());
    byId('btn-close-levels').addEventListener('click', () => VS.UI.hideModal('modal-levels'));

    // --- Shop Modal ---
    byId('btn-close-shop').addEventListener('click', () => VS.UI.hideModal('modal-shop'));
    byId('shop-tab-themes').addEventListener('click', () => VS.UI.setShopTab('themes'));
    byId('shop-tab-bots').addEventListener('click', () => VS.UI.setShopTab('bots'));
    byId('shop-tab-crates').addEventListener('click', () => VS.UI.setShopTab('crates'));
    byId('btn-shop-go-pro').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openProModal();
    });
    byId('btn-shop-free-coins').addEventListener('click', async () => {
      VS.Sound.unlock();
      if (!VS.Monetization) return;
      const res = await VS.Monetization.claimShopFreeCoins();
      if (res.ok) {
        VS.UI.setShopStatus(`+${res.added} Voxel Coins claimed!`, 'text-emerald-300');
      } else if (res.reason === 'cooldown') {
        VS.UI.setShopStatus(`Next free coins ad ready in ${res.remainingSec}s.`, 'text-amber-300');
      } else if (res.reason === 'no_fill') {
        VS.UI.setShopStatus('Ad unavailable right now — try again shortly.', 'text-rose-300');
      } else {
        VS.UI.setShopStatus('Finish the rewarded ad to claim coins.', 'text-amber-300');
      }
    });

    // --- Pro Modal ---
    byId('btn-close-pro').addEventListener('click', () => VS.UI.hideModal('modal-pro'));
    byId('btn-pro-buy').addEventListener('click', async () => {
      VS.Sound.unlock();
      if (!VS.Monetization) return;
      const statusEl = byId('pro-status');
      const res = await VS.Monetization.purchasePro();
      if (statusEl) {
        if (res.ok) {
          statusEl.textContent = res.bonusGranted
            ? `Voxel Sokoban Pro unlocked! +${res.bonusGranted} bonus coins added.`
            : 'Voxel Sokoban Pro is active!';
        } else {
          statusEl.textContent = 'Purchase did not complete.';
        }
      }
    });
    byId('btn-pro-restore').addEventListener('click', async () => {
      VS.Sound.unlock();
      if (!VS.Monetization) return;
      const statusEl = byId('pro-status');
      const res = await VS.Monetization.restorePurchases();
      if (statusEl) {
        statusEl.textContent = res.ok ? 'Purchases restored!' : 'No previous purchases found.';
      }
    });

    // --- Backdrop Click-to-Close on Secondary Modals ---
    ['modal-levels', 'modal-settings', 'modal-shop', 'modal-pro'].forEach((modalId) => {
      const backdrop = byId(modalId);
      if (!backdrop) return;
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          VS.UI.hideModal(modalId);
        }
      });
    });

    // --- Victory Modal ---
    byId('btn-win-double').addEventListener('click', async () => {
      VS.Sound.unlock();
      const baseCoins = VS.UI.getPendingWinDoubleCoins();
      if (!VS.Monetization || !baseCoins) return;
      const btn = byId('btn-win-double');
      btn.disabled = true;
      const res = await VS.Monetization.claimWinDoubleCoins(baseCoins);
      if (res.ok) {
        VS.UI.clearPendingWinDoubleCoins();
        const coinsText = byId('win-coins-text');
        if (coinsText) coinsText.textContent = `Doubled! +${baseCoins * 2} Voxel Coins`;
        btn.textContent = '2× Coins Claimed ✓';
      } else {
        btn.disabled = false;
      }
    });

    byId('btn-win-trial-shop').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.hideModal('modal-win');
      VS.UI.openShop();
    });

    byId('btn-win-replay').addEventListener('click', () => {
      VS.Game.loadLevel(VS.Game.state.levelIndex);
    });

    byId('btn-win-next').addEventListener('click', async () => {
      const nextIdx = (VS.Game.state.levelIndex + 1) % VS.Levels.count();
      const nextLv = VS.Levels.get(nextIdx);
      if (VS.Storage.isLevelUnlocked(nextLv)) {
        if (VS.Monetization) {
          await VS.Monetization.maybeShowInterstitial('level_complete');
        }
        VS.Game.loadLevel(nextIdx);
      } else {
        VS.UI.hideModal('modal-win');
        VS.UI.openLevelSelectForLevel(nextLv);
      }
    });
  }

  function init() {
    setupPointerAndCanvasControls(VS.Renderer.getDomElement());
    setupKeyboardControls();
    setupButtonControls();
  }

  VS.Input = {
    init
  };
})(window);
