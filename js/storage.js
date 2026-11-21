(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  function loadSaveData() {
    const defaults = {
      levels: {},
      settings: { sound: true, showDpad: true, autoFollow: true }
    };

    try {
      const raw = global.localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          levels: parsed.levels || {},
          settings: Object.assign({}, defaults.settings, parsed.settings || {})
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

  function isLevelUnlocked(level) {
    if (!level || level.pack === 'custom') return true;
    return getTotalStars() >= (level.unlockStars || 0);
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

    saveData.levels[level.id] = {
      stars: Math.max(prevRec ? prevRec.stars : 0, result.stars),
      bestMoves: prevRec && prevRec.bestMoves ? Math.min(prevRec.bestMoves, moves) : moves,
      bestScore: Math.max(prevRec ? prevRec.bestScore : 0, result.score)
    };
    persistSaveData();

    return {
      stars: result.stars,
      score: result.score,
      par: result.par,
      prevStars,
      newStars: getTotalStars()
    };
  }

  function resetProgress() {
    saveData.levels = {};
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
    isLevelUnlocked,
    calculateStarsAndScore
  };
})(window);
