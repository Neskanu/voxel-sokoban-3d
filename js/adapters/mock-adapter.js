(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const RECEIPTS_KEY = 'voxel_sokoban_mock_receipts_v1';

  const PLACEMENT_LABELS = {
    win_double_coins: 'Double Win Coins (2×)',
    shop_free_coins: 'Free +50 Voxel Coins',
    try_cosmetic: '1-Level Cosmetic Trial',
    unlock_level: 'Unlock Star-Locked Level',
    level_complete: 'Between-Level Break'
  };

  let simulateAdFail = false;
  let activeCleanup = null;

  function byId(id) {
    return global.document ? global.document.getElementById(id) : null;
  }

  function clearMockReceipts() {
    try {
      global.localStorage.removeItem(RECEIPTS_KEY);
    } catch (e) {}
  }

  function closeAdOverlay() {
    if (typeof activeCleanup === 'function') {
      activeCleanup();
      activeCleanup = null;
    }
    const modal = byId('modal-ad');
    if (modal) {
      modal.classList.add('modal-hidden');
    }
  }

  function runOverlaySession(config) {
    closeAdOverlay();
    const modal = byId('modal-ad');
    if (!modal) {
      return Promise.resolve(config.fallbackResult);
    }

    return new Promise((resolve) => {
      let settled = false;
      let timerId = null;

      const badgeEl = byId('ad-badge');
      const titleEl = byId('ad-title');
      const subtitleEl = byId('ad-subtitle');
      const progressWrapEl = byId('ad-progress-wrap');
      const progressFillEl = byId('ad-progress-fill');
      const timerEl = byId('ad-timer-text');
      const primaryBtn = byId('ad-btn-primary');
      const secondaryBtn = byId('ad-btn-secondary');

      if (badgeEl) {
        badgeEl.textContent = config.badgeText;
        badgeEl.className = config.badgeClass;
      }
      if (titleEl) titleEl.textContent = config.title;
      if (subtitleEl) subtitleEl.textContent = config.subtitle;

      if (progressWrapEl) {
        progressWrapEl.classList.toggle('hidden', !config.durationMs);
      }
      if (progressFillEl) {
        progressFillEl.style.width = '0%';
      }
      if (timerEl) {
        timerEl.classList.toggle('hidden', !config.durationMs);
      }

      if (primaryBtn) {
        primaryBtn.textContent = config.primaryLabel || '';
        primaryBtn.className = config.primaryClass || 'game-btn game-btn-emerald rounded-2xl flex-1 py-3 font-extrabold text-sm';
        primaryBtn.disabled = Boolean(config.primaryDelayMs);
        primaryBtn.classList.toggle('hidden', !config.primaryLabel);
        primaryBtn.style.display = config.primaryLabel ? '' : 'none';
      }
      if (secondaryBtn) {
        secondaryBtn.textContent = config.secondaryLabel || '';
        secondaryBtn.className = config.secondaryClass || 'game-btn rounded-2xl flex-1 py-3 font-bold text-sm text-slate-200';
        secondaryBtn.classList.toggle('hidden', !config.secondaryLabel);
        secondaryBtn.style.display = config.secondaryLabel ? '' : 'none';
      }

      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (timerId) {
          global.clearInterval(timerId);
          timerId = null;
        }
        if (primaryBtn) primaryBtn.onclick = null;
        if (secondaryBtn) secondaryBtn.onclick = null;
        activeCleanup = null;
        modal.classList.add('modal-hidden');
        resolve(result);
      };

      activeCleanup = () => {
        if (timerId) {
          global.clearInterval(timerId);
          timerId = null;
        }
        if (primaryBtn) primaryBtn.onclick = null;
        if (secondaryBtn) secondaryBtn.onclick = null;
      };

      if (primaryBtn) {
        primaryBtn.onclick = () => {
          if (primaryBtn.disabled) return;
          finish(config.onPrimary());
        };
      }
      if (secondaryBtn) {
        secondaryBtn.onclick = () => {
          finish(config.onSecondary());
        };
      }

      modal.classList.remove('modal-hidden');

      if (config.durationMs && config.durationMs > 0) {
        const startedAt = Date.now();
        const updateProgress = () => {
          const elapsed = Date.now() - startedAt;
          const pct = Math.min(100, (elapsed / config.durationMs) * 100);
          const remainingSec = Math.max(0, Math.ceil((config.durationMs - elapsed) / 1000));

          if (progressFillEl) progressFillEl.style.width = `${pct.toFixed(1)}%`;

          if (config.primaryDelayMs && primaryBtn) {
            const unlockRem = Math.max(0, Math.ceil((config.primaryDelayMs - elapsed) / 1000));
            if (elapsed >= config.primaryDelayMs) {
              primaryBtn.disabled = false;
              primaryBtn.textContent = config.primaryLabel;
            } else {
              primaryBtn.disabled = true;
              primaryBtn.textContent = `${config.primaryLabel} (${unlockRem}s)`;
            }
          }

          if (timerEl) {
            timerEl.textContent =
              remainingSec > 0
                ? `${config.timerPrefix || 'Completing in'} ${remainingSec}s...`
                : (config.timerDoneText || 'Ready!');
          }

          if (elapsed >= config.durationMs && config.autoCompleteResult) {
            finish(config.autoCompleteResult);
          }
        };

        updateProgress();
        timerId = global.setInterval(updateProgress, 60);
      }
    });
  }

  function delay(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }

  const mockAdapter = {
    id: 'mock',
    name: 'Local Mock (Dev)',
    capabilities: {
      rewardedAds: true,
      interstitialAds: true,
      iap: false,
      restorePurchases: false,
      cloudSave: false
    },

    async init() {
      return true;
    },

    gameplayStart() {},
    gameplayStop() {},
    happyTime() {},

    async showRewardedAd(placement) {
      if (simulateAdFail) {
        await delay(250);
        return { rewarded: false, reason: 'no_fill' };
      }

      const label = PLACEMENT_LABELS[placement] || placement || 'Rewarded Bonus';
      return runOverlaySession({
        badgeText: 'MOCK REWARDED AD',
        badgeClass: 'mono inline-block text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-3',
        title: label,
        subtitle: 'Simulated rewarded video ad. Finish the 3s countdown to claim your reward.',
        durationMs: 3000,
        timerPrefix: 'Reward unlocks in',
        timerDoneText: 'Reward earned!',
        primaryLabel: '',
        primaryClass: 'game-btn game-btn-emerald rounded-2xl flex-1 py-3 font-extrabold text-sm',
        secondaryLabel: 'Cancel Early',
        secondaryClass: 'game-btn rounded-2xl flex-1 py-3 font-bold text-sm text-rose-300',
        autoCompleteResult: { rewarded: true },
        fallbackResult: { rewarded: true },
        onPrimary: () => ({ rewarded: true }),
        onSecondary: () => ({ rewarded: false, reason: 'dismissed' })
      });
    },

    async showInterstitialAd(placement) {
      if (simulateAdFail) {
        await delay(200);
        return { shown: false, reason: 'no_fill' };
      }

      const label = PLACEMENT_LABELS[placement] || 'Level Transition';
      return runOverlaySession({
        badgeText: 'MOCK INTERSTITIAL AD',
        badgeClass: 'mono inline-block text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 mb-3',
        title: 'Quick Sponsor Break',
        subtitle: `${label} — Interstitials only appear between levels and never interrupt active puzzles.`,
        durationMs: 2000,
        primaryDelayMs: 1000,
        timerPrefix: 'Auto-continuing in',
        timerDoneText: 'Done!',
        primaryLabel: 'Continue',
        primaryClass: 'game-btn game-btn-primary rounded-2xl flex-1 py-3 font-extrabold text-sm',
        secondaryLabel: '',
        autoCompleteResult: { shown: true },
        fallbackResult: { shown: true },
        onPrimary: () => ({ shown: true }),
        onSecondary: () => ({ shown: true })
      });
    },

    async getProducts() {
      return [];
    },

    async purchaseProduct(productId) {
      return { purchased: false, productId, entitlements: [], reason: 'unavailable' };
    },

    async restorePurchases() {
      return { restored: false, entitlements: [], reason: 'unavailable' };
    },

    setSimulateAdFail(val) {
      simulateAdFail = Boolean(val);
    },

    getSimulateAdFail() {
      return simulateAdFail;
    },

    clearMockReceipts
  };

  if (VS.Platform && typeof VS.Platform.registerAdapter === 'function') {
    VS.Platform.registerAdapter(mockAdapter);
  }
  VS.MockAdapter = mockAdapter;
})(window);
