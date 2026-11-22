(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  let adActive = false;
  let clearsSinceInterstitial = 0;
  let lastInterstitialAt = 0;
  let lastRewardedAt = 0;
  let products = {};
  let trials = { themes: null, bots: null, crates: null };
  let trialPendingExpiry = false;

  function refreshEconomyUI() {
    if (VS.UI && typeof VS.UI.refreshEconomyUI === 'function') {
      VS.UI.refreshEconomyUI();
    }
  }

  function getCapabilities() {
    return VS.Platform ? VS.Platform.getCapabilities() : {
      rewardedAds: false,
      interstitialAds: false,
      iap: false,
      restorePurchases: false,
      cloudSave: false
    };
  }

  async function init() {
    products = {};
    if (VS.Platform && typeof VS.Platform.getProducts === 'function') {
      const list = await VS.Platform.getProducts();
      list.forEach((p) => {
        if (p && p.id) products[p.id] = p;
      });
    }
    if (VS.Storage && VS.Storage.isPro()) {
      applyEntitlements([CONFIG.PRO_PRODUCT_ID]);
    }
  }

  function isAdActive() {
    return adActive;
  }

  function getProduct(productId) {
    return products[productId] || null;
  }

  function getProductPrice(productId, fallback = '$4.99') {
    const p = products[productId];
    return (p && p.price) || fallback;
  }

  async function withAdLifecycle(fn) {
    adActive = true;
    if (VS.Platform) VS.Platform.gameplayStop();
    if (VS.Sound) VS.Sound.setAdMuted(true);

    try {
      return await fn();
    } finally {
      adActive = false;
      if (VS.Sound) VS.Sound.setAdMuted(false);
      if (
        VS.Platform &&
        VS.Game &&
        VS.UI &&
        !VS.Game.state.menuOpen &&
        !VS.UI.isAnyModalOpen()
      ) {
        VS.Platform.gameplayStart();
      }
    }
  }

  function isCosmeticOwned(category, id) {
    if (!VS.Cosmetics || !VS.Storage) return false;
    const item = VS.Cosmetics.getById(category, id);
    if (!item || item.id !== id) return false;
    if (VS.Storage.isCosmeticOwned(category, id)) return true;
    if (item.proExclusive && VS.Storage.isPro()) return true;
    return item.price === 0 && !item.proExclusive;
  }

  function canBuyCosmeticWithCoins(category, item) {
    if (!item) return false;
    return !item.proExclusive || !getCapabilities().iap;
  }

  function getActiveTrial(category) {
    return trials[category] || null;
  }

  function getActiveTrialSummary() {
    if (!VS.Cosmetics) return [];
    const list = [];
    ['themes', 'bots', 'crates'].forEach((cat) => {
      const id = trials[cat];
      if (id) {
        const item = VS.Cosmetics.getById(cat, id);
        if (item && item.id === id) {
          list.push({ category: cat, item });
        }
      }
    });
    return list;
  }

  function hasAnyActiveTrial() {
    return Boolean(trials.themes || trials.bots || trials.crates);
  }

  function buyCosmetic(category, id) {
    if (!VS.Cosmetics || !VS.Storage) return { ok: false, reason: 'unavailable' };
    const item = VS.Cosmetics.getById(category, id);
    if (!item || item.id !== id) return { ok: false, reason: 'invalid_item' };

    if (isCosmeticOwned(category, id)) {
      return equipCosmetic(category, id);
    }

    if (!canBuyCosmeticWithCoins(category, item)) {
      return { ok: false, reason: 'pro_required' };
    }

    const coins = VS.Storage.getCoins();
    if (coins < item.price) {
      return { ok: false, reason: 'insufficient_coins', needed: item.price - coins };
    }

    VS.Storage.spendCoins(item.price);
    VS.Storage.unlockCosmetic(category, id);
    trials[category] = null;
    VS.Storage.setEquippedCosmetic(category, id);

    VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: category === 'bots' });
    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();

    return { ok: true, item };
  }

  function equipCosmetic(category, id) {
    if (!VS.Cosmetics || !VS.Storage) return { ok: false, reason: 'unavailable' };
    if (!isCosmeticOwned(category, id)) return { ok: false, reason: 'not_owned' };

    trials[category] = null;
    VS.Storage.setEquippedCosmetic(category, id);
    VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: category === 'bots' });
    if (VS.Sound) VS.Sound.playStep();
    refreshEconomyUI();

    return { ok: true };
  }

  async function tryCosmeticWithAd(category, id) {
    if (adActive) return { ok: false, reason: 'busy' };
    if (!getCapabilities().rewardedAds) return { ok: false, reason: 'unavailable' };
    if (!VS.Cosmetics) return { ok: false, reason: 'unavailable' };

    const item = VS.Cosmetics.getById(category, id);
    if (!item || item.id !== id) return { ok: false, reason: 'invalid_item' };

    const res = await withAdLifecycle(() => VS.Platform.showRewardedAd('try_cosmetic'));
    if (!res || !res.rewarded) {
      return { ok: false, reason: (res && res.reason) || 'cancelled' };
    }

    lastRewardedAt = Date.now();
    trials[category] = id;
    trialPendingExpiry = false;

    VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: category === 'bots' });
    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();

    return { ok: true, item };
  }

  function onLevelWon() {
    clearsSinceInterstitial += 1;
    const activeItems = getActiveTrialSummary();
    if (activeItems.length > 0) {
      trialPendingExpiry = true;
      return { hadTrial: true, items: activeItems };
    }
    return { hadTrial: false, items: [] };
  }

  function consumeExpiredTrials() {
    if (!trialPendingExpiry) return false;
    trials = { themes: null, bots: null, crates: null };
    trialPendingExpiry = false;
    if (VS.Cosmetics) {
      VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: true });
    }
    refreshEconomyUI();
    return true;
  }

  async function claimWinDoubleCoins(baseCoins) {
    if (adActive) return { ok: false, reason: 'busy' };
    if (!baseCoins || baseCoins <= 0) return { ok: false, reason: 'no_coins' };
    if (!getCapabilities().rewardedAds) return { ok: false, reason: 'unavailable' };

    const res = await withAdLifecycle(() => VS.Platform.showRewardedAd('win_double_coins'));
    if (!res || !res.rewarded) {
      return { ok: false, reason: (res && res.reason) || 'cancelled' };
    }

    lastRewardedAt = Date.now();
    VS.Storage.addCoins(baseCoins);
    if (VS.Sound) VS.Sound.playCoin();
    refreshEconomyUI();

    return { ok: true, added: baseCoins };
  }

  function getShopAdCooldownRemaining() {
    if (!VS.Storage) return 0;
    const lastTs = VS.Storage.getLastShopAdAt();
    if (!lastTs) return 0;
    const elapsedSec = Math.floor((Date.now() - lastTs) / 1000);
    return Math.max(0, CONFIG.COIN_SHOP_AD_COOLDOWN_SEC - elapsedSec);
  }

  async function claimShopFreeCoins() {
    if (adActive) return { ok: false, reason: 'busy' };
    const rem = getShopAdCooldownRemaining();
    if (rem > 0) {
      return { ok: false, reason: 'cooldown', remainingSec: rem };
    }
    if (!getCapabilities().rewardedAds) return { ok: false, reason: 'unavailable' };

    const res = await withAdLifecycle(() => VS.Platform.showRewardedAd('shop_free_coins'));
    if (!res || !res.rewarded) {
      return { ok: false, reason: (res && res.reason) || 'cancelled' };
    }

    const now = Date.now();
    lastRewardedAt = now;
    VS.Storage.setLastShopAdAt(now);
    VS.Storage.addCoins(CONFIG.COIN_REWARDED_SHOP_GRANT);
    if (VS.Sound) VS.Sound.playCoin();
    refreshEconomyUI();

    return { ok: true, added: CONFIG.COIN_REWARDED_SHOP_GRANT };
  }

  async function unlockLevelWithAd(levelId) {
    if (adActive) return { ok: false, reason: 'busy' };
    if (!levelId) return { ok: false, reason: 'invalid' };
    if (!getCapabilities().rewardedAds) return { ok: false, reason: 'unavailable' };

    const res = await withAdLifecycle(() => VS.Platform.showRewardedAd('unlock_level'));
    if (!res || !res.rewarded) {
      return { ok: false, reason: (res && res.reason) || 'cancelled' };
    }

    lastRewardedAt = Date.now();
    VS.Storage.unlockLevelByAd(levelId);
    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();

    return { ok: true };
  }

  function shouldShowInterstitial(nowMs = Date.now()) {
    if (VS.Storage && VS.Storage.isPro()) {
      return { show: false, reason: 'pro' };
    }
    if (!getCapabilities().interstitialAds) {
      return { show: false, reason: 'unsupported' };
    }
    if (VS.Storage && VS.Storage.getTotalClears() <= CONFIG.INTERSTITIAL_GRACE_CLEARS) {
      return { show: false, reason: 'grace_period' };
    }
    if (clearsSinceInterstitial < CONFIG.INTERSTITIAL_LEVEL_INTERVAL) {
      return { show: false, reason: 'interval' };
    }
    if (lastInterstitialAt > 0 && (nowMs - lastInterstitialAt) / 1000 < CONFIG.INTERSTITIAL_COOLDOWN_SEC) {
      return { show: false, reason: 'interstitial_cooldown' };
    }
    if (lastRewardedAt > 0 && (nowMs - lastRewardedAt) / 1000 < CONFIG.INTERSTITIAL_COOLDOWN_SEC) {
      return { show: false, reason: 'rewarded_cooldown' };
    }
    return { show: true };
  }

  async function maybeShowInterstitial(placement = 'level_complete') {
    const check = shouldShowInterstitial();
    if (!check.show) {
      return { shown: false, reason: check.reason };
    }
    if (adActive) {
      return { shown: false, reason: 'busy' };
    }

    const res = await withAdLifecycle(() => VS.Platform.showInterstitialAd(placement));
    if (res && res.shown) {
      clearsSinceInterstitial = 0;
      lastInterstitialAt = Date.now();
    }
    return res || { shown: false };
  }

  function applyEntitlements(entitlements) {
    if (!Array.isArray(entitlements) || !VS.Storage) {
      return { changed: false, bonusGranted: 0 };
    }

    let changed = false;
    let bonusGranted = 0;

    if (entitlements.includes(CONFIG.PRO_PRODUCT_ID) || entitlements.includes('pro_unlock')) {
      VS.Storage.setPro(true);

      if (!VS.Storage.isProBonusClaimed()) {
        VS.Storage.addCoins(CONFIG.COIN_PRO_WELCOME_BONUS);
        VS.Storage.markProBonusClaimed();
        bonusGranted = CONFIG.COIN_PRO_WELCOME_BONUS;
      }
      changed = true;
    }

    if (entitlements.includes('pack_neon_vault')) {
      VS.Storage.unlockPack('neon-vault');
      changed = true;
    }
    if (entitlements.includes('pack_grandmaster')) {
      VS.Storage.unlockPack('grandmaster');
      changed = true;
    }

    return { changed, bonusGranted };
  }

  async function purchasePro() {
    if (adActive) return { ok: false, reason: 'busy' };
    if (VS.Storage && VS.Storage.isPro()) return { ok: true, alreadyPro: true };
    if (!getCapabilities().iap) return { ok: false, reason: 'unavailable' };

    const res = await withAdLifecycle(() => VS.Platform.purchaseProduct(CONFIG.PRO_PRODUCT_ID));
    if (!res || !res.purchased) {
      return { ok: false, reason: (res && res.reason) || 'cancelled' };
    }

    const ent = res.entitlements && res.entitlements.length ? res.entitlements : [CONFIG.PRO_PRODUCT_ID];
    const applied = applyEntitlements(ent);
    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();

    return { ok: true, bonusGranted: applied.bonusGranted };
  }

  async function purchasePack(packId) {
    const pack = VS.Levels && VS.Levels.getPackMeta ? VS.Levels.getPackMeta(packId) : null;
    if (!pack) return { ok: false, reason: 'invalid_pack' };
    if (VS.Storage && VS.Storage.isPackOwned(packId)) {
      return { ok: true, alreadyOwned: true, pack };
    }

    if (getCapabilities().iap) {
      if (adActive) return { ok: false, reason: 'busy' };
      const res = await withAdLifecycle(() => VS.Platform.purchaseProduct(pack.productId));
      if (!res || !res.purchased) {
        return { ok: false, reason: (res && res.reason) || 'cancelled' };
      }
      const ent = res.entitlements && res.entitlements.length ? res.entitlements : [pack.productId];
      applyEntitlements(ent);
    } else {
      const coins = VS.Storage.getCoins();
      if (coins < pack.fallbackCoinPrice) {
        return { ok: false, reason: 'insufficient_coins', needed: pack.fallbackCoinPrice - coins };
      }
      VS.Storage.spendCoins(pack.fallbackCoinPrice);
      VS.Storage.unlockPack(packId);
    }

    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();
    return { ok: true, pack };
  }

  async function restorePurchases() {
    if (adActive) return { ok: false, reason: 'busy' };
    if (!getCapabilities().restorePurchases) return { ok: false, reason: 'unavailable' };

    const res = await VS.Platform.restorePurchases();
    if (!res || !res.restored || !Array.isArray(res.entitlements) || res.entitlements.length === 0) {
      return { ok: false, reason: (res && res.reason) || 'no_purchases' };
    }

    applyEntitlements(res.entitlements);
    if (VS.Sound) VS.Sound.playUnlock();
    refreshEconomyUI();
    return { ok: true, entitlements: res.entitlements };
  }

  function isMockMode() {
    return Boolean(VS.Platform && VS.Platform.getAdapterId() === 'mock');
  }

  function devTogglePro() {
    if (!isMockMode() || !VS.Storage) return false;
    if (VS.Storage.isPro()) {
      VS.Storage.setPro(false);
    } else {
      applyEntitlements([CONFIG.PRO_PRODUCT_ID]);
    }
    if (VS.Cosmetics) VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: true });
    refreshEconomyUI();
    return VS.Storage.isPro();
  }

  function devAddCoins(amount = 500) {
    if (!isMockMode() || !VS.Storage) return 0;
    const total = VS.Storage.addCoins(amount);
    refreshEconomyUI();
    return total;
  }

  function devResetCooldowns() {
    if (!isMockMode() || !VS.Storage) return;
    clearsSinceInterstitial = CONFIG.INTERSTITIAL_LEVEL_INTERVAL;
    lastInterstitialAt = 0;
    lastRewardedAt = 0;
    VS.Storage.setLastShopAdAt(0);
    refreshEconomyUI();
  }

  function devSetSimulateAdFail(val) {
    if (!isMockMode() || !VS.MockAdapter) return;
    VS.MockAdapter.setSimulateAdFail(val);
    refreshEconomyUI();
  }

  function devResetMockEconomy() {
    if (!isMockMode() || !VS.Storage) return;
    trials = { themes: null, bots: null, crates: null };
    trialPendingExpiry = false;
    clearsSinceInterstitial = 0;
    lastInterstitialAt = 0;
    lastRewardedAt = 0;
    if (VS.MockAdapter) {
      VS.MockAdapter.clearMockReceipts();
      VS.MockAdapter.setSimulateAdFail(false);
    }
    VS.Storage.resetMockEconomy();
    if (VS.Cosmetics) VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: true });
    refreshEconomyUI();
  }

  function getDebugState() {
    return {
      adActive,
      clearsSinceInterstitial,
      lastInterstitialAt,
      lastRewardedAt,
      trials: Object.assign({}, trials),
      trialPendingExpiry
    };
  }

  VS.Monetization = {
    init,
    isAdActive,
    getCapabilities,
    getProduct,
    getProductPrice,
    isCosmeticOwned,
    canBuyCosmeticWithCoins,
    getActiveTrial,
    getActiveTrialSummary,
    hasAnyActiveTrial,
    buyCosmetic,
    equipCosmetic,
    tryCosmeticWithAd,
    onLevelWon,
    consumeExpiredTrials,
    claimWinDoubleCoins,
    getShopAdCooldownRemaining,
    claimShopFreeCoins,
    unlockLevelWithAd,
    shouldShowInterstitial,
    maybeShowInterstitial,
    applyEntitlements,
    purchasePro,
    purchasePack,
    restorePurchases,
    isMockMode,
    devTogglePro,
    devAddCoins,
    devResetCooldowns,
    devSetSimulateAdFail,
    devResetMockEconomy,
    getDebugState
  };
})(window);
