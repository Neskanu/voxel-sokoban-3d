(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});
  const CONFIG = VS.CONFIG;

  let scene = null;
  let camera = null;
  let renderer = null;
  let levelGroup = null;
  let particleGroup = null;
  let dirLight = null;
  let raycaster = null;
  let animFrameId = null;
  let lastTime = 0;

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
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.85);
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

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    levelGroup = new THREE.Group();
    scene.add(levelGroup);

    particleGroup = new THREE.Group();
    scene.add(particleGroup);

    global.addEventListener('resize', onWindowResize);
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

    const cosY = Math.abs(Math.cos(state.camYaw));
    const sinY = Math.abs(Math.sin(state.camYaw));
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

  function clearBoard() {
    const state = VS.Game.state;
    if (levelGroup) {
      while (levelGroup.children.length > 0) {
        levelGroup.remove(levelGroup.children[0]);
      }
    }
    VS.Voxels.clearParticles(particleGroup, state.particles);
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

        const isLight = (x + y) % 2 === 0;
        const floorTile = Voxels.createBox(
          0.98, 0.24, 0.98,
          isLight ? MAT.floorLight : MAT.floorDark,
          pos.x, -0.12, pos.z, false, true
        );
        floorTile.userData = { gx: x, gy: y };
        levelGroup.add(floorTile);
        state.floorMeshes.push(floorTile);

        const bedrock = Voxels.createBox(0.96, 0.45, 0.96, MAT.bedrock, pos.x, -0.46, pos.z, false, false);
        levelGroup.add(bedrock);

        if (ch === '#') {
          state.walls.add(key);
          const wall = Voxels.buildWallVoxel(x, y);
          wall.position.set(pos.x, 0, pos.z);
          levelGroup.add(wall);
        } else {
          state.floors.add(key);
        }

        if (ch === '.' || ch === '*' || ch === '+') {
          state.goals.add(key);
          const goalObj = Voxels.buildGoalVoxel();
          goalObj.group.position.set(pos.x, 0, pos.z);
          levelGroup.add(goalObj.group);
          state.goalMeshes.set(key, goalObj);
        }

        if (ch === '$' || ch === '*') {
          const crateObj = Voxels.buildCrateVoxel();
          crateObj.group.position.set(pos.x, 0, pos.z);
          levelGroup.add(crateObj.group);
          state.crates.push({
            id: crateId++,
            x,
            y,
            mesh: crateObj.group,
            coreMeshes: crateObj.coreMeshes,
            trimMeshes: crateObj.trimMeshes,
            animFrom: null,
            animTo: null,
            animT: 1
          });
        }

        if (ch === '@' || ch === '+') {
          const playerMesh = Voxels.buildPlayerVoxel();
          playerMesh.position.set(pos.x, 0, pos.z);
          levelGroup.add(playerMesh);
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

  function updateFrame(now) {
    animFrameId = global.requestAnimationFrame(updateFrame);
    const dt = Math.min((now - lastTime) / 1000, 0.05) || 0.016;
    lastTime = now;
    const tSec = now * 0.001;
    const state = VS.Game.state;

    // 1. Camera Orbit, Auto-Follow & Panning
    if (state.menuOpen) {
      state.camTargetYaw += dt * 0.16;
    }
    state.camYaw += (state.camTargetYaw - state.camYaw) * Math.min(1, dt * 10);

    if (state.camAutoFollow) {
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

    // 2. Player Movement Hop, Wall Bump & Idle Breathing
    if (state.player.mesh) {
      let diff = state.player.targetYaw - state.player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.player.yaw += diff * Math.min(1, dt * 18);
      state.player.mesh.rotation.y = state.player.yaw;

      if (state.player.animT < 1 && state.player.animFrom && state.player.animTo) {
        state.player.animT = Math.min(1, state.player.animT + dt / CONFIG.ANIM_DURATION);
        const ease = 1 - Math.pow(1 - state.player.animT, 3);
        const px = state.player.animFrom.x + (state.player.animTo.x - state.player.animFrom.x) * ease;
        const pz = state.player.animFrom.z + (state.player.animTo.z - state.player.animFrom.z) * ease;
        const hop = Math.sin(state.player.animT * Math.PI) * 0.24;
        state.player.mesh.position.set(px, hop, pz);
        if (state.player.animT >= 1) {
          state.isAnimating = false;
        }
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

    // 3. Crate Sliding Animation
    for (let i = 0; i < state.crates.length; i++) {
      const c = state.crates[i];
      if (c.animT < 1 && c.animFrom && c.animTo) {
        c.animT = Math.min(1, c.animT + dt / CONFIG.ANIM_DURATION);
        const ease = 1 - Math.pow(1 - c.animT, 3);
        const cx = c.animFrom.x + (c.animTo.x - c.animFrom.x) * ease;
        const cz = c.animFrom.z + (c.animTo.z - c.animFrom.z) * ease;
        c.mesh.position.set(cx, 0, cz);
      }
    }

    // 4. Floating Goal Crystals
    state.goalMeshes.forEach((obj) => {
      if (obj.crystal.visible) {
        obj.crystal.rotation.y = tSec * 1.8;
        obj.crystal.position.y = 0.30 + Math.sin(tSec * 3.2) * 0.06;
      }
    });

    // 5. Voxel Particles
    VS.Voxels.updateParticles(particleGroup, state.particles);

    renderer.render(scene, camera);
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
    spawnParticles,
    raycastFloor,
    startLoop
  };
})(window);
