(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const RECEIPTS_KEY = 'voxel_sokoban_mock_receipts_v1';

  const PRODUCTS = [
    {
      id: 'pro_unlock',
      title: 'Voxel Sokoban Pro',
      price: '$4.99',
      description: 'No interstitials, permanent 2× coins, all 4 level packs (400 levels), Prestige cosmetics + 500 bonus coins.',
      entitlements: [
        'pro_unlock',
        'pack_neon_vault',
        'pack_frost_citadel',
        'pack_sandstone_labyrinth',
        'pack_grandmaster'
      ]
    },
    {
      id: 'pack_neon_vault',
      title: 'Neon Vault Pack',
      price: '$1.99',
      description: 'Unlock all 100 Medium-Hard puzzles in Neon Vault.',
      entitlements: ['pack_neon_vault']
    },
    {
      id: 'pack_frost_citadel',
      title: 'Frost Citadel Pack',
      price: '$2.49',
      description: 'Unlock all 100 Hard puzzles in Frost Citadel.',
      entitlements: ['pack_frost_citadel']
    },
    {
      id: 'pack_sandstone_labyrinth',
      title: 'Sandstone Labyrinth Pack',
      price: '$2.99',
      description: 'Unlock all 100 Expert puzzles in Sandstone Labyrinth.',
      entitlements: ['pack_sandstone_labyrinth']
    },
    {
      id: 'pack_grandmaster',
      title: 'Grandmaster Pack',
      price: '$3.49',
      description: 'Unlock all 100 Grandmaster puzzles in Grandmaster.',
      entitlements: ['pack_grandmaster']
    }
  ];

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

  function loadReceipts() {
    try {
      const raw = global.localStorage.getItem(RECEIPTS_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveReceipt(productId) {
    try {
      const list = loadReceipts();
      if (!list.includes(productId)) {
        list.push(productId);
        global.localStorage.setItem(RECEIPTS_KEY, JSON.stringify(list));
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  function expandEntitlements(receiptIds) {
    const set = new Set();
    receiptIds.forEach((pid) => {
      const prod = PRODUCTS.find((p) => p.id === pid);
      if (prod && Array.isArray(prod.entitlements)) {
        prod.entitlements.forEach((ent) => set.add(ent));
      } else if (pid) {
        set.add(pid);
      }
    });
    return Array.from(set);
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
        primaryBtn.textContent = config.primaryLabel;
        primaryBtn.className = config.primaryClass;
        primaryBtn.disabled = Boolean(config.primaryDelayMs);
        primaryBtn.classList.toggle('hidden', !config.primaryLabel);
      }
      if (secondaryBtn) {
        secondaryBtn.textContent = config.secondaryLabel || '';
        secondaryBtn.className = config.secondaryClass || 'game-btn rounded-2xl flex-1 py-3 font-bold text-sm text-slate-200';
        secondaryBtn.classList.toggle('hidden', !config.secondaryLabel);
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
      iap: true,
      restorePurchases: true,
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
        subtitle: 'Simulated rewarded video ad. Finish the 3s countdown (or tap Simulate Complete) to claim your reward.',
        durationMs: 3000,
        timerPrefix: 'Reward unlocks in',
        timerDoneText: 'Reward earned!',
        primaryLabel: 'Simulate Complete',
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
        subtitle: `${label} — Interstitials never appear during puzzles and are removed permanently by Voxel Sokoban Pro.`,
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
      return PRODUCTS.map((p) => Object.assign({}, p));
    },

    async purchaseProduct(productId) {
      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product) {
        return { purchased: false, productId, entitlements: [], reason: 'unknown_product' };
      }

      return runOverlaySession({
        badgeText: 'MOCK STORE CHECKOUT',
        badgeClass: 'mono inline-block text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-3',
        title: `${product.title} — ${product.price}`,
        subtitle: `${product.description} (No real charge in local Mock mode.)`,
        durationMs: 0,
        primaryLabel: 'Confirm Test Purchase',
        primaryClass: 'game-btn game-btn-gold rounded-2xl flex-1 py-3 font-extrabold text-sm',
        secondaryLabel: 'Simulate Failure',
        secondaryClass: 'game-btn rounded-2xl flex-1 py-3 font-bold text-sm text-rose-300',
        fallbackResult: { purchased: false, productId, entitlements: [], reason: 'no_ui' },
        onPrimary: () => {
          saveReceipt(product.id);
          return {
            purchased: true,
            productId: product.id,
            entitlements: product.entitlements.slice()
          };
        },
        onSecondary: () => ({
          purchased: false,
          productId: product.id,
          entitlements: [],
          reason: 'cancelled'
        })
      });
    },

    async restorePurchases() {
      const receipts = loadReceipts();
      const entitlements = expandEntitlements(receipts);
      return {
        restored: entitlements.length > 0,
        entitlements,
        reason: entitlements.length > 0 ? undefined : 'no_purchases'
      };
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
