(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  // Legend: '#' = Wall, '.' = Target Pad, '$' = Crate, '@' = Player,
  //         '*' = Crate on Target, '+' = Player on Target, ' ' = Floor
  const STARTER_LEVELS = [
    {
      id: 'starter-1',
      pack: 'starter',
      name: 'First Steps',
      par: 10,
      unlockStars: 0,
      map: [
        '#########',
        '#   .   #',
        '#   $   #',
        '# .$@$. #',
        '#   $   #',
        '#   .   #',
        '#########'
      ]
    },
    {
      id: 'starter-2',
      pack: 'starter',
      name: 'Corner Pocket',
      par: 26,
      unlockStars: 0,
      map: [
        '######',
        '#    #',
        '# @$ #',
        '# $. #',
        '#  . #',
        '######'
      ]
    },
    {
      id: 'starter-3',
      pack: 'starter',
      name: 'Order Matters',
      par: 24,
      unlockStars: 0,
      map: [
        '#######',
        '#  .  #',
        '# #$# #',
        '# .@$ #',
        '# #$# #',
        '#  .  #',
        '#######'
      ]
    },
    {
      id: 'starter-4',
      pack: 'starter',
      name: 'The Vault',
      par: 32,
      unlockStars: 2,
      map: [
        '########',
        '#   .  #',
        '#  #$# #',
        '#  $@  #',
        '#  #$# #',
        '#  ..  #',
        '########'
      ]
    },
    {
      id: 'starter-5',
      pack: 'starter',
      name: 'Crossroads',
      par: 38,
      unlockStars: 4,
      map: [
        '########',
        '#  ..  #',
        '#  $$  #',
        '# #  # #',
        '# $@$  #',
        '#  ..  #',
        '########'
      ]
    },
    {
      id: 'starter-6',
      pack: 'starter',
      name: 'Grand Courtyard',
      par: 44,
      unlockStars: 6,
      map: [
        '#########',
        '#   #   #',
        '# $ . $ #',
        '#  ###  #',
        '# . @ . #',
        '#  $ $  #',
        '#   .   #',
        '#########'
      ]
    }
  ];

  const CLASSIC_LEVELS = [
    {
      id: 'classic-1',
      pack: 'classic',
      name: 'Warehouse 1982',
      par: 230,
      unlockStars: 0,
      map: [
        '    #####          ',
        '    #   #          ',
        '    #$  #          ',
        '  ###  $##         ',
        '  #  $ $ #         ',
        '### # ## #   ######',
        '#   # ## #####  ..#',
        '# $  $          ..#',
        '##### ### #@##  ..#',
        '    #     #########',
        '    #######        '
      ]
    },
    {
      id: 'classic-2',
      pack: 'classic',
      name: 'Twin Alcoves',
      par: 42,
      unlockStars: 0,
      map: [
        '  #####',
        '  #   #',
        '### $ #',
        '#  $  #',
        '# # $ #',
        '# ... #',
        '#  @  #',
        '#######'
      ]
    },
    {
      id: 'classic-3',
      pack: 'classic',
      name: 'The Narrow Hall',
      par: 34,
      unlockStars: 0,
      map: [
        '########',
        '#   ...#',
        '# $$#$ #',
        '#  @   #',
        '#   #  #',
        '########'
      ]
    },
    {
      id: 'classic-4',
      pack: 'classic',
      name: 'Boxcar Switch',
      par: 32,
      unlockStars: 4,
      map: [
        '#######',
        '#  .  #',
        '# $#$ #',
        '# .@. #',
        '#  $  #',
        '#     #',
        '#######'
      ]
    },
    {
      id: 'classic-5',
      pack: 'classic',
      name: 'Loading Dock',
      par: 48,
      unlockStars: 4,
      map: [
        '#########',
        '#       #',
        '# $ # $ #',
        '#  ...  #',
        '#   @   #',
        '#   .   #',
        '# $ # $ #',
        '#       #',
        '#########'
      ]
    },
    {
      id: 'classic-6',
      pack: 'classic',
      name: 'L-Shaped Storage',
      par: 46,
      unlockStars: 4,
      map: [
        '######  ',
        '#    #  ',
        '# $$ #  ',
        '# @# ###',
        '## #   #',
        ' # $...#',
        ' #     #',
        ' #######'
      ]
    },
    {
      id: 'classic-7',
      pack: 'classic',
      name: 'Double Lock',
      par: 54,
      unlockStars: 9,
      map: [
        '  ######',
        '  #    #',
        '###  # #',
        '#  $ $ #',
        '#  ..@ #',
        '#  ..# #',
        '###$$  #',
        '  #    #',
        '  ######'
      ]
    },
    {
      id: 'classic-8',
      pack: 'classic',
      name: 'The Corridor',
      par: 68,
      unlockStars: 9,
      map: [
        '##########',
        '#   #    #',
        '# $  $ $ #',
        '#  ###   #',
        '#  ...#@ #',
        '#   . $  #',
        '##########'
      ]
    },
    {
      id: 'classic-9',
      pack: 'classic',
      name: 'Four Corners',
      par: 56,
      unlockStars: 9,
      map: [
        '#########',
        '#.  #  .#',
        '# $   $ #',
        '#   #   #',
        '##  @  ##',
        '#   #   #',
        '# $   $ #',
        '#.  #  .#',
        '#########'
      ]
    },
    {
      id: 'classic-10',
      pack: 'classic',
      name: 'The Pillar Room',
      par: 44,
      unlockStars: 15,
      map: [
        '  #######  ',
        '  #  .  #  ',
        '###  $  ###',
        '#  #. .#  #',
        '#  $ @ $  #',
        '#    $    #',
        '#### . ####',
        '   #####   '
      ]
    },
    {
      id: 'classic-11',
      pack: 'classic',
      name: 'Zigzag Express',
      par: 58,
      unlockStars: 15,
      map: [
        '#######',
        '#...  #',
        '#  #  #',
        '#  #$ #',
        '## $  #',
        ' # $@ #',
        ' #    #',
        ' ######'
      ]
    },
    {
      id: 'classic-12',
      pack: 'classic',
      name: 'Central Depot',
      par: 62,
      unlockStars: 15,
      map: [
        '#########',
        '#   .   #',
        '#  #$#  #',
        '#  $ $  #',
        '#. .@. .#',
        '#  $ $  #',
        '#   #   #',
        '#       #',
        '#########'
      ]
    },
    {
      id: 'classic-13',
      pack: 'classic',
      name: 'Twin Chambers',
      par: 76,
      unlockStars: 22,
      map: [
        '###########',
        '#    #    #',
        '# $$ # .. #',
        '#  @ # .. #',
        '#  $   $  #',
        '#    #    #',
        '###########'
      ]
    },
    {
      id: 'classic-14',
      pack: 'classic',
      name: 'The Spiral',
      par: 160,
      unlockStars: 22,
      map: [
        '##########',
        '#   .... #',
        '#  ##### #',
        '#  #   # #',
        '#  #$@$# #',
        '#  #   # #',
        '#   $ $  #',
        '#        #',
        '##########'
      ]
    },
    {
      id: 'classic-15',
      pack: 'classic',
      name: 'The Crossvault',
      par: 84,
      unlockStars: 22,
      map: [
        '   #####   ',
        '   # . #   ',
        '   # . #   ',
        '####   ####',
        '#   $ $   #',
        '#  # @ #  #',
        '#   $ $   #',
        '####   ####',
        '   # . #   ',
        '   # . #   ',
        '   #####   '
      ]
    },
    {
      id: 'classic-16',
      pack: 'classic',
      name: 'Warehouse Alley',
      par: 72,
      unlockStars: 30,
      map: [
        '##########',
        '#   #    #',
        '# $ # .. #',
        '# $   .. #',
        '# $    . #',
        '# @ # $$ #',
        '#        #',
        '##########'
      ]
    },
    {
      id: 'classic-17',
      pack: 'classic',
      name: 'The Keystone',
      par: 48,
      unlockStars: 30,
      map: [
        '   #######   ',
        '   #  .  #   ',
        '### $ * $ ###',
        '#   . @ .   #',
        '#   $ . $   #',
        '#     #     #',
        '#############'
      ]
    },
    {
      id: 'classic-18',
      pack: 'classic',
      name: 'Grand Warehouse',
      par: 120,
      unlockStars: 30,
      map: [
        '############',
        '#   #      #',
        '# $ #  $$  #',
        '# $  #     #',
        '# @#   ##  #',
        '# $  #   ..#',
        '#   $    ..#',
        '#        ..#',
        '############'
      ]
    }
  ];

  let levels = [...CLASSIC_LEVELS, ...STARTER_LEVELS];

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
    levels = [...levels, ...customList];
    return startIdx;
  }

  function getLevelTag(level) {
    if (!level) return '';
    const packLevels = levels.filter((l) => l.pack === level.pack);
    const num = packLevels.findIndex((l) => l.id === level.id) + 1;
    const prefix = level.pack === 'classic' ? 'C' : (level.pack === 'custom' ? 'X' : 'S');
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
    getLevelTag,
    parseXsbLevels
  };
})(window);
