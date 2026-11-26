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
    camTargetPitch: CONFIG.CAMERA_DEFAULT_PITCH,
    camDistance: 12,
    camTargetDistance: 12,
    camLookX: 0,
    camLookZ: 0,
    camTargetX: 0,
    camTargetZ: 0,
    camAutoFollow: true,
    particles: [],
    deadlockedCrateIds: new Set(),
    freeHintUsed: false,
    activeHint: null
  };

  function clearWinTimers() {
    for (let i = 0; i < state.winTimers.length; i++) {
      global.clearTimeout(state.winTimers[i]);
    }
    state.winTimers.length = 0;
  }

  function getNextUncompletedLevelIndex() {
    const all = VS.Levels && VS.Levels.getAll ? VS.Levels.getAll() : [];
    let lastUnlockedIdx = -1;
    for (let i = 0; i < all.length; i++) {
      const lv = all[i];
      if (!lv || lv.pack === 'custom') continue;
      if (VS.Storage && typeof VS.Storage.isLevelUnlocked === 'function' && !VS.Storage.isLevelUnlocked(lv)) {
        continue;
      }
      lastUnlockedIdx = i;
      const rec = VS.Storage && typeof VS.Storage.getLevelRecord === 'function'
        ? VS.Storage.getLevelRecord(lv.id)
        : null;
      if (!rec || !rec.stars) {
        return i;
      }
    }
    return lastUnlockedIdx >= 0 ? lastUnlockedIdx : 0;
  }

  function init() {
    state.camYaw = CONFIG.CAMERA_ISO_OFFSET;
    state.camTargetYaw = CONFIG.CAMERA_ISO_OFFSET;
    loadLevel(getNextUncompletedLevelIndex());
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
    state.deadlockedCrateIds = new Set();
    state.freeHintUsed = false;
    state.activeHint = null;
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

    if (state.menuOpen || VS.Renderer.isWholeMapVisible() || !state.camAutoFollow) {
      state.camLookX = state.camTargetX = 0;
      state.camLookZ = state.camTargetZ = 0;
    } else {
      const pWorld = VS.Renderer.gridToWorld(state.player.x, state.player.y);
      state.camLookX = state.camTargetX = pWorld.x;
      state.camLookZ = state.camTargetZ = pWorld.z;
    }

    VS.UI.updateHUD();
    VS.UI.hideModal('modal-win');
    if (VS.UI.updateDeadlockUI) VS.UI.updateDeadlockUI(false);
    if (VS.UI.updateHintButton) VS.UI.updateHintButton();
    showOnboardingGuideIfNeeded();
  }

  function isWallOrOut(x, y) {
    const key = `${x},${y}`;
    return state.walls.has(key) || !state.floors.has(key);
  }

  function isCornerDeadlock(x, y) {
    if (state.goals.has(`${x},${y}`)) return false;
    const up = isWallOrOut(x, y - 1);
    const down = isWallOrOut(x, y + 1);
    const left = isWallOrOut(x - 1, y);
    const right = isWallOrOut(x + 1, y);
    return (up || down) && (left || right);
  }

  function refreshDeadlocks(triggerSound) {
    const prevSize = state.deadlockedCrateIds.size;
    const next = new Set();
    for (let i = 0; i < state.crates.length; i++) {
      const c = state.crates[i];
      if (isCornerDeadlock(c.x, c.y)) {
        next.add(c.id);
      }
    }
    state.deadlockedCrateIds = next;
    const hasDeadlock = next.size > 0;
    if (hasDeadlock && next.size > prevSize && triggerSound) {
      if (VS.Sound && VS.Sound.playDeadlock) VS.Sound.playDeadlock();
      if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('deadlock');
    }
    if (VS.UI && VS.UI.updateDeadlockUI) {
      VS.UI.updateDeadlockUI(hasDeadlock);
    }
    return hasDeadlock;
  }

  function computeNextOptimalPush(maxStates = 6000) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const w = state.gridWidth;
    const h = state.gridHeight;
    const idxOf = (x, y) => y * w + x;
    const isFloorIdx = new Uint8Array(w * h);
    const isGoalIdx = new Uint8Array(w * h);
    const isCornerIdx = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const key = `${x},${y}`;
        const idx = idxOf(x, y);
        if (state.floors.has(key) && !state.walls.has(key)) {
          isFloorIdx[idx] = 1;
        }
        if (state.goals.has(key)) {
          isGoalIdx[idx] = 1;
        }
        if (isFloorIdx[idx] && !isGoalIdx[idx] && isCornerDeadlock(x, y)) {
          isCornerIdx[idx] = 1;
        }
      }
    }

    const startCrates = state.crates.map((c) => idxOf(c.x, c.y)).sort((a, b) => a - b);
    const startPlayer = idxOf(state.player.x, state.player.y);

    function getReachable(pIdx, crateSet) {
      const visited = new Uint8Array(w * h);
      const q = [pIdx];
      visited[pIdx] = 1;
      let minIdx = pIdx;
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        if (cur < minIdx) minIdx = cur;
        const cx = cur % w;
        const cy = (cur / w) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + dirs[d][0];
          const ny = cy + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nIdx = idxOf(nx, ny);
          if (!visited[nIdx] && isFloorIdx[nIdx] && !crateSet.has(nIdx)) {
            visited[nIdx] = 1;
            q.push(nIdx);
          }
        }
      }
      return { visited, minIdx };
    }

    const initSet = new Set(startCrates);
    const initReach = getReachable(startPlayer, initSet);
    const seen = new Set([`${initReach.minIdx}|${startCrates.join(',')}`]);
    const queue = [{ crates: startCrates, player: startPlayer, firstPush: null }];
    let head = 0;
    let expanded = 0;

    while (head < queue.length && expanded < maxStates) {
      const node = queue[head++];
      expanded++;
      const crateSet = new Set(node.crates);
      const reach = getReachable(node.player, crateSet);

      for (let i = 0; i < node.crates.length; i++) {
        const cIdx = node.crates[i];
        const cx = cIdx % w;
        const cy = (cIdx / w) | 0;

        for (let d = 0; d < 4; d++) {
          const dx = dirs[d][0];
          const dy = dirs[d][1];
          const px = cx - dx;
          const py = cy - dy;
          const tx = cx + dx;
          const ty = cy + dy;
          if (px < 0 || py < 0 || px >= w || py >= h || tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
          const pNeedIdx = idxOf(px, py);
          const tIdx = idxOf(tx, ty);
          if (!reach.visited[pNeedIdx]) continue;
          if (!isFloorIdx[tIdx] || crateSet.has(tIdx) || isCornerIdx[tIdx]) continue;

          const nextCrates = node.crates.slice();
          nextCrates[i] = tIdx;
          nextCrates.sort((a, b) => a - b);

          const firstPush = node.firstPush || { crateX: cx, crateY: cy, dx, dy };

          let allOnGoal = true;
          for (let k = 0; k < nextCrates.length; k++) {
            if (!isGoalIdx[nextCrates[k]]) {
              allOnGoal = false;
              break;
            }
          }
          if (allOnGoal) {
            return { found: true, push: firstPush, exact: true };
          }

          const nextSet = new Set(nextCrates);
          const nextReach = getReachable(cIdx, nextSet);
          const key = `${nextReach.minIdx}|${nextCrates.join(',')}`;
          if (!seen.has(key)) {
            seen.add(key);
            queue.push({ crates: nextCrates, player: cIdx, firstPush });
          }
        }
      }
    }

    // Fallback: if bounded out on a huge map, suggest a safe reachable push toward the nearest open goal
    if (expanded >= maxStates) {
      let best = null;
      let bestScore = Infinity;
      const openGoals = [];
      state.goals.forEach((gKey) => {
        const [gx, gy] = gKey.split(',').map(Number);
        if (!getCrateAt(gx, gy)) openGoals.push({ x: gx, y: gy });
      });
      for (let i = 0; i < startCrates.length; i++) {
        const cIdx = startCrates[i];
        const cx = cIdx % w;
        const cy = (cIdx / w) | 0;
        if (isGoalIdx[cIdx]) continue;
        for (let d = 0; d < 4; d++) {
          const dx = dirs[d][0];
          const dy = dirs[d][1];
          const px = cx - dx;
          const py = cy - dy;
          const tx = cx + dx;
          const ty = cy + dy;
          if (px < 0 || py < 0 || px >= w || py >= h || tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
          const pNeedIdx = idxOf(px, py);
          const tIdx = idxOf(tx, ty);
          if (!initReach.visited[pNeedIdx] || !isFloorIdx[tIdx] || initSet.has(tIdx) || isCornerIdx[tIdx]) continue;
          let minDist = Infinity;
          for (let g = 0; g < openGoals.length; g++) {
            const dist = Math.abs(tx - openGoals[g].x) + Math.abs(ty - openGoals[g].y);
            if (dist < minDist) minDist = dist;
          }
          if (minDist < bestScore) {
            bestScore = minDist;
            best = { crateX: cx, crateY: cy, dx, dy };
          }
        }
      }
      if (best) {
        return { found: true, push: best, exact: false };
      }
    }

    return { found: false, push: null, exact: false };
  }

  function showOnboardingGuideIfNeeded() {
    if (!VS.Renderer || !VS.Renderer.setGuideArrow) return;
    if (state.levelIndex === 0 && state.moves === 0 && !state.won) {
      const res = computeNextOptimalPush(1000);
      if (res.found && res.push) {
        VS.Renderer.setGuideArrow(res.push.crateX, res.push.crateY, res.push.dx, res.push.dy, 0x38bdf8);
      }
    }
  }

  async function requestHint() {
    if (state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive())) {
      return { ok: false, reason: 'inactive' };
    }
    VS.Sound.unlock();

    // Compute first so we never charge an ad if the board is already deadlocked / unsolvable
    const solved = computeNextOptimalPush(6000);
    if (!solved.found || !solved.push) {
      if (VS.Sound && VS.Sound.playDeadlock) VS.Sound.playDeadlock();
      if (VS.UI && VS.UI.showTransientToast) {
        const isTouch = Boolean(VS.Platform && VS.Platform.isMobilePlatform && VS.Platform.isMobilePlatform());
        VS.UI.showTransientToast(
          isTouch
            ? 'No valid push from here — tap Undo or Reset!'
            : 'No valid push from here — press Z to Undo or R to Reset!',
          'amber'
        );
      }
      return { ok: false, reason: 'unsolvable' };
    }

    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { rewardedAds: false };
    if (state.freeHintUsed && caps.rewardedAds && VS.Monetization && VS.Monetization.claimHintWithAd) {
      const adRes = await VS.Monetization.claimHintWithAd();
      if (!adRes || !adRes.ok) {
        if (VS.UI && VS.UI.showTransientToast) {
          const msg = adRes && adRes.reason === 'adblock'
            ? 'Ad blocked — disable ad blocker for extra hints.'
            : 'Hint ad unavailable right now — try again shortly.';
          VS.UI.showTransientToast(msg, 'amber');
        }
        return { ok: false, reason: (adRes && adRes.reason) || 'ad_failed' };
      }
    } else {
      state.freeHintUsed = true;
    }

    state.activeHint = solved.push;
    if (VS.Renderer && VS.Renderer.setGuideArrow) {
      VS.Renderer.setGuideArrow(solved.push.crateX, solved.push.crateY, solved.push.dx, solved.push.dy, 0x34d399);
    }
    if (VS.Sound && VS.Sound.playHint) VS.Sound.playHint();
    if (VS.UI && VS.UI.updateHintButton) VS.UI.updateHintButton();
    if (VS.UI && VS.UI.showTransientToast) {
      VS.UI.showTransientToast('Push the glowing crate in the arrow\'s direction!', 'emerald');
    }
    return { ok: true, push: solved.push, exact: solved.exact };
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
    if (state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive()) || (VS.Intro && VS.Intro.isActive())) return;
    VS.Sound.unlock();

    if (VS.Storage.getSettings().autoFollow) {
      state.camAutoFollow = true;
    }

    if (VS.Renderer && VS.Renderer.finishBoardBuildImmediate) {
      VS.Renderer.finishBoardBuildImmediate();
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
      if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('bump');
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
        if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('bump');
        return;
      }

      pushHistory(crate);

      crate.animFrom = VS.Renderer.gridToWorld(crate.x, crate.y);
      crate.x = cx;
      crate.y = cy;
      crate.animTo = VS.Renderer.gridToWorld(cx, cy);
      crate.pushDir = { x: dx, z: dy };
      crate.animT = 0;
      state.pushes++;

      const destWorld = VS.Renderer.gridToWorld(cx, cy);
      const crateSkin = VS.Cosmetics ? VS.Cosmetics.getActiveCrateSkin() : null;
      const lockColor = crateSkin ? crateSkin.lockParticleColor : 0x34d399;
      const pushColor = crateSkin ? crateSkin.pushParticleColor : 0xfbbf24;
      if (state.goals.has(crateKey)) {
        VS.Sound.playGoalLock();
        if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('goal');
        VS.Renderer.spawnParticles(destWorld.x, 0.5, destWorld.z, lockColor, 14, 0.09);
        if (VS.Renderer.spawnGoalShockwave) {
          VS.Renderer.spawnGoalShockwave(destWorld.x, destWorld.z, lockColor);
        }
      } else {
        VS.Sound.playPush();
        if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('push');
        VS.Renderer.spawnParticles(destWorld.x, 0.15, destWorld.z, pushColor, 5, 0.05);
      }
    } else {
      pushHistory(null);
      VS.Sound.playStep();
      if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('step');
      const prevWorld = VS.Renderer.gridToWorld(state.player.x, state.player.y);
      VS.Renderer.spawnParticles(prevWorld.x, 0.08, prevWorld.z, 0x94a3b8, 3, 0.03);
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

    if (VS.Renderer && VS.Renderer.clearGuideArrow && (crate || state.levelIndex === 0)) {
      VS.Renderer.clearGuideArrow();
      state.activeHint = null;
    }

    const allLocked = updateCrateVisuals();
    VS.UI.updateHUD();

    if (allLocked) {
      refreshDeadlocks(false);
      handleLevelWin();
    } else if (crate) {
      refreshDeadlocks(true);
    }
  }

  function undoMove() {
    if (state.history.length === 0 || state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive()) || (VS.Intro && VS.Intro.isActive())) return;
    VS.Sound.unlock();

    if (VS.Storage.getSettings().autoFollow) {
      state.camAutoFollow = true;
    }
    if (VS.Renderer && VS.Renderer.finishBoardBuildImmediate) {
      VS.Renderer.finishBoardBuildImmediate();
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
    state.activeHint = null;
    if (VS.Renderer && VS.Renderer.clearGuideArrow) VS.Renderer.clearGuideArrow();
    VS.Sound.playUndo();
    if (VS.Platform && VS.Platform.haptic) VS.Platform.haptic('undo');
    updateCrateVisuals();
    refreshDeadlocks(false);
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
    } else if (VS.Platform && VS.Platform.haptic) {
      VS.Platform.haptic('win');
    }
    VS.UI.updateMenuStats();
    VS.Sound.playWin();

    const allLevels = VS.Levels.getAll();
    const newlyUnlocked = allLevels.filter(
      (l) => !l.premiumPackId && (l.unlockStars || 0) > winStats.prevStars && (l.unlockStars || 0) <= winStats.newStars
    );
    const iapEnabled = Boolean(VS.Platform && VS.Platform.getCapabilities().iap);
    const newlyUnlockedPacks = !iapEnabled && VS.Levels.getPremiumPacks
      ? VS.Levels.getPremiumPacks().filter(
          (p) => (p.unlockStars || 0) > winStats.prevStars && (p.unlockStars || 0) <= winStats.newStars
        )
      : [];

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
        newlyUnlockedCount: newlyUnlocked.length,
        newlyUnlockedPacks
      });
    }, 1550);
    state.winTimers.push(modalTimerId);
  }

  function handleTapTile(clientX, clientY) {
    if (state.won || state.menuOpen || VS.UI.isAnyModalOpen() || (VS.Monetization && VS.Monetization.isAdActive()) || (VS.Intro && VS.Intro.isActive())) return;
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
    handleTapTile,
    getNextUncompletedLevelIndex,
    isCornerDeadlock,
    computeNextOptimalPush,
    requestHint,
    showOnboardingGuideIfNeeded
  };
})(window);
