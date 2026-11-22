(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const GEO_CACHE = new Map();
  const PARTICLE_MAT_CACHE = new Map();
  let particleGeo = null;
  let MAT = null;

  function init() {
    if (typeof global.THREE === 'undefined') {
      throw new Error('Three.js failed to load.');
    }

    const THREE = global.THREE;

    MAT = {
      floorLight:   new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.05 }),
      floorDark:    new THREE.MeshStandardMaterial({ color: 0x293548, roughness: 0.85, metalness: 0.05 }),
      bedrock:      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.02 }),
      wallStone:    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82, metalness: 0.08 }),
      wallCap:      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.78, metalness: 0.08 }),
      wallDark:     new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, metalness: 0.05 }),
      wallMoss:     new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85, metalness: 0.02 }),
      crateWood:    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65, metalness: 0.08 }),
      crateTrim:    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.72, metalness: 0.1 }),
      crateDone:    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.15 }),
      crateDoneTrim:new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.6, metalness: 0.15 }),
      goalBase:     new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.2 }),
      goalCrystal:  new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3 }),
      playerBody:   new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.42, metalness: 0.15 }),
      playerDark:   new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.2 }),
      playerPack:   new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.1 }),
      playerVisor:  new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.6 }),
      playerEye:    new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 0.9 }),
      playerAccent: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.3 })
    };

    particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    VS.Voxels.MAT = MAT;
  }

  function setMatProps(mat, spec) {
    if (!mat || !spec) return;
    if (spec.color !== undefined) mat.color.setHex(spec.color);
    if (mat.emissive) {
      mat.emissive.setHex(spec.emissive !== undefined ? spec.emissive : 0x000000);
      mat.emissiveIntensity = spec.emissiveIntensity !== undefined ? spec.emissiveIntensity : 0;
    }
    if (spec.roughness !== undefined) mat.roughness = spec.roughness;
    if (spec.metalness !== undefined) mat.metalness = spec.metalness;
    mat.needsUpdate = true;
  }

  function applyMaterialGroup(specMap) {
    if (!MAT || !specMap) return;
    Object.entries(specMap).forEach(([key, spec]) => {
      if (MAT[key]) {
        setMatProps(MAT[key], spec);
      }
    });
  }

  function applyThemeMaterials(theme) {
    if (theme && theme.materials) applyMaterialGroup(theme.materials);
  }

  function applyBotMaterials(bot) {
    if (bot && bot.materials) applyMaterialGroup(bot.materials);
  }

  function applyCrateMaterials(crate) {
    if (crate && crate.materials) applyMaterialGroup(crate.materials);
  }

  function createBox(w, h, d, mat, x = 0, y = 0, z = 0, castShadow = true, receiveShadow = true) {
    const THREE = global.THREE;
    const key = `${w}_${h}_${d}`;
    let geo = GEO_CACHE.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d);
      GEO_CACHE.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }

  function buildWallVoxel(gx, gz) {
    const group = new global.THREE.Group();
    const seed = (gx * 37 + gz * 17) % 10;
    const height = 0.92 + (seed % 3) * 0.06;

    group.add(createBox(0.98, height, 0.98, MAT.wallStone, 0, height / 2, 0));
    group.add(createBox(0.88, 0.1, 0.88, MAT.wallCap, 0, height + 0.04, 0));

    if (seed % 2 === 0) {
      group.add(createBox(0.32, 0.16, 0.32, MAT.wallDark, 0.26, height + 0.08, -0.22));
    }
    if (seed === 1 || seed === 6) {
      group.add(createBox(0.28, 0.08, 0.28, MAT.wallMoss, -0.22, height + 0.09, 0.24));
    }
    return group;
  }

  function buildCrateVoxel() {
    const group = new global.THREE.Group();
    const coreMeshes = [];
    const trimMeshes = [];

    const core = createBox(0.76, 0.76, 0.76, MAT.crateWood, 0, 0.43, 0);
    group.add(core);
    coreMeshes.push(core);

    const t = 0.11;
    const s = 0.86;
    const o = (s - t) / 2;

    [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([cx, cz]) => {
      const post = createBox(t, s, t, MAT.crateTrim, cx, 0.43, cz);
      group.add(post);
      trimMeshes.push(post);
    });

    [0.43 - o, 0.43 + o].forEach((cy) => {
      const railX1 = createBox(s, t, t, MAT.crateTrim, 0, cy, -o);
      const railX2 = createBox(s, t, t, MAT.crateTrim, 0, cy, o);
      const railZ1 = createBox(t, t, s, MAT.crateTrim, -o, cy, 0);
      const railZ2 = createBox(t, t, s, MAT.crateTrim, o, cy, 0);
      [railX1, railX2, railZ1, railZ2].forEach((r) => {
        group.add(r);
        trimMeshes.push(r);
      });
    });

    const slat = createBox(0.56, 0.06, 0.14, MAT.crateTrim, 0, 0.84, 0);
    group.add(slat);
    trimMeshes.push(slat);

    return { group, coreMeshes, trimMeshes };
  }

  function buildGoalVoxel() {
    const group = new global.THREE.Group();
    const pad = createBox(0.78, 0.06, 0.78, MAT.goalBase, 0, 0.03, 0, false, true);
    group.add(pad);

    const crystal = createBox(0.24, 0.24, 0.24, MAT.goalCrystal, 0, 0.32, 0, false, false);
    crystal.rotation.set(Math.PI / 4, Math.PI / 4, 0);
    group.add(crystal);

    return { group, pad, crystal };
  }

  function addPlayerAccessory(group, accessory) {
    if (accessory === 'hardhat') {
      group.add(createBox(0.50, 0.14, 0.48, MAT.playerAccent, 0, 0.91, 0.01));
      group.add(createBox(0.44, 0.05, 0.16, MAT.playerAccent, 0, 0.85, 0.24));
      group.add(createBox(0.14, 0.05, 0.36, MAT.playerAccent, 0, 0.99, 0.01));
      return;
    }

    if (accessory === 'cyberfins') {
      [-0.24, 0.24].forEach((sideX) => {
        group.add(createBox(0.06, 0.26, 0.18, MAT.playerDark, sideX, 0.78, -0.02));
        group.add(createBox(0.06, 0.14, 0.10, MAT.playerAccent, sideX, 0.95, -0.05, false, false));
      });
      group.add(createBox(0.28, 0.05, 0.10, MAT.playerAccent, 0, 0.90, 0.05, false, false));
      return;
    }

    if (accessory === 'cryopack') {
      [-0.10, 0.10].forEach((sideX) => {
        group.add(createBox(0.12, 0.32, 0.12, MAT.playerAccent, sideX, 0.39, -0.25));
        group.add(createBox(0.08, 0.06, 0.08, MAT.playerDark, sideX, 0.57, -0.25));
      });
      group.add(createBox(0.36, 0.07, 0.16, MAT.playerAccent, 0, 0.90, 0.02));
      return;
    }

    if (accessory === 'kabuto') {
      group.add(createBox(0.48, 0.12, 0.46, MAT.playerDark, 0, 0.91, 0.01));
      group.add(createBox(0.54, 0.05, 0.44, MAT.playerDark, 0, 0.85, -0.02));
      group.add(createBox(0.10, 0.10, 0.06, MAT.playerAccent, 0, 0.95, 0.24, false, false));
      group.add(createBox(0.08, 0.16, 0.06, MAT.playerAccent, -0.11, 1.03, 0.23, false, false));
      group.add(createBox(0.08, 0.16, 0.06, MAT.playerAccent, 0.11, 1.03, 0.23, false, false));
      return;
    }

    if (accessory === 'crown') {
      group.add(createBox(0.44, 0.09, 0.42, MAT.playerAccent, 0, 0.92, 0.01));
      [
        [-0.14, 1.01, 0.16],
        [0, 1.03, 0.16],
        [0.14, 1.01, 0.16],
        [-0.14, 1.01, -0.14],
        [0.14, 1.01, -0.14]
      ].forEach(([px, py, pz]) => {
        group.add(createBox(0.08, 0.11, 0.08, MAT.playerAccent, px, py, pz));
      });
      return;
    }

    // Default: 'antenna'
    group.add(createBox(0.05, 0.14, 0.05, MAT.playerDark, 0, 0.94, 0));
    group.add(createBox(0.10, 0.10, 0.10, MAT.playerAccent, 0, 1.03, 0, false, false));
  }

  function buildPlayerVoxel(accessory = 'antenna') {
    const group = new global.THREE.Group();

    // Feet
    group.add(createBox(0.18, 0.16, 0.22, MAT.playerDark, -0.14, 0.08, 0.02));
    group.add(createBox(0.18, 0.16, 0.22, MAT.playerDark, 0.14, 0.08, 0.02));

    // Torso & arms
    group.add(createBox(0.46, 0.36, 0.34, MAT.playerBody, 0, 0.34, 0));
    group.add(createBox(0.12, 0.24, 0.16, MAT.playerDark, -0.28, 0.34, 0.06));
    group.add(createBox(0.12, 0.24, 0.16, MAT.playerDark, 0.28, 0.34, 0.06));

    // Backpack
    group.add(createBox(0.32, 0.26, 0.14, MAT.playerPack, 0, 0.35, -0.22));

    // Head, visor & glowing eyes
    group.add(createBox(0.44, 0.36, 0.42, MAT.playerBody, 0, 0.70, 0.01));
    group.add(createBox(0.36, 0.16, 0.06, MAT.playerVisor, 0, 0.71, 0.21, false, false));
    group.add(createBox(0.08, 0.08, 0.04, MAT.playerEye, -0.09, 0.71, 0.23, false, false));
    group.add(createBox(0.08, 0.08, 0.04, MAT.playerEye, 0.09, 0.71, 0.23, false, false));

    addPlayerAccessory(group, accessory);

    return group;
  }

  function getParticleMaterial(colorHex) {
    let mat = PARTICLE_MAT_CACHE.get(colorHex);
    if (!mat) {
      mat = new global.THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.4,
        roughness: 0.4
      });
      PARTICLE_MAT_CACHE.set(colorHex, mat);
    }
    return mat;
  }

  function spawnParticles(particleGroup, particles, worldX, worldY, worldZ, colorHex, count = 10, spread = 0.08) {
    if (!particleGroup || !particleGeo) return;
    const mat = getParticleMaterial(colorHex);

    for (let i = 0; i < count; i++) {
      const mesh = new global.THREE.Mesh(particleGeo, mat);
      mesh.position.set(worldX, worldY, worldZ);
      particleGroup.add(mesh);

      particles.push({
        mesh,
        vx: (Math.random() - 0.5) * spread * 2,
        vy: Math.random() * spread * 1.8 + 0.04,
        vz: (Math.random() - 0.5) * spread * 2,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.02
      });
    }
  }

  function updateParticles(particleGroup, particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.vy -= 0.006;
      p.mesh.rotation.x += 0.12;
      p.mesh.rotation.y += 0.12;
      p.life -= p.decay;

      const s = Math.max(0.01, p.life);
      p.mesh.scale.set(s, s, s);
      if (p.life <= 0) {
        particleGroup.remove(p.mesh);
        particles.splice(i, 1);
      }
    }
  }

  function clearParticles(particleGroup, particles) {
    if (particleGroup) {
      while (particleGroup.children.length > 0) {
        particleGroup.remove(particleGroup.children[0]);
      }
    }
    particles.length = 0;
  }

  VS.Voxels = {
    init,
    MAT: null,
    createBox,
    applyThemeMaterials,
    applyBotMaterials,
    applyCrateMaterials,
    buildWallVoxel,
    buildCrateVoxel,
    buildGoalVoxel,
    buildPlayerVoxel,
    spawnParticles,
    updateParticles,
    clearParticles
  };
})(window);
