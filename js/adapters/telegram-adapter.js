(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);
  const CLOUD_META_KEY = 'vs_s2_meta';
  const CLOUD_CHUNK_PREFIX = 'vs_s2_';
  const CLOUD_CHUNK_MAX_BYTES = 3200;
  const CLOUD_HYDRATE_TIMEOUT_MS = 2500;
  const CLOUD_FLUSH_DEBOUNCE_MS = 350;

  let initialized = false;
  let eventsBound = false;
  let backHandler = null;
  let cloudSaveEnabled = false;
  let flushTimer = null;
  let flushQueue = Promise.resolve();
  let lastCloudChunkCount = 0;
  const memoryCache = new Map();

  function getTg() {
    return (global.Telegram && global.Telegram.WebApp) || null;
  }

  function versionAtLeast(tg, ver) {
    if (!tg || typeof tg.isVersionAtLeast !== 'function') return false;
    try {
      return Boolean(tg.isVersionAtLeast(ver));
    } catch (e) {
      return false;
    }
  }

  function getStorageKey() {
    return (VS.CONFIG && VS.CONFIG.STORAGE_KEY) || 'voxel_sokoban_save_v2';
  }

  function getLegacyStorageKey() {
    return (VS.CONFIG && VS.CONFIG.STORAGE_KEY_V1) || 'voxel_sokoban_done_v1';
  }

  function isAllowedApiBase(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return /^https:\/\/.+/i.test(trimmed) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed);
  }

  function getApiBase() {
    let candidate = '';
    if (typeof global.VOXEL_SOKOBAN_TELEGRAM_API_BASE === 'string') {
      candidate = global.VOXEL_SOKOBAN_TELEGRAM_API_BASE.trim();
    }
    if (!candidate) {
      try {
        if (global.location && global.location.search) {
          const params = new global.URLSearchParams(global.location.search);
          const paramBase = params.get('apiBase');
          if (paramBase && isAllowedApiBase(paramBase)) {
            candidate = paramBase.trim();
          }
        }
      } catch (e) {}
    }
    if (!candidate && VS.CONFIG && typeof VS.CONFIG.TELEGRAM_API_BASE === 'string') {
      candidate = VS.CONFIG.TELEGRAM_API_BASE.trim();
    }
    if (!isAllowedApiBase(candidate)) return '';
    return candidate.replace(/\/+$/, '');
  }

  function isMobilePlatform() {
    const tg = getTg();
    const plat = tg && typeof tg.platform === 'string' ? tg.platform.toLowerCase() : '';
    if (plat && plat !== 'unknown') {
      return MOBILE_PLATFORMS.has(plat);
    }
    try {
      if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) return true;
      if (global.navigator && global.navigator.maxTouchPoints > 0 && (global.innerWidth || 1200) <= 1024) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function readLocalItem(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocalItem(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function removeLocalItem(key) {
    try {
      if (global.localStorage) global.localStorage.removeItem(key);
    } catch (e) {}
  }

  function utf8ByteLength(str) {
    if (typeof global.TextEncoder === 'function') {
      return new global.TextEncoder().encode(str).length;
    }
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function chunkStringByUtf8Bytes(str, maxBytes) {
    if (!str) return [''];
    const chunks = [];
    let start = 0;
    let curBytes = 0;

    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      let charLen = 1;
      let charBytes = 1;
      if (code < 0x80) {
        charBytes = 1;
      } else if (code < 0x800) {
        charBytes = 2;
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        charLen = 2;
        charBytes = 4;
      } else {
        charBytes = 3;
      }

      if (curBytes + charBytes > maxBytes && i > start) {
        chunks.push(str.slice(start, i));
        start = i;
        curBytes = 0;
      }

      curBytes += charBytes;
      if (charLen === 2) {
        i += 1;
      }
    }

    if (start < str.length) {
      chunks.push(str.slice(start));
    }
    return chunks.length ? chunks : [''];
  }

  function cloudGetItem(cloud, key) {
    return new Promise((resolve, reject) => {
      try {
        cloud.getItem(key, (err, value) => {
          if (err) reject(err);
          else resolve(value === undefined ? null : value);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function cloudGetItems(cloud, keys) {
    if (!keys.length) return Promise.resolve({});
    if (typeof cloud.getItems === 'function') {
      return new Promise((resolve, reject) => {
        try {
          cloud.getItems(keys, (err, values) => {
            if (err) reject(err);
            else resolve(values || {});
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    return Promise.all(
      keys.map((k) =>
        cloudGetItem(cloud, k).then((v) => [k, v])
      )
    ).then((pairs) => {
      const out = {};
      pairs.forEach(([k, v]) => {
        if (v !== null && v !== undefined) out[k] = v;
      });
      return out;
    });
  }

  function cloudSetItem(cloud, key, value) {
    return new Promise((resolve, reject) => {
      try {
        cloud.setItem(key, value, (err, ok) => {
          if (err) reject(err);
          else resolve(Boolean(ok));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function cloudRemoveItems(cloud, keys) {
    if (!keys.length) return Promise.resolve(true);
    if (typeof cloud.removeItems === 'function') {
      return new Promise((resolve, reject) => {
        try {
          cloud.removeItems(keys, (err, ok) => {
            if (err) reject(err);
            else resolve(Boolean(ok));
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    if (typeof cloud.removeItem === 'function') {
      return Promise.all(
        keys.map(
          (k) =>
            new Promise((resolve) => {
              try {
                cloud.removeItem(k, () => resolve());
              } catch (e) {
                resolve();
              }
            })
        )
      ).then(() => true);
    }
    return Promise.resolve(false);
  }

  function cloudGetKeys(cloud) {
    if (typeof cloud.getKeys !== 'function') return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        cloud.getKeys((err, keys) => {
          if (err || !Array.isArray(keys)) resolve([]);
          else resolve(keys);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  function unionStrings(a, b) {
    const set = new Set();
    if (Array.isArray(a)) a.forEach((v) => { if (typeof v === 'string' && v) set.add(v); });
    if (Array.isArray(b)) b.forEach((v) => { if (typeof v === 'string' && v) set.add(v); });
    return Array.from(set);
  }

  function mergeSavePayloads(localJson, cloudJson) {
    let localData = null;
    let cloudData = null;
    try {
      if (localJson) localData = JSON.parse(localJson);
    } catch (e) {}
    try {
      if (cloudJson) cloudData = JSON.parse(cloudJson);
    } catch (e) {}

    if (!cloudData || typeof cloudData !== 'object') return localJson || null;
    if (!localData || typeof localData !== 'object') return cloudJson || null;

    const mergedLevels = {};
    const localLevels = localData.levels && typeof localData.levels === 'object' ? localData.levels : {};
    const cloudLevels = cloudData.levels && typeof cloudData.levels === 'object' ? cloudData.levels : {};
    const allLevelIds = new Set([...Object.keys(localLevels), ...Object.keys(cloudLevels)]);

    allLevelIds.forEach((id) => {
      const l = localLevels[id];
      const c = cloudLevels[id];
      if (!l) {
        mergedLevels[id] = c;
      } else if (!c) {
        mergedLevels[id] = l;
      } else {
        const moves = [];
        if (typeof l.bestMoves === 'number' && l.bestMoves > 0) moves.push(l.bestMoves);
        if (typeof c.bestMoves === 'number' && c.bestMoves > 0) moves.push(c.bestMoves);
        mergedLevels[id] = {
          stars: Math.max(Number(l.stars) || 0, Number(c.stars) || 0),
          bestMoves: moves.length ? Math.min(...moves) : null,
          bestScore: Math.max(Number(l.bestScore) || 0, Number(c.bestScore) || 0)
        };
      }
    });

    const localSettings = localData.settings && typeof localData.settings === 'object' ? localData.settings : {};
    const cloudSettings = cloudData.settings && typeof cloudData.settings === 'object' ? cloudData.settings : {};
    const mergedSettings = Object.assign({}, localSettings, cloudSettings);

    const le = localData.economy && typeof localData.economy === 'object' ? localData.economy : {};
    const ce = cloudData.economy && typeof cloudData.economy === 'object' ? cloudData.economy : {};
    const lOwned = le.owned && typeof le.owned === 'object' ? le.owned : {};
    const cOwned = ce.owned && typeof ce.owned === 'object' ? ce.owned : {};
    const lEquipped = le.equipped && typeof le.equipped === 'object' ? le.equipped : {};
    const cEquipped = ce.equipped && typeof ce.equipped === 'object' ? ce.equipped : {};

    const mergedEconomy = {
      coins: Math.max(Number(le.coins) || 0, Number(ce.coins) || 0),
      isPro: Boolean(le.isPro || ce.isPro),
      proBonusClaimed: Boolean(le.proBonusClaimed || ce.proBonusClaimed),
      ownedPacks: unionStrings(le.ownedPacks, ce.ownedPacks),
      owned: {
        themes: unionStrings(lOwned.themes, cOwned.themes),
        bots: unionStrings(lOwned.bots, cOwned.bots),
        crates: unionStrings(lOwned.crates, cOwned.crates)
      },
      equipped: Object.assign({}, lEquipped, cEquipped),
      adUnlockedLevels: unionStrings(le.adUnlockedLevels, ce.adUnlockedLevels),
      totalClears: Math.max(Number(le.totalClears) || 0, Number(ce.totalClears) || 0),
      lastShopAdAt: Math.max(Number(le.lastShopAdAt) || 0, Number(ce.lastShopAdAt) || 0)
    };

    return JSON.stringify({
      levels: mergedLevels,
      settings: mergedSettings,
      economy: mergedEconomy
    });
  }

  async function hydrateFromCloudStorage() {
    const tg = getTg();
    if (!cloudSaveEnabled || !tg || !tg.CloudStorage) return;
    const cloud = tg.CloudStorage;
    const storageKey = getStorageKey();

    try {
      const metaRaw = await cloudGetItem(cloud, CLOUD_META_KEY);
      let cloudJson = null;

      if (typeof metaRaw === 'string' && metaRaw.trim()) {
        const meta = JSON.parse(metaRaw);
        const count = meta && Number.isInteger(meta.n) && meta.n > 0 ? meta.n : 0;
        if (count > 0) {
          lastCloudChunkCount = count;
          const chunkKeys = [];
          for (let i = 0; i < count; i++) {
            chunkKeys.push(`${CLOUD_CHUNK_PREFIX}${i}`);
          }
          const chunkMap = await cloudGetItems(cloud, chunkKeys);
          let assembled = '';
          let complete = true;
          for (let i = 0; i < count; i++) {
            const part = chunkMap[`${CLOUD_CHUNK_PREFIX}${i}`];
            if (typeof part !== 'string') {
              complete = false;
              break;
            }
            assembled += part;
          }
          if (complete && assembled) {
            JSON.parse(assembled);
            cloudJson = assembled;
          }
        }
      }

      const localJson = memoryCache.get(storageKey) || null;
      if (cloudJson && localJson) {
        const merged = mergeSavePayloads(localJson, cloudJson);
        if (merged) {
          memoryCache.set(storageKey, merged);
          writeLocalItem(storageKey, merged);
          if (merged !== cloudJson) {
            scheduleCloudFlush();
          }
        }
      } else if (cloudJson) {
        memoryCache.set(storageKey, cloudJson);
        writeLocalItem(storageKey, cloudJson);
      } else if (localJson) {
        scheduleCloudFlush();
      }
    } catch (err) {
      console.warn('[Telegram] CloudStorage hydration skipped:', err);
    }
  }

  function flushCloudSave() {
    if (flushTimer) {
      global.clearTimeout(flushTimer);
      flushTimer = null;
    }
    const tg = getTg();
    if (!cloudSaveEnabled || !tg || !tg.CloudStorage) {
      return Promise.resolve(false);
    }
    const cloud = tg.CloudStorage;
    const storageKey = getStorageKey();
    const payload = memoryCache.get(storageKey);

    flushQueue = flushQueue
      .then(async () => {
        if (!payload) return false;
        const chunks = chunkStringByUtf8Bytes(payload, CLOUD_CHUNK_MAX_BYTES);
        for (let i = 0; i < chunks.length; i++) {
          if (utf8ByteLength(chunks[i]) > 4096) {
            throw new Error('CloudStorage chunk exceeds 4096 bytes');
          }
          await cloudSetItem(cloud, `${CLOUD_CHUNK_PREFIX}${i}`, chunks[i]);
        }
        const meta = JSON.stringify({ v: 1, n: chunks.length, ts: Date.now() });
        await cloudSetItem(cloud, CLOUD_META_KEY, meta);

        if (lastCloudChunkCount > chunks.length) {
          const staleKeys = [];
          for (let i = chunks.length; i < lastCloudChunkCount; i++) {
            staleKeys.push(`${CLOUD_CHUNK_PREFIX}${i}`);
          }
          await cloudRemoveItems(cloud, staleKeys);
        }
        lastCloudChunkCount = chunks.length;
        return true;
      })
      .catch((err) => {
        console.warn('[Telegram] CloudStorage flush failed:', err);
        return false;
      });

    return flushQueue;
  }

  function scheduleCloudFlush() {
    if (!cloudSaveEnabled) return;
    if (flushTimer) {
      global.clearTimeout(flushTimer);
    }
    flushTimer = global.setTimeout(() => {
      flushTimer = null;
      flushCloudSave();
    }, CLOUD_FLUSH_DEBOUNCE_MS);
  }

  async function clearCloudSave() {
    if (flushTimer) {
      global.clearTimeout(flushTimer);
      flushTimer = null;
    }
    const tg = getTg();
    if (!cloudSaveEnabled || !tg || !tg.CloudStorage) return;
    const cloud = tg.CloudStorage;
    flushQueue = flushQueue
      .then(async () => {
        const keys = await cloudGetKeys(cloud);
        const toRemove = new Set(keys.filter((k) => k === CLOUD_META_KEY || k.startsWith(CLOUD_CHUNK_PREFIX)));
        toRemove.add(CLOUD_META_KEY);
        for (let i = 0; i < lastCloudChunkCount; i++) {
          toRemove.add(`${CLOUD_CHUNK_PREFIX}${i}`);
        }
        await cloudRemoveItems(cloud, Array.from(toRemove));
        lastCloudChunkCount = 0;
      })
      .catch((err) => {
        console.warn('[Telegram] CloudStorage clear failed:', err);
      });
    return flushQueue;
  }

  function syncSafeAreas() {
    const tg = getTg();
    const doc = global.document;
    if (!doc || !doc.documentElement) return;
    const root = doc.documentElement;

    const sa = (tg && tg.safeAreaInset) || {};
    const csa = (tg && tg.contentSafeAreaInset) || {};

    const top = Math.max(0, (Number(sa.top) || 0) + (Number(csa.top) || 0));
    const bottom = Math.max(0, (Number(sa.bottom) || 0) + (Number(csa.bottom) || 0));
    const left = Math.max(0, (Number(sa.left) || 0) + (Number(csa.left) || 0));
    const right = Math.max(0, (Number(sa.right) || 0) + (Number(csa.right) || 0));

    root.style.setProperty('--tg-safe-top', `${Math.round(top)}px`);
    root.style.setProperty('--tg-safe-bottom', `${Math.round(bottom)}px`);
    root.style.setProperty('--tg-safe-left', `${Math.round(left)}px`);
    root.style.setProperty('--tg-safe-right', `${Math.round(right)}px`);

    if (tg && typeof tg.viewportStableHeight === 'number' && tg.viewportStableHeight > 0) {
      root.style.setProperty('--app-height', `${Math.round(tg.viewportStableHeight)}px`);
    } else {
      root.style.setProperty('--app-height', '100dvh');
    }

    root.classList.toggle('telegram-fullscreen', Boolean(tg && tg.isFullscreen));

    if (VS.Renderer && typeof VS.Renderer.onWindowResize === 'function') {
      try {
        VS.Renderer.onWindowResize();
      } catch (e) {}
    }
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const tg = getTg();

    if (tg && typeof tg.onEvent === 'function') {
      const onViewport = () => syncSafeAreas();
      try { tg.onEvent('viewportChanged', onViewport); } catch (e) {}
      try { tg.onEvent('safeAreaChanged', onViewport); } catch (e) {}
      try { tg.onEvent('contentSafeAreaChanged', onViewport); } catch (e) {}
      try { tg.onEvent('fullscreenChanged', onViewport); } catch (e) {}
      try { tg.onEvent('fullscreenFailed', onViewport); } catch (e) {}

      try {
        tg.onEvent('deactivated', () => {
          flushCloudSave();
          if (VS.Sound && typeof VS.Sound.setPlatformMuted === 'function') {
            VS.Sound.setPlatformMuted(true);
          }
        });
      } catch (e) {}

      try {
        tg.onEvent('activated', () => {
          if (VS.Sound && typeof VS.Sound.setPlatformMuted === 'function') {
            VS.Sound.setPlatformMuted(false);
          }
          syncSafeAreas();
        });
      } catch (e) {}
    }

    if (tg && tg.BackButton && versionAtLeast(tg, '6.1') && typeof tg.BackButton.onClick === 'function') {
      try {
        tg.BackButton.onClick(() => {
          if (typeof backHandler === 'function') {
            backHandler();
          }
        });
      } catch (e) {}
    }

    if (typeof global.addEventListener === 'function') {
      global.addEventListener('pagehide', () => {
        flushCloudSave();
      });
    }
    if (global.document && typeof global.document.addEventListener === 'function') {
      global.document.addEventListener('visibilitychange', () => {
        if (global.document.hidden) {
          flushCloudSave();
        }
      });
    }
  }

  async function postApiJson(path, body) {
    const apiBase = getApiBase();
    if (!apiBase || typeof global.fetch !== 'function') {
      throw new Error('api_unavailable');
    }
    const tg = getTg();
    const initData = (tg && typeof tg.initData === 'string' && tg.initData) || '';
    const res = await global.fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData
      },
      body: JSON.stringify(Object.assign({ initData }, body || {}))
    });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    return res.json();
  }

  async function fetchServerEntitlements() {
    const path = (VS.CONFIG && VS.CONFIG.TELEGRAM_ENTITLEMENTS_PATH) || '/api/telegram/entitlements';
    const data = await postApiJson(path, {});
    return Array.isArray(data && data.entitlements) ? data.entitlements : [];
  }

  const telegramAdapter = {
    id: 'telegram',
    name: 'Telegram Mini App',
    capabilities: {
      rewardedAds: false,
      interstitialAds: false,
      iap: false,
      restorePurchases: false,
      cloudSave: false
    },

    async init() {
      const storageKey = getStorageKey();
      const legacyKey = getLegacyStorageKey();
      const localMain = readLocalItem(storageKey);
      const localLegacy = readLocalItem(legacyKey);
      if (localMain !== null) memoryCache.set(storageKey, localMain);
      if (localLegacy !== null) memoryCache.set(legacyKey, localLegacy);

      const tg = getTg();
      const hasIapBackend = Boolean(getApiBase()) && Boolean(tg && typeof tg.openInvoice === 'function');
      cloudSaveEnabled = Boolean(tg && tg.CloudStorage && versionAtLeast(tg, '6.9'));

      telegramAdapter.capabilities.iap = hasIapBackend;
      telegramAdapter.capabilities.restorePurchases = hasIapBackend;
      telegramAdapter.capabilities.cloudSave = cloudSaveEnabled;

      if (global.document && global.document.documentElement) {
        global.document.documentElement.classList.add('telegram-mini-app');
      }

      if (tg) {
        try {
          if (typeof tg.ready === 'function') tg.ready();
        } catch (e) {}
        try {
          if (typeof tg.expand === 'function') tg.expand();
        } catch (e) {}
        if (versionAtLeast(tg, '7.7') && typeof tg.disableVerticalSwipes === 'function') {
          try {
            tg.disableVerticalSwipes();
          } catch (e) {}
        }
        if (isMobilePlatform() && versionAtLeast(tg, '8.0') && typeof tg.requestFullscreen === 'function') {
          try {
            tg.requestFullscreen();
          } catch (e) {}
        }
        telegramAdapter.setThemeColor('#0f172a', '#020617');
      }

      bindEvents();
      syncSafeAreas();

      if (cloudSaveEnabled) {
        let timeoutId = null;
        await Promise.race([
          hydrateFromCloudStorage(),
          new Promise((resolve) => {
            timeoutId = global.setTimeout(resolve, CLOUD_HYDRATE_TIMEOUT_MS);
          })
        ]);
        if (timeoutId) {
          global.clearTimeout(timeoutId);
        }
      }

      initialized = true;
      return true;
    },

    loadingStart() {},
    loadingStop() {},
    gameplayStart() {},
    gameplayStop() {},
    happyTime() {
      telegramAdapter.haptic('win');
    },

    isMobilePlatform,

    setThemeColor(headerHex, bgHex) {
      const tg = getTg();
      if (!tg) return;
      if (headerHex && versionAtLeast(tg, '6.9') && typeof tg.setHeaderColor === 'function') {
        try {
          tg.setHeaderColor(headerHex);
        } catch (e) {}
      }
      if (bgHex && versionAtLeast(tg, '6.1') && typeof tg.setBackgroundColor === 'function') {
        try {
          tg.setBackgroundColor(bgHex);
        } catch (e) {}
      }
      if (bgHex && versionAtLeast(tg, '7.10') && typeof tg.setBottomBarColor === 'function') {
        try {
          tg.setBottomBarColor(bgHex);
        } catch (e) {}
      }
    },

    syncNavigation(canGoBack) {
      const tg = getTg();
      if (!tg || !tg.BackButton || !versionAtLeast(tg, '6.1')) return;
      try {
        if (canGoBack) {
          if (typeof tg.BackButton.show === 'function') tg.BackButton.show();
        } else if (typeof tg.BackButton.hide === 'function') {
          tg.BackButton.hide();
        }
      } catch (e) {}
    },

    setBackHandler(fn) {
      backHandler = typeof fn === 'function' ? fn : null;
    },

    haptic(type) {
      const tg = getTg();
      if (!tg || !tg.HapticFeedback || !versionAtLeast(tg, '6.1')) return;
      const hf = tg.HapticFeedback;
      try {
        if (type === 'step') {
          if (typeof hf.impactOccurred === 'function') hf.impactOccurred('light');
        } else if (type === 'push') {
          if (typeof hf.impactOccurred === 'function') hf.impactOccurred('medium');
        } else if (type === 'bump') {
          if (typeof hf.impactOccurred === 'function') hf.impactOccurred('rigid');
        } else if (type === 'deadlock') {
          if (typeof hf.notificationOccurred === 'function') hf.notificationOccurred('warning');
        } else if (type === 'goal' || type === 'win') {
          if (typeof hf.notificationOccurred === 'function') hf.notificationOccurred('success');
        } else if (type === 'error') {
          if (typeof hf.notificationOccurred === 'function') hf.notificationOccurred('error');
        } else if (type === 'undo' || type === 'select' || type === 'ui') {
          if (typeof hf.selectionChanged === 'function') hf.selectionChanged();
        }
      } catch (e) {}
    },

    getUserInfo() {
      const tg = getTg();
      const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (!user) return null;
      return {
        id: user.id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        username: user.username || '',
        languageCode: user.language_code || ''
      };
    },

    async getProducts() {
      if (!telegramAdapter.capabilities.iap) return [];
      const list = VS.CONFIG && Array.isArray(VS.CONFIG.TELEGRAM_PRODUCTS) ? VS.CONFIG.TELEGRAM_PRODUCTS : [];
      return list.map((p) => Object.assign({}, p));
    },

    async purchaseProduct(productId) {
      const tg = getTg();
      if (!telegramAdapter.capabilities.iap || !tg || typeof tg.openInvoice !== 'function') {
        return { purchased: false, productId, entitlements: [], reason: 'unavailable' };
      }

      try {
        const path = (VS.CONFIG && VS.CONFIG.TELEGRAM_CREATE_INVOICE_PATH) || '/api/telegram/create-invoice';
        const data = await postApiJson(path, { productId });
        const invoiceUrl = data && (data.invoiceUrl || data.invoice_url || data.url);
        if (!invoiceUrl || typeof invoiceUrl !== 'string') {
          return { purchased: false, productId, entitlements: [], reason: 'invalid_invoice' };
        }

        return await new Promise((resolve) => {
          let settled = false;
          const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
          };

          try {
            tg.openInvoice(invoiceUrl, async (status) => {
              if (status === 'paid') {
                let serverEntitlements = [];
                try {
                  serverEntitlements = await fetchServerEntitlements();
                } catch (e) {}
                const merged = Array.from(new Set([...serverEntitlements, productId]));
                telegramAdapter.haptic('win');
                finish({ purchased: true, productId, entitlements: merged });
              } else if (status === 'cancelled') {
                finish({ purchased: false, productId, entitlements: [], reason: 'cancelled' });
              } else {
                telegramAdapter.haptic('error');
                finish({ purchased: false, productId, entitlements: [], reason: status || 'failed' });
              }
            });
          } catch (err) {
            console.warn('[Telegram] openInvoice threw:', err);
            telegramAdapter.haptic('error');
            finish({ purchased: false, productId, entitlements: [], reason: 'error' });
          }
        });
      } catch (err) {
        console.warn('[Telegram] purchaseProduct failed:', err);
        telegramAdapter.haptic('error');
        return { purchased: false, productId, entitlements: [], reason: 'error' };
      }
    },

    async restorePurchases() {
      if (!telegramAdapter.capabilities.restorePurchases) {
        return { restored: false, entitlements: [], reason: 'unavailable' };
      }
      try {
        const entitlements = await fetchServerEntitlements();
        if (!entitlements.length) {
          return { restored: false, entitlements: [], reason: 'no_purchases' };
        }
        return { restored: true, entitlements };
      } catch (err) {
        console.warn('[Telegram] restorePurchases failed:', err);
        return { restored: false, entitlements: [], reason: 'error' };
      }
    },

    getDataItem(key) {
      if (memoryCache.has(key)) {
        return memoryCache.get(key);
      }
      const localVal = readLocalItem(key);
      if (localVal !== null) {
        memoryCache.set(key, localVal);
      }
      return localVal;
    },

    setDataItem(key, value) {
      const strVal = String(value);
      memoryCache.set(key, strVal);
      writeLocalItem(key, strVal);
      if (key === getStorageKey() && cloudSaveEnabled) {
        scheduleCloudFlush();
      }
    },

    removeDataItem(key) {
      memoryCache.delete(key);
      removeLocalItem(key);
      if (key === getStorageKey() && cloudSaveEnabled) {
        clearCloudSave();
      }
    },

    flushCloudSave,
    mergeSavePayloads,
    syncSafeAreas,
    isInitialized: () => initialized
  };

  if (VS.Platform && typeof VS.Platform.registerAdapter === 'function') {
    VS.Platform.registerAdapter(telegramAdapter);
  }
  VS.TelegramAdapter = telegramAdapter;
})(window);
