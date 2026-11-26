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

  const PREVENT_SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const MENU_MODAL_ORDER = ['modal-settings', 'modal-pro', 'modal-levels', 'modal-shop', 'modal-win', 'modal-menu'];
  let winMenuNavigated = false;

  function getActiveMenuModalId() {
    if (!VS.UI || (VS.Monetization && VS.Monetization.isAdActive()) || VS.UI.isModalOpen('modal-ad')) {
      return null;
    }
    for (let i = 0; i < MENU_MODAL_ORDER.length; i++) {
      const id = MENU_MODAL_ORDER[i];
      if (VS.UI.isModalOpen(id)) return id;
    }
    if (VS.Game && VS.Game.state && VS.Game.state.menuOpen) {
      return 'modal-menu';
    }
    return null;
  }

  function getFocusableMenuItems(modalId) {
    const modal = byId(modalId);
    if (!modal) return [];
    const nodes = modal.querySelectorAll('button, [role="switch"]');
    const list = [];
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el || el.disabled || (el.classList && el.classList.contains('hidden'))) continue;
      if (el.offsetParent === null && typeof el.getBoundingClientRect !== 'function') continue;
      if (el.offsetParent === null && (!el.getBoundingClientRect || (el.getBoundingClientRect().width === 0 && el.getBoundingClientRect().height === 0))) {
        continue;
      }
      list.push(el);
    }
    return list;
  }

  function getCenter(el) {
    if (el && typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, valid: r.width > 0 || r.height > 0 };
    }
    return { x: 0, y: 0, valid: false };
  }

  function moveMenuFocus(modalId, dir) {
    const items = getFocusableMenuItems(modalId);
    if (!items.length) return null;

    if (modalId === 'modal-win') {
      winMenuNavigated = true;
    }

    const doc = global.document;
    const activeEl = doc ? doc.activeElement : null;
    let curIdx = items.indexOf(activeEl);
    let target = null;

    if (curIdx === -1 && modalId === 'modal-win') {
      const doubleBtn = byId('btn-win-double');
      const nextBtn = byId('btn-win-next');
      const anchorBtn =
        doubleBtn && !doubleBtn.classList.contains('hidden') && !doubleBtn.disabled ? doubleBtn : nextBtn;
      const anchorIdx = anchorBtn ? items.indexOf(anchorBtn) : -1;
      if (anchorIdx !== -1) {
        curIdx = anchorIdx;
      }
    }

    if (curIdx === -1) {
      if (modalId === 'modal-menu') {
        target = byId('btn-menu-play');
      }
      if (!target || items.indexOf(target) === -1) {
        target = items[0];
      }
    } else {
      const curCenter = getCenter(items[curIdx]);
      if (curCenter.valid) {
        let bestScore = Infinity;
        for (let i = 0; i < items.length; i++) {
          if (i === curIdx) continue;
          const c = getCenter(items[i]);
          if (!c.valid) continue;
          const dx = c.x - curCenter.x;
          const dy = c.y - curCenter.y;
          let primary = -1;
          let secondary = 0;
          if (dir === 'up' && dy < -4) {
            primary = -dy;
            secondary = Math.abs(dx);
          } else if (dir === 'down' && dy > 4) {
            primary = dy;
            secondary = Math.abs(dx);
          } else if (dir === 'left' && dx < -4) {
            primary = -dx;
            secondary = Math.abs(dy);
          } else if (dir === 'right' && dx > 4) {
            primary = dx;
            secondary = Math.abs(dy);
          }
          if (primary > 0) {
            const score = primary + secondary * 2.5;
            if (score < bestScore) {
              bestScore = score;
              target = items[i];
            }
          }
        }
      }
      if (!target) {
        const step = dir === 'up' || dir === 'left' ? -1 : 1;
        target = items[(curIdx + step + items.length) % items.length];
      }
    }

    if (target && typeof target.focus === 'function') {
      target.focus();
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'nearest' });
      }
      if (VS.Sound && typeof VS.Sound.playClick === 'function') {
        VS.Sound.playClick();
      }
    }
    return target;
  }

  function setupKeyboardControls() {
    global.addEventListener('keydown', (e) => {
      if (!isEditableTarget(e.target) && (PREVENT_SCROLL_KEYS.has(e.key) || e.code === 'Space')) {
        e.preventDefault();
      }

      if (VS.Intro && VS.Intro.isActive()) {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          VS.Intro.skip();
        }
        return;
      }

      if (
        e.key === 'Enter' &&
        !e.repeat &&
        !isEditableTarget(e.target) &&
        !VS.Game.state.menuOpen &&
        VS.UI.isModalOpen('modal-win') &&
        !VS.UI.isModalOpen('modal-ad') &&
        !VS.UI.isModalOpen('modal-levels') &&
        !VS.UI.isModalOpen('modal-settings') &&
        !VS.UI.isModalOpen('modal-shop') &&
        !(VS.Monetization && VS.Monetization.isAdActive())
      ) {
        if (winMenuNavigated) {
          const items = getFocusableMenuItems('modal-win');
          const activeEl = global.document ? global.document.activeElement : null;
          if (activeEl && items.indexOf(activeEl) !== -1) {
            e.preventDefault();
            winMenuNavigated = false;
            activeEl.click();
            return;
          }
        }
        const doubleBtn = byId('btn-win-double');
        const nextBtn = byId('btn-win-next');
        if (doubleBtn && !doubleBtn.classList.contains('hidden') && !doubleBtn.disabled) {
          e.preventDefault();
          doubleBtn.click();
        } else if (nextBtn && !nextBtn.classList.contains('hidden') && !nextBtn.disabled) {
          e.preventDefault();
          nextBtn.click();
        }
        return;
      }

      if (isEditableTarget(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      const activeMenuId = getActiveMenuModalId();
      if (activeMenuId !== 'modal-win') {
        winMenuNavigated = false;
      }

      if (activeMenuId) {
        if (key === 'escape' && !e.repeat) {
          e.preventDefault();
          if (activeMenuId === 'modal-menu') {
            VS.UI.closeMainMenu();
          } else if (activeMenuId === 'modal-win') {
            winMenuNavigated = false;
            VS.UI.hideModal('modal-win');
          } else {
            VS.UI.closeTopModal();
          }
          return;
        }

        const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
        if (!hasModifier) {
          if (key === 'arrowup' || key === 'w') {
            e.preventDefault();
            moveMenuFocus(activeMenuId, 'up');
            return;
          }
          if (key === 'arrowdown' || key === 's') {
            e.preventDefault();
            moveMenuFocus(activeMenuId, 'down');
            return;
          }
          if (key === 'arrowleft' || key === 'a') {
            e.preventDefault();
            moveMenuFocus(activeMenuId, 'left');
            return;
          }
          if (key === 'arrowright' || key === 'd') {
            e.preventDefault();
            moveMenuFocus(activeMenuId, 'right');
            return;
          }
          if ((e.key === ' ' || e.code === 'Space') && !e.repeat) {
            const items = getFocusableMenuItems(activeMenuId);
            const activeEl = global.document ? global.document.activeElement : null;
            if (activeEl && items.indexOf(activeEl) !== -1) {
              e.preventDefault();
              if (activeMenuId === 'modal-win') winMenuNavigated = false;
              activeEl.click();
            }
            return;
          }
          if (e.key === 'Enter' && !e.repeat && activeMenuId !== 'modal-win') {
            const items = getFocusableMenuItems(activeMenuId);
            const activeEl = global.document ? global.document.activeElement : null;
            if (activeEl && items.indexOf(activeEl) !== -1) {
              e.preventDefault();
              activeEl.click();
            } else if (activeMenuId === 'modal-menu') {
              const playBtn = byId('btn-menu-play');
              if (playBtn && !playBtn.disabled) {
                e.preventDefault();
                playBtn.click();
              }
            }
            return;
          }
        }
        return;
      }

      if (VS.Game.state.menuOpen || VS.UI.isAnyModalOpen()) {
        return;
      }

      if (key === 'escape' && !e.repeat) {
        e.preventDefault();
        VS.UI.openMainMenu();
        return;
      }

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
        const [gx, gy] = VS.Game.screenDirToGrid('up');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowdown' || key === 's') {
        const [gx, gy] = VS.Game.screenDirToGrid('down');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowleft' || key === 'a') {
        const [gx, gy] = VS.Game.screenDirToGrid('left');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'arrowright' || key === 'd') {
        const [gx, gy] = VS.Game.screenDirToGrid('right');
        VS.Game.attemptMove(gx, gy);
      } else if (key === 'z' || key === 'backspace') {
        if (key === 'backspace') e.preventDefault();
        VS.Game.undoMove();
      } else if (key === 'r') {
        VS.Game.loadLevel(VS.Game.state.levelIndex);
      } else if (key === 'h') {
        VS.Game.requestHint();
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

    const hintBtn = byId('btn-hint');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        VS.Game.requestHint();
      });
    }

    // --- Top HUD ---
    byId('btn-rotate').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.Renderer.rotateCamera90();
    });

    byId('btn-sound').addEventListener('click', () => {
      VS.Sound.unlock();
      const s = VS.Storage.getSettings();
      const anyOn = Boolean(s.sound || s.music !== false);
      const next = !anyOn;
      VS.Storage.updateSetting('sound', next);
      VS.Storage.updateSetting('music', next);
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
      if (VS.Game && typeof VS.Game.getNextUncompletedLevelIndex === 'function') {
        const nextIdx = VS.Game.getNextUncompletedLevelIndex();
        const st = VS.Game.state;
        if (st.won || (st.moves === 0 && st.levelIndex !== nextIdx)) {
          VS.Game.loadLevel(nextIdx);
        }
      }
      VS.UI.closeMainMenu();
    });

    byId('btn-menu-shop').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.openShop();
    });

    const menuProBtn = byId('btn-menu-pro');
    if (menuProBtn) {
      menuProBtn.addEventListener('click', () => {
        VS.Sound.unlock();
        VS.UI.openProModal();
      });
    }

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

    const musicToggle = byId('toggle-music');
    if (musicToggle) {
      musicToggle.addEventListener('click', () => {
        VS.Sound.unlock();
        const s = VS.Storage.getSettings();
        VS.Storage.updateSetting('music', s.music === false);
        VS.UI.applySettings();
      });
    }

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

    const hapticsToggle = byId('toggle-haptics');
    if (hapticsToggle) {
      hapticsToggle.addEventListener('click', () => {
        const s = VS.Storage.getSettings();
        const next = s.haptics === false;
        VS.Storage.updateSetting('haptics', next);
        VS.UI.applySettings();
        if (next && VS.Platform && VS.Platform.haptic) {
          VS.Platform.haptic('select');
        }
      });
    }

    byId('btn-replay-intro').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) {
        VS.Intro.play({ restoreLevelIndex: VS.Game.state.levelIndex });
      }
    });

    const restoreBtn = byId('btn-restore-purchases');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', async () => {
        VS.Sound.unlock();
        const statusEl = byId('restore-status');
        if (!VS.Monetization) return;
        const res = await VS.Monetization.restorePurchases();
        if (statusEl) {
          statusEl.textContent = res.ok ? 'Purchases restored!' : 'No previous purchases found.';
        }
      });
    }

    byId('btn-intro-skip').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) VS.Intro.skip();
    });

    byId('btn-intro-cta').addEventListener('click', () => {
      VS.Sound.unlock();
      if (VS.Intro) VS.Intro.skip();
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
    const shopGoProBtn = byId('btn-shop-go-pro');
    if (shopGoProBtn) {
      shopGoProBtn.addEventListener('click', () => {
        VS.Sound.unlock();
        VS.UI.openProModal();
      });
    }
    byId('btn-shop-free-coins').addEventListener('click', async () => {
      VS.Sound.unlock();
      if (!VS.Monetization) return;
      const res = await VS.Monetization.claimShopFreeCoins();
      if (res.ok) {
        VS.UI.setShopStatus(`+${res.added} Voxel Coins claimed!`, 'text-emerald-300');
      } else if (res.reason === 'cooldown') {
        VS.UI.setShopStatus(`Next free coins ad ready in ${res.remainingSec}s.`, 'text-amber-300');
      } else if (res.reason === 'adblock') {
        VS.UI.setShopStatus('Ad blocked — disable your ad blocker to claim free coins.', 'text-rose-300');
      } else if (res.reason === 'no_fill' || res.reason === 'unfilled' || res.reason === 'unavailable') {
        VS.UI.setShopStatus('Ad unavailable right now — try again shortly.', 'text-rose-300');
      } else {
        VS.UI.setShopStatus('Finish the rewarded ad to claim coins.', 'text-amber-300');
      }
    });

    // --- Pro Modal ---
    const closeProBtn = byId('btn-close-pro');
    if (closeProBtn) {
      closeProBtn.addEventListener('click', () => VS.UI.hideModal('modal-pro'));
    }
    const proBuyBtn = byId('btn-pro-buy');
    if (proBuyBtn) {
      proBuyBtn.addEventListener('click', async () => {
        VS.Sound.unlock();
        if (!VS.Monetization) return;
        const statusEl = byId('pro-status');
        proBuyBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Opening Telegram Stars invoice...';
        const res = await VS.Monetization.purchasePro();
        proBuyBtn.disabled = Boolean(VS.Storage && VS.Storage.isPro());
        if (statusEl) {
          if (res.ok) {
            statusEl.textContent = res.bonusGranted
              ? `Pro unlocked! +${res.bonusGranted} welcome coins added.`
              : 'Crate Expectations Pro is active!';
          } else if (res.reason === 'cancelled') {
            statusEl.textContent = 'Purchase cancelled.';
          } else {
            statusEl.textContent = 'Purchase did not complete — try again.';
          }
        }
      });
    }
    const proRestoreBtn = byId('btn-pro-restore');
    if (proRestoreBtn) {
      proRestoreBtn.addEventListener('click', async () => {
        VS.Sound.unlock();
        if (!VS.Monetization) return;
        const statusEl = byId('pro-status');
        const res = await VS.Monetization.restorePurchases();
        if (statusEl) {
          statusEl.textContent = res.ok ? 'Purchases restored!' : 'No previous purchases found.';
        }
      });
    }

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
      const statusEl = byId('win-ad-status');
      btn.disabled = true;
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.add('hidden');
      }
      const res = await VS.Monetization.claimWinDoubleCoins(baseCoins);
      if (res.ok) {
        VS.UI.clearPendingWinDoubleCoins();
        const coinsText = byId('win-coins-text');
        if (coinsText) coinsText.textContent = `Doubled! +${baseCoins * 2} Voxel Coins`;
        btn.textContent = '2× Coins Claimed ✓';
      } else {
        btn.disabled = false;
        if (statusEl) {
          if (res.reason === 'adblock') {
            statusEl.textContent = 'Ad blocked — disable your ad blocker to claim 2× coins.';
          } else if (res.reason === 'unfilled' || res.reason === 'no_fill' || res.reason === 'unavailable') {
            statusEl.textContent = 'Ad unavailable right now — try again shortly.';
          } else {
            statusEl.textContent = 'Finish the rewarded ad to double your coins.';
          }
          statusEl.classList.remove('hidden');
        }
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

    byId('btn-win-levels').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.hideModal('modal-win');
      VS.UI.openLevelSelectForCurrentPack();
    });

    byId('btn-win-menu').addEventListener('click', () => {
      VS.Sound.unlock();
      VS.UI.hideModal('modal-win');
      VS.UI.openMainMenu();
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
    if (
      VS.Platform &&
      typeof VS.Platform.setBackHandler === 'function' &&
      VS.UI &&
      typeof VS.UI.handlePlatformBack === 'function'
    ) {
      VS.Platform.setBackHandler(VS.UI.handlePlatformBack);
    }
  }

  VS.Input = {
    init
  };
})(window);
