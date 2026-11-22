(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const DEFAULT_CAPABILITIES = Object.freeze({
    rewardedAds: false,
    interstitialAds: false,
    iap: false,
    restorePurchases: false,
    cloudSave: false
  });

  const adapters = new Map();
  let activeAdapter = null;

  const CRAZYGAMES_HOST_RE = /(^|\.)(crazygames|crazygames-cdn|crazygamesx|1001juegos|speelspelletjes)\./i;
  const LOCAL_HOST_SET = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

  function getSearchParams() {
    try {
      if (global.location && global.location.search) {
        return new global.URLSearchParams(global.location.search);
      }
    } catch (e) {
      // Ignore URL parsing issues
    }
    return null;
  }

  function isLocalOrFileHost() {
    if (!global.location) return false;
    if (global.location.protocol === 'file:') return true;
    const host = String(global.location.hostname || '').toLowerCase();
    return LOCAL_HOST_SET.has(host);
  }

  function isDevEnvironment() {
    if (global.__VS_DEV__ === true) return true;
    const params = getSearchParams();
    if (params && params.get('dev') === '1') return true;
    return isLocalOrFileHost();
  }

  function isCrazyGamesEnvironment() {
    const params = getSearchParams();
    if (params) {
      const p = params.get('platform') || params.get('adapter');
      if (p === 'crazygames') return true;
    }
    if (global.location && CRAZYGAMES_HOST_RE.test(String(global.location.hostname || ''))) {
      return true;
    }
    try {
      if (
        !isLocalOrFileHost() &&
        global.document &&
        typeof global.document.referrer === 'string' &&
        /crazygames\./i.test(global.document.referrer)
      ) {
        return true;
      }
    } catch (e) {}
    if (
      global.CrazyGames &&
      global.CrazyGames.SDK &&
      global.CrazyGames.SDK.environment === 'crazygames'
    ) {
      return true;
    }
    return false;
  }

  function registerAdapter(adapter) {
    if (!adapter || !adapter.id) return;
    adapters.set(adapter.id, adapter);
  }

  function resolveAdapterId(preferredId) {
    const params = getSearchParams();
    if (params) {
      const paramId = params.get('platform') || params.get('adapter');
      if (paramId && adapters.has(paramId)) return paramId;
    }

    if (typeof global.VOXEL_SOKOBAN_ADAPTER === 'string' && adapters.has(global.VOXEL_SOKOBAN_ADAPTER)) {
      return global.VOXEL_SOKOBAN_ADAPTER;
    }

    if (isCrazyGamesEnvironment() && adapters.has('crazygames')) {
      return 'crazygames';
    }

    const fallbackId = preferredId || (VS.CONFIG && VS.CONFIG.ADAPTER) || 'mock';
    if (adapters.has(fallbackId)) return fallbackId;
    if (adapters.has('mock')) return 'mock';

    const first = adapters.values().next();
    return first && !first.done ? first.value.id : null;
  }

  async function init(preferredId) {
    const chosenId = resolveAdapterId(preferredId);
    activeAdapter = chosenId ? adapters.get(chosenId) : null;
    if (activeAdapter && typeof activeAdapter.init === 'function') {
      try {
        await activeAdapter.init();
      } catch (err) {
        console.warn(`Platform adapter "${chosenId}" init failed:`, err);
      }
    }
    return activeAdapter;
  }

  function getAdapter() {
    return activeAdapter;
  }

  function getAdapterId() {
    return activeAdapter ? activeAdapter.id : 'none';
  }

  function getCapabilities() {
    if (!activeAdapter || !activeAdapter.capabilities) {
      return Object.assign({}, DEFAULT_CAPABILITIES);
    }
    return Object.assign({}, DEFAULT_CAPABILITIES, activeAdapter.capabilities);
  }

  function isCrazyGamesMode() {
    return getAdapterId() === 'crazygames';
  }

  function loadingStart() {
    if (activeAdapter && typeof activeAdapter.loadingStart === 'function') {
      try {
        activeAdapter.loadingStart();
      } catch (e) {}
    }
  }

  function loadingStop() {
    if (activeAdapter && typeof activeAdapter.loadingStop === 'function') {
      try {
        activeAdapter.loadingStop();
      } catch (e) {}
    }
  }

  function gameplayStart() {
    if (activeAdapter && typeof activeAdapter.gameplayStart === 'function') {
      try {
        activeAdapter.gameplayStart();
      } catch (e) {}
    }
  }

  function gameplayStop() {
    if (activeAdapter && typeof activeAdapter.gameplayStop === 'function') {
      try {
        activeAdapter.gameplayStop();
      } catch (e) {}
    }
  }

  function happyTime() {
    if (activeAdapter && typeof activeAdapter.happyTime === 'function') {
      try {
        activeAdapter.happyTime();
      } catch (e) {}
    }
  }

  async function showRewardedAd(placement) {
    const caps = getCapabilities();
    if (!caps.rewardedAds || !activeAdapter || typeof activeAdapter.showRewardedAd !== 'function') {
      return { rewarded: false, reason: 'unavailable' };
    }
    try {
      return await activeAdapter.showRewardedAd(placement);
    } catch (err) {
      console.warn('Rewarded ad error:', err);
      return { rewarded: false, reason: 'error' };
    }
  }

  async function showInterstitialAd(placement) {
    const caps = getCapabilities();
    if (!caps.interstitialAds || !activeAdapter || typeof activeAdapter.showInterstitialAd !== 'function') {
      return { shown: false, reason: 'unavailable' };
    }
    try {
      return await activeAdapter.showInterstitialAd(placement);
    } catch (err) {
      console.warn('Interstitial ad error:', err);
      return { shown: false, reason: 'error' };
    }
  }

  async function getProducts() {
    if (!activeAdapter || typeof activeAdapter.getProducts !== 'function') {
      return [];
    }
    try {
      const res = await activeAdapter.getProducts();
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('getProducts error:', err);
      return [];
    }
  }

  async function purchaseProduct(productId) {
    const caps = getCapabilities();
    if (!caps.iap || !activeAdapter || typeof activeAdapter.purchaseProduct !== 'function') {
      return { purchased: false, productId, entitlements: [], reason: 'unavailable' };
    }
    try {
      return await activeAdapter.purchaseProduct(productId);
    } catch (err) {
      console.warn('purchaseProduct error:', err);
      return { purchased: false, productId, entitlements: [], reason: 'error' };
    }
  }

  async function restorePurchases() {
    const caps = getCapabilities();
    if (!caps.restorePurchases || !activeAdapter || typeof activeAdapter.restorePurchases !== 'function') {
      return { restored: false, entitlements: [], reason: 'unavailable' };
    }
    try {
      return await activeAdapter.restorePurchases();
    } catch (err) {
      console.warn('restorePurchases error:', err);
      return { restored: false, entitlements: [], reason: 'error' };
    }
  }

  function getDataItem(key) {
    if (activeAdapter && typeof activeAdapter.getDataItem === 'function') {
      try {
        return activeAdapter.getDataItem(key);
      } catch (err) {
        console.warn('getDataItem error; falling back to localStorage:', err);
      }
    }
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function setDataItem(key, value) {
    const strVal = String(value);
    if (activeAdapter && typeof activeAdapter.setDataItem === 'function') {
      try {
        activeAdapter.setDataItem(key, strVal);
        return;
      } catch (err) {
        console.warn('setDataItem error; falling back to localStorage:', err);
      }
    }
    try {
      if (global.localStorage) global.localStorage.setItem(key, strVal);
    } catch (e) {}
  }

  function removeDataItem(key) {
    if (activeAdapter && typeof activeAdapter.removeDataItem === 'function') {
      try {
        activeAdapter.removeDataItem(key);
        return;
      } catch (err) {
        console.warn('removeDataItem error; falling back to localStorage:', err);
      }
    }
    try {
      if (global.localStorage) global.localStorage.removeItem(key);
    } catch (e) {}
  }

  VS.Platform = {
    registerAdapter,
    init,
    getAdapter,
    getAdapterId,
    getCapabilities,
    isDevEnvironment,
    isCrazyGamesEnvironment,
    isCrazyGamesMode,
    loadingStart,
    loadingStop,
    gameplayStart,
    gameplayStop,
    happyTime,
    showRewardedAd,
    showInterstitialAd,
    getProducts,
    purchaseProduct,
    restorePurchases,
    getDataItem,
    setDataItem,
    removeDataItem
  };
})(window);
