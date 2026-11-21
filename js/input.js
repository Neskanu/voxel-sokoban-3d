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

    // --- Main Menu ---
    byId('btn-menu-play').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.closeMainMenu();
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

    byId('btn-reset-progress').addEventListener('click', () => {
      VS.UI.handleResetProgressClick();
    });

    // --- Level Select & Import Modal ---
    byId('tab-classic').addEventListener('click', () => VS.UI.setActivePackTab('classic'));
    byId('tab-starter').addEventListener('click', () => VS.UI.setActivePackTab('starter'));
    byId('tab-import').addEventListener('click', () => VS.UI.setActivePackTab('import'));
    byId('btn-parse-xsb').addEventListener('click', () => VS.UI.handleXsbImport());
    byId('btn-close-levels').addEventListener('click', () => VS.UI.hideModal('modal-levels'));

    // --- Backdrop Click-to-Close on Secondary Modals ---
    ['modal-levels', 'modal-settings'].forEach((modalId) => {
      const backdrop = byId(modalId);
      if (!backdrop) return;
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          VS.UI.hideModal(modalId);
        }
      });
    });

    // --- Victory Modal ---
    byId('btn-win-replay').addEventListener('click', () => {
      VS.Game.loadLevel(VS.Game.state.levelIndex);
    });

    byId('btn-win-next').addEventListener('click', () => {
      const nextIdx = (VS.Game.state.levelIndex + 1) % VS.Levels.count();
      const nextLv = VS.Levels.get(nextIdx);
      if (VS.Storage.isLevelUnlocked(nextLv)) {
        VS.Game.loadLevel(nextIdx);
      } else {
        VS.UI.hideModal('modal-win');
        VS.UI.setActivePackTab(nextLv.pack === 'starter' ? 'starter' : 'classic');
        VS.UI.showModal('modal-levels');
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
