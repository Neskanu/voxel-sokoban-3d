(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  const CATEGORY_EQUIP_KEY = {
    themes: 'theme',
    bots: 'bot',
    crates: 'crate'
  };

  function createDefaultEconomy() {
    return {
      coins: 0,
      isPro: false,
      proBonusClaimed: false,
      ownedPacks: [],
      owned: {
        themes: ['classic-warehouse'],
        bots: ['worker-bot'],
        crates: ['wood-crate']
      },
      equipped: {
        theme: 'classic-warehouse',
        bot: 'worker-bot',
        crate: 'wood-crate'
      },
      adUnlockedLevels: [],
      totalClears: 0,
      lastShopAdAt: 0
    };
  }

  function mergeUniqueStrings(defaults, saved) {
    const set = new Set(defaults);
    if (Array.isArray(saved)) {
      saved.forEach((item) => {
        if (typeof item === 'string' && item) set.add(item);
      });
    }
    return Array.from(set);
  }

  function mergeEconomy(rawEco) {
    const def = createDefaultEconomy();
    if (!rawEco || typeof rawEco !== 'object') return def;

    const rawOwned = rawEco.owned && typeof rawEco.owned === 'object' ? rawEco.owned : {};
    const rawEquipped = rawEco.equipped && typeof rawEco.equipped === 'object' ? rawEco.equipped : {};

    return {
      coins: typeof rawEco.coins === 'number' && Number.isFinite(rawEco.coins) ? Math.max(0, Math.floor(rawEco.coins)) : 0,
      isPro: Boolean(rawEco.isPro),
      proBonusClaimed: Boolean(rawEco.proBonusClaimed),
      ownedPacks: mergeUniqueStrings([], rawEco.ownedPacks),
      owned: {
        themes: mergeUniqueStrings(def.owned.themes, rawOwned.themes),
        bots: mergeUniqueStrings(def.owned.bots, rawOwned.bots),
        crates: mergeUniqueStrings(def.owned.crates, rawOwned.crates)
      },
      equipped: {
        theme: typeof rawEquipped.theme === 'string' && rawEquipped.theme ? rawEquipped.theme : def.equipped.theme,
        bot: typeof rawEquipped.bot === 'string' && rawEquipped.bot ? rawEquipped.bot : def.equipped.bot,
        crate: typeof rawEquipped.crate === 'string' && rawEquipped.crate ? rawEquipped.crate : def.equipped.crate
      },
      adUnlockedLevels: mergeUniqueStrings([], rawEco.adUnlockedLevels),
      totalClears: typeof rawEco.totalClears === 'number' && Number.isFinite(rawEco.totalClears) ? Math.max(0, Math.floor(rawEco.totalClears)) : 0,
      lastShopAdAt: typeof rawEco.lastShopAdAt === 'number' && Number.isFinite(rawEco.lastShopAdAt) ? Math.max(0, rawEco.lastShopAdAt) : 0
    };
  }

  function loadSaveData() {
    const defaults = {
      levels: {},
      settings: { sound: true, showDpad: true, autoFollow: true },
      economy: createDefaultEconomy()
    };

    try {
      const raw = global.localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
          settings: Object.assign({}, defaults.settings, parsed.settings || {}),
          economy: mergeEconomy(parsed.economy)
        };
      }

      // Migrate v1 completed level IDs if present
      const legacy = JSON.parse(global.localStorage.getItem(CONFIG.STORAGE_KEY_V1) || '[]');
      if (Array.isArray(legacy)) {
        legacy.forEach((id) => {
          defaults.levels[id] = { stars: 1, bestMoves: null, bestScore: 1000 };
        });
      }
    } catch (e) {
      // Ignore storage access or parse errors in restricted environments
    }

    return defaults;
  }

  const saveData = loadSaveData();

  function persistSaveData() {
    try {
      global.localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(saveData));
    } catch (e) {
      // Ignore storage write errors
    }
  }

  function getSettings() {
    return saveData.settings;
  }

  function updateSetting(key, value) {
    saveData.settings[key] = value;
    persistSaveData();
  }

  function getLevelRecord(levelId) {
    return saveData.levels[levelId] || null;
  }

  function getTotalStars() {
    return Object.values(saveData.levels).reduce((sum, rec) => sum + (rec.stars || 0), 0);
  }

  function getMaxStars() {
    return VS.Levels.count() * 3;
  }

  function getTotalScore() {
    return Object.values(saveData.levels).reduce((sum, rec) => sum + (rec.bestScore || 0), 0);
  }

  function isPackOwned(packId) {
    if (!packId) return false;
    return Boolean(saveData.economy.isPro || saveData.economy.ownedPacks.includes(packId));
  }

  const FREE_PACK_IDS = new Set(['starter', 'classic', 'custom']);

  function getLevelLockInfo(level) {
    if (!level || level.pack === 'custom') {
      return { unlocked: true, reason: null };
    }
    const packId =
      level.premiumPackId ||
      (level.pack && !FREE_PACK_IDS.has(level.pack) ? level.pack : null);
    if (packId) {
      if (level.freePreview || isPackOwned(packId)) {
        return { unlocked: true, reason: null };
      }
      return { unlocked: false, reason: 'pack', packId };
    }
    if (saveData.economy.isPro || saveData.economy.adUnlockedLevels.includes(level.id)) {
      return { unlocked: true, reason: null };
    }
    const requiredStars = level.unlockStars || 0;
    const totalStars = getTotalStars();
    if (totalStars >= requiredStars) {
      return { unlocked: true, reason: null };
    }
    return {
      unlocked: false,
      reason: 'stars',
      requiredStars,
      missingStars: requiredStars - totalStars
    };
  }

  function isLevelUnlocked(level) {
    return getLevelLockInfo(level).unlocked;
  }

  function calculateStarsAndScore(level, moves) {
    const par = level.par || 50;
    let stars = 1;
    if (moves <= par) {
      stars = 3;
    } else if (moves <= Math.ceil(par * CONFIG.STAR_TWO_PAR_MULT)) {
      stars = 2;
    }

    const efficiencyBonus = Math.max(
      0,
      Math.round((par * CONFIG.SCORE_PAR_MULT - moves) * CONFIG.SCORE_EFFICIENCY_STEP)
    );
    const score = stars * 1000 + efficiencyBonus;
    return { stars, score, par };
  }

  function recordWin(level, moves) {
    const prevStars = getTotalStars();
    const result = calculateStarsAndScore(level, moves);
    const prevRec = saveData.levels[level.id];
    const prevLevelStars = prevRec ? (prevRec.stars || 0) : 0;

    let baseCoinsEarned = 0;
    let coinsEarned = 0;
    let proAutoDoubled = false;

    if (level.pack !== 'custom') {
      const firstClearCoins = prevRec ? 0 : CONFIG.COIN_FIRST_CLEAR;
      const starDelta = Math.max(0, result.stars - prevLevelStars);
      baseCoinsEarned = firstClearCoins + starDelta * CONFIG.COIN_PER_STAR;
      proAutoDoubled = Boolean(saveData.economy.isPro && baseCoinsEarned > 0);
      coinsEarned = proAutoDoubled ? baseCoinsEarned * 2 : baseCoinsEarned;
      saveData.economy.coins += coinsEarned;
      saveData.economy.totalClears += 1;
    }

    saveData.levels[level.id] = {
      stars: Math.max(prevLevelStars, result.stars),
      bestMoves: prevRec && prevRec.bestMoves ? Math.min(prevRec.bestMoves, moves) : moves,
      bestScore: Math.max(prevRec ? prevRec.bestScore : 0, result.score)
    };
    persistSaveData();

    return {
      stars: result.stars,
      score: result.score,
      par: result.par,
      prevStars,
      newStars: getTotalStars(),
      baseCoinsEarned,
      coinsEarned,
      proAutoDoubled
    };
  }

  function resetProgress() {
    // Only clear level stars/scores; preserve Pro ownership, purchased packs, cosmetics, and coins
    saveData.levels = {};
    persistSaveData();
  }

  function getEconomy() {
    return saveData.economy;
  }

  function getCoins() {
    return saveData.economy.coins;
  }

  function addCoins(amount) {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return saveData.economy.coins;
    saveData.economy.coins += n;
    persistSaveData();
    return saveData.economy.coins;
  }

  function spendCoins(amount) {
    const n = Math.floor(Number(amount) || 0);
    if (n < 0 || saveData.economy.coins < n) return false;
    saveData.economy.coins -= n;
    persistSaveData();
    return true;
  }

  function isPro() {
    return Boolean(saveData.economy.isPro);
  }

  function setPro(val) {
    saveData.economy.isPro = Boolean(val);
    persistSaveData();
  }

  function isProBonusClaimed() {
    return Boolean(saveData.economy.proBonusClaimed);
  }

  function markProBonusClaimed() {
    saveData.economy.proBonusClaimed = true;
    persistSaveData();
  }

  function getOwnedPacks() {
    return saveData.economy.ownedPacks.slice();
  }

  function unlockPack(packId) {
    if (!packId || saveData.economy.ownedPacks.includes(packId)) return;
    saveData.economy.ownedPacks.push(packId);
    persistSaveData();
  }

  function isCosmeticOwned(category, id) {
    const list = saveData.economy.owned[category];
    return Array.isArray(list) ? list.includes(id) : false;
  }

  function unlockCosmetic(category, id) {
    const list = saveData.economy.owned[category];
    if (!Array.isArray(list) || !id) return;
    if (!list.includes(id)) {
      list.push(id);
      persistSaveData();
    }
  }

  function getEquippedCosmetic(category) {
    const key = CATEGORY_EQUIP_KEY[category];
    return key ? saveData.economy.equipped[key] : null;
  }

  function setEquippedCosmetic(category, id) {
    const key = CATEGORY_EQUIP_KEY[category];
    if (!key || !id) return;
    saveData.economy.equipped[key] = id;
    persistSaveData();
  }

  function unlockLevelByAd(levelId) {
    if (!levelId || saveData.economy.adUnlockedLevels.includes(levelId)) return;
    saveData.economy.adUnlockedLevels.push(levelId);
    persistSaveData();
  }

  function getTotalClears() {
    return saveData.economy.totalClears;
  }

  function getLastShopAdAt() {
    return saveData.economy.lastShopAdAt || 0;
  }

  function setLastShopAdAt(ts) {
    saveData.economy.lastShopAdAt = Math.max(0, Number(ts) || 0);
    persistSaveData();
  }

  function resetMockEconomy() {
    saveData.economy = createDefaultEconomy();
    persistSaveData();
  }

  VS.Storage = {
    getSettings,
    updateSetting,
    getLevelRecord,
    recordWin,
    resetProgress,
    getTotalStars,
    getMaxStars,
    getTotalScore,
    isPackOwned,
    getLevelLockInfo,
    isLevelUnlocked,
    calculateStarsAndScore,
    getEconomy,
    getCoins,
    addCoins,
    spendCoins,
    isPro,
    setPro,
    isProBonusClaimed,
    markProBonusClaimed,
    getOwnedPacks,
    unlockPack,
    isCosmeticOwned,
    unlockCosmetic,
    getEquippedCosmetic,
    setEquippedCosmetic,
    unlockLevelByAd,
    getTotalClears,
    getLastShopAdAt,
    setLastShopAdAt,
    resetMockEconomy
  };
})(window);
