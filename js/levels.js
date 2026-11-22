(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  // Legend: '#' = Wall, '.' = Target Pad, '$' = Crate, '@' = Player,
  //         '*' = Crate on Target, '+' = Player on Target, ' ' = Floor
  const FREE_PACKS = new Set(['starter', 'classic']);

  const PACK_PREFIXES = {
    starter: 'S',
    classic: 'C',
    'neon-vault': 'N',
    'frost-citadel': 'F',
    'sandstone-labyrinth': 'D',
    grandmaster: 'G',
    custom: 'X'
  };

  const PREMIUM_PACKS = {
    'neon-vault': {
      id: 'neon-vault',
      productId: 'pack_neon_vault',
      name: 'Neon Vault',
      shortName: 'Neon Vault',
      subtitle: '100 tactical cyber-warehouse puzzles',
      difficulty: 'Medium-Hard',
      defaultPrice: '$1.99',
      fallbackCoinPrice: 600,
      unlockStars: 120,
      accent: 'sky'
    },
    'frost-citadel': {
      id: 'frost-citadel',
      productId: 'pack_frost_citadel',
      name: 'Frost Citadel',
      shortName: 'Frost Citadel',
      subtitle: '100 precision ice-corridor challenges',
      difficulty: 'Hard',
      defaultPrice: '$2.49',
      fallbackCoinPrice: 900,
      unlockStars: 300,
      accent: 'cyan'
    },
    'sandstone-labyrinth': {
      id: 'sandstone-labyrinth',
      productId: 'pack_sandstone_labyrinth',
      name: 'Sandstone Labyrinth',
      shortName: 'Sandstone',
      subtitle: '100 tight desert-temple puzzle vaults',
      difficulty: 'Expert',
      defaultPrice: '$2.99',
      fallbackCoinPrice: 1200,
      unlockStars: 500,
      accent: 'orange'
    },
    grandmaster: {
      id: 'grandmaster',
      productId: 'pack_grandmaster',
      name: 'Grandmaster',
      shortName: 'Grandmaster',
      subtitle: '100 deep multi-stage logic chambers',
      difficulty: 'Grandmaster',
      defaultPrice: '$3.49',
      fallbackCoinPrice: 1500,
      unlockStars: 750,
      accent: 'amber'
    }
  };

  const packCounters = {};

  function hydrateLevel(entry, idx) {
    const isFree = FREE_PACKS.has(entry.pack);
    const map = Array.isArray(entry.map)
      ? entry.map.slice()
      : String(entry.map || '').split('|');
    const packNum = (packCounters[entry.pack] || 0) + 1;
    packCounters[entry.pack] = packNum;

    return {
      id: entry.id,
      pack: entry.pack,
      name: entry.name,
      par: entry.par,
      diff: entry.diff,
      crates: entry.crates,
      map,
      rank: idx + 1,
      packIndex: packNum,
      unlockStars: 0,
      premiumPackId: isFree ? null : entry.pack,
      freePreview: false
    };
  }

  const rawData = Array.isArray(VS.LEVEL_DATA) ? VS.LEVEL_DATA : [];
  let levels = rawData.map(hydrateLevel);

  function getAll() {
    return levels;
  }

  function get(index) {
    return levels[index] || null;
  }

  function count() {
    return levels.length;
  }

  function addCustomLevels(customList) {
    const startIdx = levels.length;
    const prepared = (customList || []).map((lv) => {
      const pack = lv.pack || 'custom';
      const packNum = (packCounters[pack] || 0) + 1;
      packCounters[pack] = packNum;
      return Object.assign({}, lv, {
        pack,
        rank: null,
        packIndex: packNum,
        unlockStars: 0,
        premiumPackId: null,
        freePreview: false
      });
    });
    levels = [...levels, ...prepared];
    return startIdx;
  }

  function getPremiumPacks() {
    return Object.values(PREMIUM_PACKS);
  }

  function getPackMeta(packId) {
    return PREMIUM_PACKS[packId] || null;
  }

  function getLevelTag(level) {
    if (!level) return '';
    const prefix = PACK_PREFIXES[level.pack] || 'L';
    if (Number.isFinite(level.packIndex) && level.packIndex > 0) {
      return `${prefix}${level.packIndex}`;
    }
    const packLevels = levels.filter((l) => l.pack === level.pack);
    const num = packLevels.findIndex((l) => l.id === level.id) + 1;
    return `${prefix}${num}`;
  }

  function isMapLine(line) {
    return /[#$@.*+]/.test(line) && /^[ #$@.*+_-]+$/.test(line) && line.includes('#');
  }

  /**
   * Parses standard ASCII Sokoban (.xsb / .txt) level text into level objects.
   */
  function parseXsbLevels(rawText) {
    if (!rawText || !rawText.trim()) return [];

    const lines = rawText.replace(/\r/g, '').split('\n');
    const parsed = [];
    let currentMap = [];
    let pendingTitle = '';
    const stamp = Date.now();

    const flushMap = () => {
      if (currentMap.length < 3) {
        currentMap = [];
        return;
      }

      let crates = 0;
      let goals = 0;
      let players = 0;

      const normalized = currentMap.map((row) => row.replace(/[_-]/g, ' ').replace(/\s+$/, ''));
      normalized.forEach((row) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '$' || ch === '*') crates++;
          if (ch === '.' || ch === '*' || ch === '+') goals++;
          if (ch === '@' || ch === '+') players++;
        }
      });

      if (players === 1 && crates > 0 && crates === goals) {
        parsed.push({
          id: `custom-${stamp}-${parsed.length}`,
          pack: 'custom',
          name: pendingTitle || `Custom #${parsed.length + 1}`,
          par: Math.max(18, crates * 14),
          crates,
          unlockStars: 0,
          map: normalized
        });
      }

      currentMap = [];
      pendingTitle = '';
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isMapLine(line)) {
        currentMap.push(line);
      } else {
        if (currentMap.length > 0) flushMap();
        const trimmed = line.replace(/^;\s*/, '').trim();
        if (trimmed.length > 0 && trimmed.length <= 36) {
          pendingTitle = trimmed;
        }
      }
    }
    flushMap();

    return parsed;
  }

  VS.Levels = {
    getAll,
    get,
    count,
    addCustomLevels,
    getPremiumPacks,
    getPackMeta,
    getLevelTag,
    parseXsbLevels
  };
})(window);
