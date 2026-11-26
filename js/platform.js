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
  let backHandler = null;

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

  function isTelegramEnvironment() {
    const params = getSearchParams();
    if (params) {
      const p = params.get('platform') || params.get('adapter');
      if (p === 'telegram') return true;
    }

    try {
      const hash = global.location && typeof global.location.hash === 'string' ? global.location.hash : '';
      const search = global.location && typeof global.location.search === 'string' ? global.location.search : '';
      const queryBlob = `${search}&${hash}`;
      if (/(?:^|[?&#])tgWebApp(?:Data|Platform|Version)=/i.test(queryBlob)) {
        return true;
      }
    } catch (e) {}

    const tg = global.Telegram && global.Telegram.WebApp;
    if (tg) {
      if (typeof tg.initData === 'string' && tg.initData.length > 0) {
        return true;
      }
      const unsafe = tg.initDataUnsafe;
      if (unsafe && (unsafe.user || unsafe.query_id || unsafe.chat_instance)) {
        return true;
      }
      if (typeof tg.platform === 'string' && tg.platform !== '' && tg.platform !== 'unknown') {
        return true;
      }
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

    if (isTelegramEnvironment() && adapters.has('telegram')) {
      return 'telegram';
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
    if (activeAdapter && typeof activeAdapter.setBackHandler === 'function' && backHandler) {
      try {
        activeAdapter.setBackHandler(backHandler);
      } catch (e) {}
    }
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

  function isTelegramMode() {
    return getAdapterId() === 'telegram';
  }

  function isMobilePlatform() {
    if (activeAdapter && typeof activeAdapter.isMobilePlatform === 'function') {
      try {
        return Boolean(activeAdapter.isMobilePlatform());
      } catch (e) {}
    }
    try {
      if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) return true;
      if (global.navigator && global.navigator.maxTouchPoints > 0 && (global.innerWidth || 1200) <= 1024) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function haptic(type) {
    if (VS.Storage && typeof VS.Storage.getSettings === 'function') {
      const settings = VS.Storage.getSettings();
      if (settings && settings.haptics === false) return;
    }
    if (activeAdapter && typeof activeAdapter.haptic === 'function') {
      try {
        activeAdapter.haptic(type);
      } catch (e) {}
    }
  }

  function setThemeColor(headerHex, bgHex) {
    if (activeAdapter && typeof activeAdapter.setThemeColor === 'function') {
      try {
        activeAdapter.setThemeColor(headerHex, bgHex);
      } catch (e) {}
    }
  }

  function syncNavigation(canGoBack) {
    if (activeAdapter && typeof activeAdapter.syncNavigation === 'function') {
      try {
        activeAdapter.syncNavigation(Boolean(canGoBack));
      } catch (e) {}
    }
  }

  function setBackHandler(fn) {
    backHandler = typeof fn === 'function' ? fn : null;
    if (activeAdapter && typeof activeAdapter.setBackHandler === 'function') {
      try {
        activeAdapter.setBackHandler(backHandler);
      } catch (e) {}
    }
  }

  function getUserInfo() {
    if (activeAdapter && typeof activeAdapter.getUserInfo === 'function') {
      try {
        return activeAdapter.getUserInfo();
      } catch (e) {}
    }
    return null;
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
    isTelegramEnvironment,
    isTelegramMode,
    isMobilePlatform,
    haptic,
    setThemeColor,
    syncNavigation,
    setBackHandler,
    getUserInfo,
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
