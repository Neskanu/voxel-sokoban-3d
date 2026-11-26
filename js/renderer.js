(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  let scene = null;
  let camera = null;
  let renderer = null;
  let levelGroup = null;
  let particleGroup = null;
  let ambientGroup = null;
  let guideArrowGroup = null;
  let guideArrowMeta = null;
  let boardBuildAnims = [];
  let boardBuildElapsed = 0;
  let shockwaves = [];
  let ambientMotes = [];
  let ambientThemeCfg = {
    color: 0x38bdf8,
    driftX: 0.08,
    driftY: 0.22,
    driftZ: 0.05,
    swayAmp: 0.28,
    swayFreq: 0.9
  };
  let hemiLight = null;
  let dirLight = null;
  let rimLight = null;
  let raycaster = null;
  let animFrameId = null;
  let lastTime = 0;
  let winCelebrateT = 0;
  const VICTORY_DANCES = ['happy_jump', 'disco', 'robot', 'shuffle', 'breakdance'];
  let activeDanceIndex = -1;
  let forcedDanceName = null;

  function init(containerEl) {
    if (typeof global.THREE === 'undefined') {
      throw new Error('Three.js failed to load.');
    }

    const THREE = global.THREE;
    raycaster = new THREE.Raycaster();
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(40, global.innerWidth / global.innerHeight, 0.1, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(global.innerWidth, global.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    // Lighting: Soft Hemisphere + Warm Directional Sunlight + Subtle Rim Light
    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.85);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 50;
    const d = 12;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    levelGroup = new THREE.Group();
    scene.add(levelGroup);

    particleGroup = new THREE.Group();
    scene.add(particleGroup);

    ambientGroup = new THREE.Group();
    scene.add(ambientGroup);
    initAmbientMotes();

    global.addEventListener('resize', onWindowResize);
  }

  const AMBIENT_THEME_PRESETS = {
    'classic-warehouse': { color: 0x7dd3fc, driftX: 0.06, driftY: 0.20, driftZ: 0.04, swayAmp: 0.25, swayFreq: 0.8 },
    'cyber-neon': { color: 0xf472b6, driftX: 0.04, driftY: 0.34, driftZ: -0.04, swayAmp: 0.35, swayFreq: 1.4 },
    'desert-ruins': { color: 0xfbbf24, driftX: 0.42, driftY: 0.06, driftZ: 0.14, swayAmp: 0.18, swayFreq: 1.1 },
    'frost-cavern': { color: 0xe0f2fe, driftX: 0.10, driftY: -0.36, driftZ: 0.06, swayAmp: 0.45, swayFreq: 1.2 },
    'sakura-zen': { color: 0xf9a8d4, driftX: 0.24, driftY: -0.26, driftZ: 0.16, swayAmp: 0.55, swayFreq: 1.3 },
    'obsidian-gold': { color: 0xfde047, driftX: -0.04, driftY: 0.40, driftZ: 0.04, swayAmp: 0.32, swayFreq: 1.5 }
  };

  function initAmbientMotes() {
    if (!ambientGroup || typeof global.THREE === 'undefined') return;
    const THREE = global.THREE;
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: ambientThemeCfg.color,
      transparent: true,
      opacity: 0.42
    });
    ambientMotes = [];
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const bx = (Math.random() - 0.5) * 16;
      const by = Math.random() * 8 - 1;
      const bz = (Math.random() - 0.5) * 16;
      mesh.position.set(bx, by, bz);
      ambientGroup.add(mesh);
      ambientMotes.push({
        mesh,
        mat,
        x: bx,
        y: by,
        z: bz,
        phase: Math.random() * Math.PI * 2,
        speedScale: 0.7 + Math.random() * 0.65
      });
    }
  }

  function getDomElement() {
    return renderer ? renderer.domElement : null;
  }

  function gridToWorld(gx, gy) {
    const state = VS.Game.state;
    return {
      x: gx - (state.gridWidth - 1) / 2,
      z: gy - (state.gridHeight - 1) / 2
    };
  }

  function computeCameraDistance() {
    const state = VS.Game.state;
    const aspect = global.innerWidth / Math.max(global.innerHeight, 1);
    const maxDim = Math.max(state.gridWidth, state.gridHeight);
    const portraitFactor = aspect < 0.85 ? 1.02 / Math.max(aspect, 0.5) : 1.0;
    const maxDefaultDist = aspect < 0.85 ? 18.5 : 16.5;
    state.camDistance = Math.max(
      9.5,
      Math.min(maxDefaultDist, maxDim * 1.48 * Math.min(portraitFactor, 1.75))
    );
  }

  function isWholeMapVisible() {
    if (!camera) return true;
    const state = VS.Game.state;
    const THREE = global.THREE;
    const vFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const visH = 2 * state.camDistance * Math.tan(vFov);
    const usableW = visH * camera.aspect * 0.86;
    const usableD = (visH / Math.max(Math.sin(state.camPitch), 0.35)) * 0.74;

    const cosY = Math.abs(Math.cos(state.camTargetYaw));
    const sinY = Math.abs(Math.sin(state.camTargetYaw));
    const mapW = state.gridWidth * cosY + state.gridHeight * sinY;
    const mapD = state.gridWidth * sinY + state.gridHeight * cosY;

    return mapW <= usableW && mapD <= usableD;
  }

  function clampCameraTarget() {
    const state = VS.Game.state;
    const halfW = state.gridWidth * 0.5;
    const halfH = state.gridHeight * 0.5;
    state.camTargetX = Math.max(-halfW, Math.min(halfW, state.camTargetX));
    state.camTargetZ = Math.max(-halfH, Math.min(halfH, state.camTargetZ));
  }

  function panByScreenDelta(dx, dy) {
    if (!camera) return;
    const state = VS.Game.state;
    const THREE = global.THREE;
    const vFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const unitsPerPx = (2 * state.camDistance * Math.tan(vFov)) / Math.max(global.innerHeight, 300);
    const panRight = -dx * unitsPerPx;
    const panForward = (dy * unitsPerPx) / Math.max(Math.sin(state.camPitch), 0.35);

    const cosY = Math.cos(state.camYaw);
    const sinY = Math.sin(state.camYaw);
    state.camTargetX += cosY * panRight - sinY * panForward;
    state.camTargetZ += -sinY * panRight - cosY * panForward;
    clampCameraTarget();
    state.camAutoFollow = false;
  }

  function orbitByDelta(dx, dy) {
    const state = VS.Game.state;
    state.camTargetYaw -= dx * 0.007;
    state.camPitch = Math.max(
      CONFIG.CAMERA_PITCH_MIN,
      Math.min(CONFIG.CAMERA_PITCH_MAX, state.camPitch + dy * 0.005)
    );
  }

  function rotateCamera90() {
    const state = VS.Game.state;
    const currentQuad = Math.round((state.camTargetYaw - CONFIG.CAMERA_ISO_OFFSET) / (Math.PI / 2));
    state.camTargetYaw = (currentQuad + 1) * (Math.PI / 2) + CONFIG.CAMERA_ISO_OFFSET;
  }

  function zoomByDelta(deltaY) {
    const state = VS.Game.state;
    state.camDistance = Math.max(
      CONFIG.CAMERA_DIST_MIN,
      Math.min(CONFIG.CAMERA_DIST_MAX, state.camDistance + deltaY * 0.01)
    );
  }

  function setCameraDistance(dist) {
    const state = VS.Game.state;
    state.camDistance = Math.max(CONFIG.CAMERA_DIST_MIN, Math.min(CONFIG.CAMERA_DIST_MAX, dist));
  }

  function computePlayableTiles(map, width, height) {
    const playable = new Set();
    const queue = [];

    const getChar = (x, y) =>
      y >= 0 && y < height && x >= 0 && x < map[y].length ? map[y][x] : ' ';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        if (ch === '#') {
          playable.add(`${x},${y}`);
        } else if (ch === '@' || ch === '+' || ch === '$' || ch === '*' || ch === '.') {
          const key = `${x},${y}`;
          if (!playable.has(key)) {
            playable.add(key);
            queue.push([x, y]);
          }
        }
      }
    }

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      for (let i = 0; i < dirs.length; i++) {
        const nx = cx + dirs[i][0];
        const ny = cy + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (playable.has(key)) continue;
        if (getChar(nx, ny) !== '#') {
          playable.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    return playable;
  }

  function clearGuideArrow() {
    if (guideArrowGroup && levelGroup) {
      levelGroup.remove(guideArrowGroup);
    }
    guideArrowGroup = null;
    guideArrowMeta = null;
  }

  function setGuideArrow(gx, gy, dx, dy, colorHex) {
    clearGuideArrow();
    if (!levelGroup || typeof global.THREE === 'undefined') return;
    const THREE = global.THREE;
    const pos = gridToWorld(gx, gy);
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: colorHex || 0x38bdf8,
      emissive: colorHex || 0x38bdf8,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.1
    });

    // Floating directional arrow pointing along +Z in local space
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.42), mat);
    shaft.position.set(0, 0, -0.1);
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 4), mat);
    head.rotation.x = Math.PI / 2;
    head.rotation.y = Math.PI / 4;
    head.position.set(0, 0, 0.26);
    group.add(head);

    // Subtle glowing ring around the crate base
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex || 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.54, 4), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 4;
    ring.position.set(0, -1.04, 0);
    group.add(ring);

    group.rotation.y = Math.atan2(dx, dy);
    group.position.set(pos.x, 1.12, pos.z);
    levelGroup.add(group);

    guideArrowGroup = group;
    guideArrowMeta = { baseX: pos.x, baseZ: pos.z, dx, dy, ring };
  }

  function clearBoard() {
    const state = VS.Game.state;
    clearGuideArrow();
    boardBuildAnims = [];
    boardBuildElapsed = 0;
    for (let i = 0; i < shockwaves.length; i++) {
      const sw = shockwaves[i];
      if (particleGroup && sw.ring) {
        particleGroup.remove(sw.ring);
      }
      if (sw.ringGeo) sw.ringGeo.dispose();
      if (sw.ringMat) sw.ringMat.dispose();
    }
    shockwaves = [];
    if (levelGroup) {
      while (levelGroup.children.length > 0) {
        levelGroup.remove(levelGroup.children[0]);
      }
    }
    VS.Voxels.clearParticles(particleGroup, state.particles);
  }

  function registerBuildDrop(obj, targetY, delay) {
    if (!obj) return;
    obj.position.y = targetY + 1.4;
    obj.scale.set(0.45, 0.45, 0.45);
    boardBuildAnims.push({ obj, targetY, delay });
  }

  function finishBoardBuildImmediate() {
    if (!boardBuildAnims.length) return;
    for (let i = 0; i < boardBuildAnims.length; i++) {
      const item = boardBuildAnims[i];
      item.obj.position.y = item.targetY;
      item.obj.scale.set(1, 1, 1);
    }
    boardBuildAnims = [];
  }

  function spawnGoalShockwave(worldX, worldZ, colorHex) {
    if (!particleGroup || typeof global.THREE === 'undefined') return;
    const THREE = global.THREE;
    const col = colorHex || 0x34d399;

    // Subtle voxel-aligned square ripple flush with the goal tile
    const ringGeo = new THREE.RingGeometry(0.45, 0.53, 4);
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 4;
    ring.position.set(worldX, 0.06, worldZ);
    particleGroup.add(ring);

    shockwaves.push({
      ring,
      ringGeo,
      ringMat,
      t: 0,
      dur: 0.38
    });
  }

  function buildBoard(level) {
    clearBoard();

    const state = VS.Game.state;
    const Voxels = VS.Voxels;
    const MAT = Voxels.MAT;

    if (dirLight) {
      const shadowSpan = Math.max(9, Math.max(state.gridWidth, state.gridHeight) * 0.72);
      dirLight.shadow.camera.left = -shadowSpan;
      dirLight.shadow.camera.right = shadowSpan;
      dirLight.shadow.camera.top = shadowSpan;
      dirLight.shadow.camera.bottom = -shadowSpan;
      dirLight.shadow.camera.updateProjectionMatrix();
    }

    const playableTiles = computePlayableTiles(level.map, state.gridWidth, state.gridHeight);
    let crateId = 0;

    for (let y = 0; y < state.gridHeight; y++) {
      const row = level.map[y];
      for (let x = 0; x < state.gridWidth; x++) {
        const key = `${x},${y}`;
        if (!playableTiles.has(key)) continue;

        const ch = x < row.length ? row[x] : ' ';
        const pos = gridToWorld(x, y);
        const dropDelay = Math.min(0.24, Math.hypot(pos.x, pos.z) * 0.032);

        const isLight = (x + y) % 2 === 0;
        const floorTile = Voxels.createBox(
          0.98, 0.24, 0.98,
          isLight ? MAT.floorLight : MAT.floorDark,
          pos.x, -0.12, pos.z, false, true
        );
        floorTile.userData = { gx: x, gy: y };
        levelGroup.add(floorTile);
        state.floorMeshes.push(floorTile);
        registerBuildDrop(floorTile, -0.12, dropDelay);

        const bedrock = Voxels.createBox(0.96, 0.45, 0.96, MAT.bedrock, pos.x, -0.46, pos.z, false, false);
        levelGroup.add(bedrock);
        registerBuildDrop(bedrock, -0.46, dropDelay);

        if (ch === '#') {
          state.walls.add(key);
          const wall = Voxels.buildWallVoxel(x, y);
          wall.position.set(pos.x, 0, pos.z);
          levelGroup.add(wall);
          registerBuildDrop(wall, 0, dropDelay + 0.04);
        } else {
          state.floors.add(key);
        }

        if (ch === '.' || ch === '*' || ch === '+') {
          state.goals.add(key);
          const goalObj = Voxels.buildGoalVoxel();
          goalObj.group.position.set(pos.x, 0, pos.z);
          levelGroup.add(goalObj.group);
          state.goalMeshes.set(key, goalObj);
          registerBuildDrop(goalObj.group, 0, dropDelay + 0.05);
        }

        if (ch === '$' || ch === '*') {
          const crateObj = Voxels.buildCrateVoxel();
          crateObj.group.position.set(pos.x, 0, pos.z);
          levelGroup.add(crateObj.group);
          registerBuildDrop(crateObj.group, 0, dropDelay + 0.08);
          state.crates.push({
            id: crateId++,
            x,
            y,
            mesh: crateObj.group,
            coreMeshes: crateObj.coreMeshes,
            trimMeshes: crateObj.trimMeshes,
            animFrom: null,
            animTo: null,
            pushDir: null,
            animT: 1
          });
        }

        if (ch === '@' || ch === '+') {
          const accessory = VS.Cosmetics ? VS.Cosmetics.getActiveBotSkin().accessory : 'antenna';
          const playerMesh = Voxels.buildPlayerVoxel(accessory);
          playerMesh.position.set(pos.x, 0, pos.z);
          levelGroup.add(playerMesh);
          registerBuildDrop(playerMesh, 0, dropDelay + 0.10);
          state.player.x = x;
          state.player.y = y;
          state.player.mesh = playerMesh;
          state.player.yaw = 0;
          state.player.targetYaw = 0;
          state.player.animFrom = null;
          state.player.animTo = null;
          state.player.animT = 1;
          state.player.bumpDir = null;
          state.player.bumpT = 1;
        }
      }
    }
  }

  function spawnParticles(worldX, worldY, worldZ, colorHex, count, spread) {
    VS.Voxels.spawnParticles(
      particleGroup,
      VS.Game.state.particles,
      worldX,
      worldY,
      worldZ,
      colorHex,
      count,
      spread
    );
  }

  function raycastFloor(clientX, clientY) {
    if (!camera || !raycaster) return null;
    const THREE = global.THREE;
    const ndc = new THREE.Vector2(
      (clientX / global.innerWidth) * 2 - 1,
      -(clientY / global.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(VS.Game.state.floorMeshes, false);
    return hits.length > 0 ? hits[0].object.userData : null;
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = global.innerWidth / Math.max(global.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(global.innerWidth, global.innerHeight);
    computeCameraDistance();
  }

  function resetPlayerRig(mesh) {
    if (!mesh) return;
    mesh.rotation.z = 0;
    if (mesh.scale.x !== 1 || mesh.scale.y !== 1 || mesh.scale.z !== 1) {
      mesh.scale.set(1, 1, 1);
    }
    const rig = mesh.userData && mesh.userData.rig;
    if (!rig) return;
    rig.bodyGroup.position.set(0, 0, 0);
    rig.bodyGroup.rotation.set(0, 0, 0);
    rig.torsoPivot.rotation.set(0, 0, 0);
    rig.headPivot.rotation.set(0, 0, 0);
    rig.armL.rotation.set(0, 0, 0);
    rig.armR.rotation.set(0, 0, 0);
    rig.legL.rotation.set(0, 0, 0);
    rig.legR.rotation.set(0, 0, 0);
  }

  function pickVictoryDanceIndex() {
    if (forcedDanceName) {
      const idx = VICTORY_DANCES.indexOf(forcedDanceName);
      if (idx >= 0) return idx;
    }
    if (VICTORY_DANCES.length <= 1) return 0;
    let next = Math.floor(Math.random() * VICTORY_DANCES.length);
    if (next === activeDanceIndex) {
      next = (next + 1 + Math.floor(Math.random() * (VICTORY_DANCES.length - 1))) % VICTORY_DANCES.length;
    }
    return next;
  }

  function applyVictoryDance(mesh, rig, danceName, t, base, baseYaw) {
    resetPlayerRig(mesh);

    if (danceName === 'disco') {
      const beat = t * 5.2;
      const side = Math.sin(beat);
      const bounce = Math.abs(Math.sin(beat * 2)) * 0.14;
      mesh.position.set(base.x + side * 0.08, bounce, base.z);
      mesh.rotation.y = baseYaw + side * 0.42;

      if (rig) {
        const upFactor = 0.5 + 0.5 * Math.sin(beat);
        // Right arm points high diagonally when side > 0, Left swaps on opposite beat
        rig.armR.rotation.z = 0.35 + upFactor * 2.15;
        rig.armR.rotation.x = -0.3 - upFactor * 0.45;
        rig.armL.rotation.z = -(0.35 + (1 - upFactor) * 2.15);
        rig.armL.rotation.x = -0.3 - (1 - upFactor) * 0.45;
        rig.torsoPivot.rotation.z = -side * 0.24;
        rig.headPivot.rotation.z = side * 0.18;
        rig.headPivot.rotation.x = Math.sin(beat * 2) * 0.16;
        rig.legL.rotation.x = Math.max(0, side) * 0.55;
        rig.legR.rotation.x = Math.max(0, -side) * 0.55;
        rig.legL.rotation.z = -Math.max(0, side) * 0.18;
        rig.legR.rotation.z = Math.max(0, -side) * 0.18;
      }
      return;
    }

    if (danceName === 'robot') {
      const beatDur = 0.40;
      const poses = [
        { armLx: -1.55, armLz: -0.35, armRx: -0.55, armRz: 0.75, headY: 0.42, headZ: -0.08, torsoZ: -0.08, legLx: 0.42, legRx: -0.10, yawOff: -0.22 },
        { armLx: -0.55, armLz: -0.75, armRx: -1.55, armRz: 0.35, headY: -0.42, headZ: 0.08, torsoZ: 0.08, legLx: -0.10, legRx: 0.42, yawOff: 0.22 },
        { armLx: -0.35, armLz: -1.45, armRx: -0.35, armRz: 1.45, headY: 0, headZ: -0.16, torsoZ: 0, legLx: 0, legRx: 0, yawOff: 0 },
        { armLx: -1.45, armLz: -0.18, armRx: -1.45, armRz: 0.18, headY: 0, headZ: 0.12, torsoZ: 0, legLx: 0.22, legRx: 0.22, yawOff: 0 }
      ];
      const step = Math.floor(t / beatDur);
      const frac = (t % beatDur) / beatDur;
      const fromPose = poses[(step - 1 + poses.length * 4) % poses.length];
      const toPose = poses[step % poses.length];
      const u = Math.min(1, frac / 0.32);
      const ease = 1 - Math.pow(1 - u, 3);
      const lerpPose = (k) => fromPose[k] + (toPose[k] - fromPose[k]) * ease;
      const microHop = Math.sin(u * Math.PI) * 0.08;

      mesh.position.set(base.x, microHop, base.z);
      mesh.rotation.y = baseYaw + lerpPose('yawOff');

      if (rig) {
        rig.armL.rotation.x = lerpPose('armLx');
        rig.armL.rotation.z = lerpPose('armLz');
        rig.armR.rotation.x = lerpPose('armRx');
        rig.armR.rotation.z = lerpPose('armRz');
        rig.headPivot.rotation.y = lerpPose('headY');
        rig.headPivot.rotation.z = lerpPose('headZ');
        rig.torsoPivot.rotation.z = lerpPose('torsoZ');
        rig.legL.rotation.x = lerpPose('legLx');
        rig.legR.rotation.x = lerpPose('legRx');
      }
      return;
    }

    if (danceName === 'shuffle') {
      const beat = t * 7.2;
      const sway = Math.sin(beat * 0.5);
      const hop = Math.abs(Math.sin(beat)) * 0.20;
      mesh.position.set(base.x + sway * 0.22, hop, base.z);
      mesh.rotation.y = baseYaw + sway * 0.32;

      if (rig) {
        const swing = Math.sin(beat);
        rig.armL.rotation.z = -0.9 - swing * 0.65;
        rig.armR.rotation.z = 0.9 - swing * 0.65;
        rig.armL.rotation.x = swing * 0.7;
        rig.armR.rotation.x = -swing * 0.7;
        rig.torsoPivot.rotation.z = -sway * 0.22;
        rig.headPivot.rotation.z = sway * 0.22;
        rig.legL.rotation.x = swing * 0.62;
        rig.legR.rotation.x = -swing * 0.62;
        rig.legL.rotation.z = -0.14;
        rig.legR.rotation.z = 0.14;
      }
      return;
    }

    if (danceName === 'breakdance') {
      const flipFrac = Math.min(1, t / 0.24);
      const flipEase = 1 - Math.pow(1 - flipFrac, 2);
      const spinBounce = flipFrac >= 1 ? Math.abs(Math.sin(t * 9.0)) * 0.08 : Math.sin(flipFrac * Math.PI) * 0.32;

      mesh.position.set(base.x, spinBounce, base.z);
      mesh.rotation.y = baseYaw + t * 10.5;

      if (rig) {
        // Flip upside down onto head/antenna for a fast headspin + windmill legs
        rig.bodyGroup.rotation.z = flipEase * Math.PI;
        rig.bodyGroup.position.y = flipEase * 0.96;

        const kick = Math.sin(t * 11.0);
        rig.legL.rotation.z = -0.68 * flipEase;
        rig.legR.rotation.z = 0.68 * flipEase;
        rig.legL.rotation.x = kick * 0.55 * flipEase;
        rig.legR.rotation.x = -kick * 0.55 * flipEase;

        rig.armL.rotation.z = (-1.25 + Math.cos(t * 11.0) * 0.25) * flipEase;
        rig.armR.rotation.z = (1.25 - Math.cos(t * 11.0) * 0.25) * flipEase;
        rig.armL.rotation.x = -kick * 0.45 * flipEase;
        rig.armR.rotation.x = kick * 0.45 * flipEase;
        rig.torsoPivot.rotation.x = 0.14 * flipEase;
      } else {
        mesh.rotation.z = flipEase * Math.PI;
      }
      return;
    }

    // Default: 'happy_jump'
    const cycleDur = 0.72;
    const p = (t % cycleDur) / cycleDur;
    let jumpY = 0;
    let sx = 1;
    let sy = 1;
    let airAmount = 0;
    if (p < 0.16) {
      const sq = Math.sin((p / 0.16) * Math.PI);
      sx = 1 + sq * 0.13;
      sy = 1 - sq * 0.15;
    } else {
      const airP = (p - 0.16) / 0.84;
      airAmount = Math.sin(airP * Math.PI);
      jumpY = 4 * airP * (1 - airP) * 0.62;
      const stretch = airAmount * 0.12;
      sx = 1 - stretch * 0.55;
      sy = 1 + stretch;
    }
    mesh.position.set(base.x, jumpY, base.z);
    mesh.scale.set(sx, sy, sx);
    mesh.rotation.y = baseYaw + t * 4.4;
    mesh.rotation.z = Math.sin(t * 8.8) * 0.12;

    if (rig) {
      rig.armL.rotation.z = -0.35 - airAmount * 1.9;
      rig.armR.rotation.z = 0.35 + airAmount * 1.9;
      rig.armL.rotation.x = -airAmount * 0.35;
      rig.armR.rotation.x = -airAmount * 0.35;
      rig.legL.rotation.z = -airAmount * 0.45;
      rig.legR.rotation.z = airAmount * 0.45;
      rig.headPivot.rotation.z = Math.sin(t * 8.8) * 0.15;
    }
  }

  function updateFrame(now) {
    animFrameId = global.requestAnimationFrame(updateFrame);
    const dt = Math.min((now - lastTime) / 1000, 0.05) || 0.016;
    lastTime = now;
    const tSec = now * 0.001;
    const state = VS.Game.state;

    // 1. Camera Orbit, Auto-Follow & Panning
    const introActive = Boolean(VS.Intro && VS.Intro.isActive());
    if (introActive) {
      if (VS.Intro.isOrbiting()) {
        state.camTargetYaw += dt * 0.32;
      }
      const introLerp = Math.min(1, dt * 3.4);
      state.camYaw += (state.camTargetYaw - state.camYaw) * introLerp;
      state.camPitch += (state.camTargetPitch - state.camPitch) * introLerp;
      state.camDistance += (state.camTargetDistance - state.camDistance) * introLerp;
    } else {
      if (state.menuOpen) {
        state.camTargetYaw += dt * 0.16;
      }
      state.camYaw += (state.camTargetYaw - state.camYaw) * Math.min(1, dt * 10);
    }

    if (state.menuOpen || introActive) {
      state.camTargetX = 0;
      state.camTargetZ = 0;
    } else if (state.camAutoFollow) {
      if (isWholeMapVisible()) {
        state.camTargetX = 0;
        state.camTargetZ = 0;
      } else {
        const pWorld = gridToWorld(state.player.x, state.player.y);
        state.camTargetX = pWorld.x;
        state.camTargetZ = pWorld.z;
      }
    }

    const panLerp = Math.min(1, dt * 8);
    state.camLookX += (state.camTargetX - state.camLookX) * panLerp;
    state.camLookZ += (state.camTargetZ - state.camLookZ) * panLerp;

    const horizDist = Math.cos(state.camPitch) * state.camDistance;
    camera.position.set(
      state.camLookX + Math.sin(state.camYaw) * horizDist,
      Math.sin(state.camPitch) * state.camDistance,
      state.camLookZ + Math.cos(state.camYaw) * horizDist
    );
    camera.lookAt(state.camLookX, 0.15, state.camLookZ);

    // 2. Player Movement Hop, Wall Bump, Victory Dances & Idle Breathing
    if (state.player.mesh) {
      let diff = state.player.targetYaw - state.player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.player.yaw += diff * Math.min(1, dt * 18);

      const rig = state.player.mesh.userData && state.player.mesh.userData.rig;

      if (!state.won) {
        winCelebrateT = 0;
        resetPlayerRig(state.player.mesh);
        state.player.mesh.rotation.y = state.player.yaw;
      }

      if (state.player.animT < 1 && state.player.animFrom && state.player.animTo) {
        state.player.animT = Math.min(1, state.player.animT + dt / CONFIG.ANIM_DURATION);
        const ease = 1 - Math.pow(1 - state.player.animT, 3);
        const px = state.player.animFrom.x + (state.player.animTo.x - state.player.animFrom.x) * ease;
        const pz = state.player.animFrom.z + (state.player.animTo.z - state.player.animFrom.z) * ease;
        const hop = Math.sin(state.player.animT * Math.PI) * 0.24;
        state.player.mesh.position.set(px, hop, pz);
        if (rig) {
          const stride = Math.sin(state.player.animT * Math.PI) * 0.55;
          const dirSign = state.moves % 2 === 0 ? 1 : -1;
          rig.armL.rotation.x = stride * dirSign;
          rig.armR.rotation.x = -stride * dirSign;
          rig.legL.rotation.x = -stride * dirSign;
          rig.legR.rotation.x = stride * dirSign;
        }
        if (state.player.animT >= 1) {
          state.isAnimating = false;
          if (!state.won) resetPlayerRig(state.player.mesh);
        }
      } else if (state.won) {
        if (winCelebrateT === 0) {
          activeDanceIndex = pickVictoryDanceIndex();
        }
        winCelebrateT += dt;
        const base = gridToWorld(state.player.x, state.player.y);
        const danceName = VICTORY_DANCES[activeDanceIndex] || 'happy_jump';
        applyVictoryDance(state.player.mesh, rig, danceName, winCelebrateT, base, state.player.yaw);
      } else if (state.player.bumpT < 1 && state.player.bumpDir) {
        state.player.bumpT = Math.min(1, state.player.bumpT + dt / CONFIG.BUMP_DURATION);
        const base = gridToWorld(state.player.x, state.player.y);
        const nudge = Math.sin(state.player.bumpT * Math.PI) * 0.14;
        state.player.mesh.position.set(
          base.x + state.player.bumpDir.x * nudge,
          0,
          base.z + state.player.bumpDir.z * nudge
        );
      } else {
        const base = gridToWorld(state.player.x, state.player.y);
        state.player.mesh.position.set(base.x, Math.sin(tSec * 3.5) * 0.025, base.z);
      }
    }

    // 3. Crate Sliding Animation, Push Squash & Deadlock Pulse
    for (let i = 0; i < state.crates.length; i++) {
      const c = state.crates[i];
      if (c.animT < 1 && c.animFrom && c.animTo) {
        c.animT = Math.min(1, c.animT + dt / CONFIG.ANIM_DURATION);
        const ease = 1 - Math.pow(1 - c.animT, 3);
        const cx = c.animFrom.x + (c.animTo.x - c.animFrom.x) * ease;
        const cz = c.animFrom.z + (c.animTo.z - c.animFrom.z) * ease;
        c.mesh.position.set(cx, 0, cz);
        const s = Math.sin(c.animT * Math.PI);
        c.mesh.scale.set(1 + s * 0.07, 1 - s * 0.07, 1 + s * 0.07);
        if (c.pushDir) {
          c.mesh.rotation.z = -c.pushDir.x * s * 0.10;
          c.mesh.rotation.x = c.pushDir.z * s * 0.10;
        }
        if (c.animT >= 1) {
          c.mesh.scale.set(1, 1, 1);
          c.mesh.rotation.set(0, 0, 0);
        }
      }
      if (state.deadlockedCrateIds && state.deadlockedCrateIds.has(c.id)) {
        const pulse = 1 + Math.sin(tSec * 7.5) * 0.045;
        c.mesh.scale.set(pulse, 1 / Math.sqrt(pulse), pulse);
      } else if (c.animT >= 1 && (c.mesh.scale.x !== 1 || c.mesh.rotation.x !== 0 || c.mesh.rotation.z !== 0)) {
        c.mesh.scale.set(1, 1, 1);
        c.mesh.rotation.set(0, 0, 0);
      }
    }

    // 3b. Staggered Level Build-In Drop Animation
    if (boardBuildAnims.length > 0) {
      boardBuildElapsed += dt;
      const dropDur = 0.24;
      let anyRemaining = false;
      for (let i = 0; i < boardBuildAnims.length; i++) {
        const item = boardBuildAnims[i];
        const localT = boardBuildElapsed - item.delay;
        if (localT <= 0) {
          anyRemaining = true;
          continue;
        }
        const u = Math.min(1, localT / dropDur);
        const ease = 1 - Math.pow(1 - u, 3);
        const sc = 0.45 + 0.55 * ease;
        item.obj.position.y = item.targetY + (1 - ease) * 1.4;
        item.obj.scale.set(sc, sc, sc);
        if (u < 1) anyRemaining = true;
      }
      if (!anyRemaining) {
        finishBoardBuildImmediate();
      }
    }

    // 4. Floating Goal Crystals & 3D Guide Arrow
    state.goalMeshes.forEach((obj) => {
      if (obj.crystal.visible) {
        obj.crystal.rotation.y = tSec * 1.8;
        obj.crystal.position.y = 0.30 + Math.sin(tSec * 3.2) * 0.06;
      }
    });

    if (guideArrowGroup && guideArrowMeta) {
      const slide = Math.sin(tSec * 4.5) * 0.14;
      const bob = Math.sin(tSec * 3.2) * 0.07;
      guideArrowGroup.position.set(
        guideArrowMeta.baseX + guideArrowMeta.dx * slide,
        1.14 + bob,
        guideArrowMeta.baseZ + guideArrowMeta.dy * slide
      );
      if (guideArrowMeta.ring) {
        const s = 1 + Math.sin(tSec * 5) * 0.08;
        guideArrowMeta.ring.scale.set(s, s, 1);
        guideArrowMeta.ring.position.set(-guideArrowMeta.dx * slide, -(1.06 + bob), -guideArrowMeta.dy * slide);
      }
    }

    // 4b. Subtle Voxel Goal-Lock Ripple
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.t += dt;
      const p = Math.min(1, sw.t / sw.dur);
      const ease = 1 - Math.pow(1 - p, 2);
      if (sw.ring) {
        const s = 0.92 + ease * 0.48;
        sw.ring.scale.set(s, s, 1);
        sw.ringMat.opacity = 0.58 * (1 - p);
      }
      if (p >= 1) {
        if (particleGroup && sw.ring) {
          particleGroup.remove(sw.ring);
        }
        sw.ringGeo.dispose();
        sw.ringMat.dispose();
        shockwaves.splice(i, 1);
      }
    }

    // 4c. Per-Theme Ambient Diorama Particles
    for (let i = 0; i < ambientMotes.length; i++) {
      const m = ambientMotes[i];
      m.x += ambientThemeCfg.driftX * dt * m.speedScale;
      m.y += ambientThemeCfg.driftY * dt * m.speedScale;
      m.z += ambientThemeCfg.driftZ * dt * m.speedScale;
      if (m.x > 8) m.x -= 16;
      if (m.x < -8) m.x += 16;
      if (m.y > 7) m.y -= 8;
      if (m.y < -1) m.y += 8;
      if (m.z > 8) m.z -= 16;
      if (m.z < -8) m.z += 16;
      const swayX = Math.sin(tSec * ambientThemeCfg.swayFreq + m.phase) * ambientThemeCfg.swayAmp;
      const swayZ = Math.cos(tSec * ambientThemeCfg.swayFreq * 0.8 + m.phase) * ambientThemeCfg.swayAmp;
      m.mesh.position.set(m.x + swayX, m.y, m.z + swayZ);
      m.mesh.rotation.x = tSec * 0.5 + m.phase;
      m.mesh.rotation.y = tSec * 0.6 + m.phase;
    }

    // 5. Voxel Particles
    VS.Voxels.updateParticles(particleGroup, state.particles);

    renderer.render(scene, camera);
  }

  function applyThemeLighting(theme) {
    if (!theme) return;
    const preset = AMBIENT_THEME_PRESETS[theme.id];
    if (preset) {
      ambientThemeCfg = preset;
      if (ambientMotes.length > 0 && ambientMotes[0].mat) {
        ambientMotes[0].mat.color.setHex(preset.color);
      }
    }
    const l = theme.lighting;
    if (l) {
      if (hemiLight) {
        hemiLight.color.setHex(l.hemiSky);
        hemiLight.groundColor.setHex(l.hemiGround);
        hemiLight.intensity = l.hemiIntensity;
      }
      if (dirLight) {
        dirLight.color.setHex(l.dirColor);
        dirLight.intensity = l.dirIntensity;
      }
      if (rimLight) {
        rimLight.color.setHex(l.rimColor);
        rimLight.intensity = l.rimIntensity;
      }
    }
    if (theme.bgGradient && global.document) {
      global.document.documentElement.style.background = theme.bgGradient;
      if (global.document.body) {
        global.document.body.style.background = theme.bgGradient;
      }
    }
  }

  function refreshPlayerMesh(accessory) {
    const state = VS.Game && VS.Game.state;
    if (!levelGroup || !state || !state.player || !state.player.mesh) return;
    const oldMesh = state.player.mesh;
    const pos = oldMesh.position.clone();
    const rotY = oldMesh.rotation.y;
    levelGroup.remove(oldMesh);

    const newMesh = VS.Voxels.buildPlayerVoxel(accessory || 'antenna');
    newMesh.position.copy(pos);
    newMesh.rotation.y = rotY;
    levelGroup.add(newMesh);
    state.player.mesh = newMesh;
  }

  function startLoop() {
    if (animFrameId !== null) {
      global.cancelAnimationFrame(animFrameId);
    }
    lastTime = global.performance ? global.performance.now() : 0;
    animFrameId = global.requestAnimationFrame(updateFrame);
  }

  VS.Renderer = {
    init,
    onWindowResize,
    getDomElement,
    gridToWorld,
    computeCameraDistance,
    isWholeMapVisible,
    clampCameraTarget,
    panByScreenDelta,
    orbitByDelta,
    rotateCamera90,
    zoomByDelta,
    setCameraDistance,
    computePlayableTiles,
    clearBoard,
    buildBoard,
    finishBoardBuildImmediate,
    spawnGoalShockwave,
    setGuideArrow,
    clearGuideArrow,
    applyThemeLighting,
    refreshPlayerMesh,
    spawnParticles,
    raycastFloor,
    startLoop,
    getVictoryDances: () => VICTORY_DANCES.slice(),
    setNextDance: (name) => {
      forcedDanceName = VICTORY_DANCES.includes(name) ? name : null;
    },
    applyVictoryDance
  };
})(window);
