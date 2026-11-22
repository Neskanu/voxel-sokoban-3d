(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  const state = {
    levelIndex: 0,
    menuOpen: true,
    totalSessionMoves: 0,
    hintDismissed: false,
    gridWidth: 0,
    gridHeight: 0,
    walls: new Set(),
    floors: new Set(),
    goals: new Set(),
    crates: [],
    goalMeshes: new Map(),
    floorMeshes: [],
    history: [],
    moves: 0,
    pushes: 0,
    won: false,
    isAnimating: false,
    winTimers: [],
    player: {
      x: 0,
      y: 0,
      mesh: null,
      yaw: 0,
      targetYaw: 0,
      animFrom: null,
      animTo: null,
      animT: 1,
      bumpDir: null,
      bumpT: 1
    },
    camYaw: CONFIG.CAMERA_ISO_OFFSET,
    camTargetYaw: CONFIG.CAMERA_ISO_OFFSET,
    camPitch: CONFIG.CAMERA_DEFAULT_PITCH,
    camDistance: 12,
    camLookX: 0,
    camLookZ: 0,
    camTargetX: 0,
    camTargetZ: 0,
    camAutoFollow: true,
    particles: []
  };

  function clearWinTimers() {
    for (let i = 0; i < state.winTimers.length; i++) {
      global.clearTimeout(state.winTimers[i]);
    }
    state.winTimers.length = 0;
  }

  function init() {
    state.camYaw = CONFIG.CAMERA_ISO_OFFSET;
    state.camTargetYaw = CONFIG.CAMERA_ISO_OFFSET;
    loadLevel(0);
  }

  function loadLevel(index) {
    const level = VS.Levels.get(index);
    if (!level) return;

    clearWinTimers();
    if (VS.Monetization) {
      VS.Monetization.consumeExpiredTrials();
    }

    state.levelIndex = index;
    state.gridHeight = level.map.length;
    state.gridWidth = Math.max(...level.map.map((r) => r.length));
    state.walls.clear();
    state.floors.clear();
    state.goals.clear();
    state.crates = [];
    state.goalMeshes.clear();
    state.floorMeshes = [];
    state.history = [];
    state.moves = 0;
    state.pushes = 0;
    state.won = false;
    state.isAnimating = false;
    state.player.mesh = null;
    state.player.animFrom = null;
    state.player.animTo = null;
    state.player.bumpDir = null;
    state.player.animT = 1;
    state.player.bumpT = 1;
    state.player.yaw = 0;
    state.player.targetYaw = 0;

    VS.Renderer.buildBoard(level);
    updateCrateVisuals();
    VS.Renderer.computeCameraDistance();

    const settings = VS.Storage.getSettings();
    state.camAutoFollow = settings.autoFollow;

    if (VS.Renderer.isWholeMapVisible() || !state.camAutoFollow) {
      state.camLookX = state.camTargetX = 0;
      state.camLookZ = state.camTargetZ = 0;
    } else {
      const pWorld = VS.Renderer.gridToWorld(state.player.x, state.player.y);
      state.camLookX = state.camTargetX = pWorld.x;
      state.camLookZ = state.camTargetZ = pWorld.z;
    }

    VS.UI.updateHUD();
    VS.UI.hideModal('modal-win');
  }

  function updateCrateVisuals() {
    const MAT = VS.Voxels.MAT;
    let lockedCount = 0;
    const occupiedGoals = new Set();

    state.crates.forEach((crate) => {
      const key = `${crate.x},${crate.y}`;
      const onGoal = state.goals.has(key);
      if (onGoal) {
        lockedCount++;
        occupiedGoals.add(key);
      }
      const coreMat = onGoal ? MAT.crateDone : MAT.crateWood;
      const trimMat = onGoal ? MAT.crateDoneTrim : MAT.crateTrim;
      crate.coreMeshes.forEach((m) => {
        m.material = coreMat;
      });
      crate.trimMeshes.forEach((m) => {
        m.material = trimMat;
      });
    });

    state.goalMeshes.forEach((obj, key) => {
      obj.crystal.visible = !occupiedGoals.has(key);
    });

    VS.UI.updateGoalCount(lockedCount, state.goals.size);
    return lockedCount === state.goals.size && state.goals.size > 0;
  }

  function getCrateAt(x, y) {
    return state.crates.find((c) => c.x === x && c.y === y) || null;
  }

  function screenDirToGrid(dir) {
    const quadrant = ((Math.round(state.camTargetYaw / (Math.PI / 2)) % 4) + 4) % 4;
    const map = {
      0: { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] },
      1: { up: [-1, 0], down: [1, 0], left: [0, 1], right: [0, -1] },
      2: { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] },
      3: { up: [1, 0], down: [-1, 0], left: [0, -1], right: [0, 1] }
    };
    return map[quadrant][dir];
  }

  function triggerBump(dx, dy) {
    state.player.bumpDir = { x: dx, z: dy };
    state.player.bumpT = 0;
  }

  function pushHistory(crate) {
    state.history.push({
      px: state.player.x,
      py: state.player.y,
      crateId: crate ? crate.id : null,
      cx: crate ? crate.x : 0,
      cy: crate ? crate.y : 0,
      pushed: Boolean(crate)
    });
  }

  function snapAnimations() {
    if (state.player.mesh && state.player.animT < 1 && state.player.animTo) {
      state.player.mesh.position.set(state.player.animTo.x, 0, state.player.animTo.z);
      state.player.animT = 1;
    }
    state.crates.forEach((c) => {
      if (c.animT < 1 && c.animTo) {
        c.mesh.position.set(c.animTo.x, 0, c.animTo.z);
        c.animT = 1;
      }
    });
    state.isAnimating = false;
  }

  function attemptMove(dx, dy) {
    if (state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive())) return;
    VS.Sound.unlock();

    if (VS.Storage.getSettings().autoFollow) {
      state.camAutoFollow = true;
    }

    if (state.isAnimating) {
      snapAnimations();
    }

    state.player.targetYaw = Math.atan2(dx, dy);

    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    const nextKey = `${nx},${ny}`;

    // Check wall or board boundary collision
    if (state.walls.has(nextKey) || !state.floors.has(nextKey)) {
      triggerBump(dx, dy);
      VS.Sound.playBump();
      return;
    }

    // Check crate collision
    const crate = getCrateAt(nx, ny);
    if (crate) {
      const cx = nx + dx;
      const cy = ny + dy;
      const crateKey = `${cx},${cy}`;
      if (state.walls.has(crateKey) || !state.floors.has(crateKey) || getCrateAt(cx, cy)) {
        triggerBump(dx, dy);
        VS.Sound.playBump();
        return;
      }

      pushHistory(crate);

      crate.animFrom = VS.Renderer.gridToWorld(crate.x, crate.y);
      crate.x = cx;
      crate.y = cy;
      crate.animTo = VS.Renderer.gridToWorld(cx, cy);
      crate.animT = 0;
      state.pushes++;

      const destWorld = VS.Renderer.gridToWorld(cx, cy);
      const crateSkin = VS.Cosmetics ? VS.Cosmetics.getActiveCrateSkin() : null;
      const lockColor = crateSkin ? crateSkin.lockParticleColor : 0x34d399;
      const pushColor = crateSkin ? crateSkin.pushParticleColor : 0xfbbf24;
      if (state.goals.has(crateKey)) {
        VS.Sound.playGoalLock();
        VS.Renderer.spawnParticles(destWorld.x, 0.5, destWorld.z, lockColor, 14, 0.09);
      } else {
        VS.Sound.playPush();
        VS.Renderer.spawnParticles(destWorld.x, 0.15, destWorld.z, pushColor, 5, 0.05);
      }
    } else {
      pushHistory(null);
      VS.Sound.playStep();
    }

    state.player.animFrom = VS.Renderer.gridToWorld(state.player.x, state.player.y);
    state.player.x = nx;
    state.player.y = ny;
    state.player.animTo = VS.Renderer.gridToWorld(nx, ny);
    state.player.animT = 0;
    state.isAnimating = true;
    state.moves++;
    state.totalSessionMoves++;

    if (!state.hintDismissed && state.totalSessionMoves >= CONFIG.HINT_DISMISS_MOVES) {
      state.hintDismissed = true;
      VS.UI.updateHintVisibility();
    }

    const allLocked = updateCrateVisuals();
    VS.UI.updateHUD();

    if (allLocked) {
      handleLevelWin();
    }
  }

  function undoMove() {
    if (state.history.length === 0 || state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive())) return;
    VS.Sound.unlock();

    if (VS.Storage.getSettings().autoFollow) {
      state.camAutoFollow = true;
    }
    snapAnimations();

    const last = state.history.pop();
    state.player.animFrom = VS.Renderer.gridToWorld(state.player.x, state.player.y);
    state.player.x = last.px;
    state.player.y = last.py;
    state.player.animTo = VS.Renderer.gridToWorld(last.px, last.py);
    state.player.animT = 0;

    if (last.crateId !== null) {
      const crate = state.crates.find((c) => c.id === last.crateId);
      if (crate) {
        crate.animFrom = VS.Renderer.gridToWorld(crate.x, crate.y);
        crate.x = last.cx;
        crate.y = last.cy;
        crate.animTo = VS.Renderer.gridToWorld(last.cx, last.cy);
        crate.animT = 0;
      }
      state.pushes = Math.max(0, state.pushes - 1);
    }

    state.moves = Math.max(0, state.moves - 1);
    state.isAnimating = true;
    VS.Sound.playUndo();
    updateCrateVisuals();
    VS.UI.updateHUD();
  }

  function handleLevelWin() {
    state.won = true;
    clearWinTimers();

    const lv = VS.Levels.get(state.levelIndex);
    const winStats = VS.Storage.recordWin(lv, state.moves);
    const trialInfo = VS.Monetization ? VS.Monetization.onLevelWon() : null;
    if (winStats.stars === 3 && VS.Platform) {
      VS.Platform.happyTime();
    }
    VS.UI.updateMenuStats();
    VS.Sound.playWin();

    const allLevels = VS.Levels.getAll();
    const newlyUnlocked = allLevels.filter(
      (l) => !l.premiumPackId && (l.unlockStars || 0) > winStats.prevStars && (l.unlockStars || 0) <= winStats.newStars
    );

    const pWorld = VS.Renderer.gridToWorld(state.player.x, state.player.y);
    const colors = [0x34d399, 0x38bdf8, 0xfbbf24, 0xf472b6];
    colors.forEach((col, i) => {
      const tid = global.setTimeout(() => {
        if (!state.won) return;
        VS.Renderer.spawnParticles(pWorld.x, 1.1, pWorld.z, col, 16, 0.14);
      }, i * 110);
      state.winTimers.push(tid);
    });

    const modalTimerId = global.setTimeout(() => {
      if (!state.won) return;
      const totalLevels = VS.Levels.count();
      const isLast = state.levelIndex === totalLevels - 1;
      const nextLv = VS.Levels.get((state.levelIndex + 1) % totalLevels);
      const nextLockInfo = VS.Storage.getLevelLockInfo(nextLv);
      const nextUnlocked = nextLockInfo.unlocked;

      VS.UI.showWinModal({
        level: lv,
        moves: state.moves,
        stars: winStats.stars,
        score: winStats.score,
        par: winStats.par,
        newStars: winStats.newStars,
        baseCoinsEarned: winStats.baseCoinsEarned,
        coinsEarned: winStats.coinsEarned,
        proAutoDoubled: winStats.proAutoDoubled,
        trialInfo,
        isLast,
        nextLevel: nextLv,
        nextUnlocked,
        nextLockInfo,
        newlyUnlockedCount: newlyUnlocked.length
      });
    }, 420);
    state.winTimers.push(modalTimerId);
  }

  function handleTapTile(clientX, clientY) {
    if (state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive())) return;
    const hit = VS.Renderer.raycastFloor(clientX, clientY);
    if (!hit) return;

    const dx = hit.gx - state.player.x;
    const dy = hit.gy - state.player.y;
    if (dx === 0 && dy !== 0) {
      attemptMove(0, Math.sign(dy));
    } else if (dy === 0 && dx !== 0) {
      attemptMove(Math.sign(dx), 0);
    }
  }

  VS.Game = {
    state,
    init,
    loadLevel,
    updateCrateVisuals,
    getCrateAt,
    screenDirToGrid,
    attemptMove,
    triggerBump,
    undoMove,
    snapAnimations,
    clearWinTimers,
    handleTapTile
  };
})(window);
