(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const THEMES = [
    {
      id: 'classic-warehouse',
      name: 'Slate Warehouse',
      subtitle: 'Original steel & moss diorama',
      price: 0,
      proExclusive: false,
      swatches: ['#334155', '#64748b', '#38bdf8'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 70%, #020617 100%)',
      tgHeaderColor: '#0f172a',
      tgBgColor: '#020617',
      lighting: {
        hemiSky: 0xe0f2fe,
        hemiGround: 0x1e293b,
        hemiIntensity: 0.85,
        dirColor: 0xfffbeb,
        dirIntensity: 1.15,
        rimColor: 0x38bdf8,
        rimIntensity: 0.4
      },
      materials: {
        floorLight: { color: 0x334155, roughness: 0.85, metalness: 0.05 },
        floorDark: { color: 0x293548, roughness: 0.85, metalness: 0.05 },
        bedrock: { color: 0x0f172a, roughness: 0.95, metalness: 0.02 },
        wallStone: { color: 0x64748b, roughness: 0.82, metalness: 0.08 },
        wallCap: { color: 0x94a3b8, roughness: 0.78, metalness: 0.08 },
        wallDark: { color: 0x475569, roughness: 0.88, metalness: 0.05 },
        wallMoss: { color: 0x22c55e, roughness: 0.85, metalness: 0.02 },
        goalBase: { color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.2 },
        goalCrystal: { color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3 }
      }
    },
    {
      id: 'cyber-neon',
      name: 'Cyber Neon',
      subtitle: 'Obsidian grid & synth glow',
      price: 250,
      proExclusive: false,
      swatches: ['#1e1b4b', '#ec4899', '#22d3ee'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #311042 0%, #0f0722 65%, #03010a 100%)',
      tgHeaderColor: '#0f0722',
      tgBgColor: '#03010a',
      lighting: {
        hemiSky: 0xc084fc,
        hemiGround: 0x090d16,
        hemiIntensity: 0.8,
        dirColor: 0xe0f2fe,
        dirIntensity: 1.05,
        rimColor: 0xec4899,
        rimIntensity: 0.75
      },
      materials: {
        floorLight: { color: 0x1e1b4b, roughness: 0.65, metalness: 0.22 },
        floorDark: { color: 0x111827, roughness: 0.7, metalness: 0.25 },
        bedrock: { color: 0x050510, roughness: 0.9, metalness: 0.1 },
        wallStone: { color: 0x312e81, roughness: 0.55, metalness: 0.3 },
        wallCap: { color: 0x6366f1, roughness: 0.4, metalness: 0.35 },
        wallDark: { color: 0x1e1b4b, roughness: 0.65, metalness: 0.25 },
        wallMoss: { color: 0xec4899, emissive: 0xdb2777, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.2 },
        goalBase: { color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.65, roughness: 0.3, metalness: 0.35 },
        goalCrystal: { color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.4 }
      }
    },
    {
      id: 'desert-ruins',
      name: 'Sunlit Sandstone',
      subtitle: 'Desert temple & oasis pads',
      price: 300,
      proExclusive: false,
      swatches: ['#d97706', '#f59e0b', '#14b8a6'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #451a03 0%, #271206 68%, #0f0703 100%)',
      tgHeaderColor: '#271206',
      tgBgColor: '#0f0703',
      lighting: {
        hemiSky: 0xfef3c7,
        hemiGround: 0x451a03,
        hemiIntensity: 0.95,
        dirColor: 0xfde68a,
        dirIntensity: 1.25,
        rimColor: 0x2dd4bf,
        rimIntensity: 0.35
      },
      materials: {
        floorLight: { color: 0x78350f, roughness: 0.88, metalness: 0.04 },
        floorDark: { color: 0x5c280c, roughness: 0.9, metalness: 0.04 },
        bedrock: { color: 0x291204, roughness: 0.95, metalness: 0.02 },
        wallStone: { color: 0xd97706, roughness: 0.85, metalness: 0.05 },
        wallCap: { color: 0xfbbf24, roughness: 0.75, metalness: 0.06 },
        wallDark: { color: 0xb45309, roughness: 0.88, metalness: 0.04 },
        wallMoss: { color: 0x65a30d, roughness: 0.85, metalness: 0.02 },
        goalBase: { color: 0x14b8a6, emissive: 0x0f766e, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2 },
        goalCrystal: { color: 0x5eead4, emissive: 0x2dd4bf, emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.3 }
      }
    },
    {
      id: 'frost-cavern',
      name: 'Glacier Cavern',
      subtitle: 'Frosted slate & aurora ice',
      price: 350,
      proExclusive: false,
      swatches: ['#bae6fd', '#60a5fa', '#2dd4bf'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #164e63 0%, #0c2438 68%, #020814 100%)',
      tgHeaderColor: '#0c2438',
      tgBgColor: '#020814',
      lighting: {
        hemiSky: 0xe0f2fe,
        hemiGround: 0x0f172a,
        hemiIntensity: 0.95,
        dirColor: 0xf0f9ff,
        dirIntensity: 1.15,
        rimColor: 0x2dd4bf,
        rimIntensity: 0.55
      },
      materials: {
        floorLight: { color: 0x475569, roughness: 0.55, metalness: 0.14 },
        floorDark: { color: 0x334155, roughness: 0.58, metalness: 0.14 },
        bedrock: { color: 0x0b172a, roughness: 0.85, metalness: 0.08 },
        wallStone: { color: 0x7dd3fc, roughness: 0.42, metalness: 0.18 },
        wallCap: { color: 0xf1f5f9, roughness: 0.65, metalness: 0.05 },
        wallDark: { color: 0x38bdf8, roughness: 0.45, metalness: 0.2 },
        wallMoss: { color: 0xe0f2fe, roughness: 0.7, metalness: 0.05 },
        goalBase: { color: 0x2dd4bf, emissive: 0x0d9488, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.25 },
        goalCrystal: { color: 0x99f6e4, emissive: 0x2dd4bf, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.35 }
      }
    },
    {
      id: 'sakura-zen',
      name: 'Sakura Zen',
      subtitle: 'Cedar courtyard & cherry blossoms',
      price: 450,
      proExclusive: false,
      swatches: ['#57534e', '#f472b6', '#fbcfe8'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #4a1d3a 0%, #1f1224 68%, #09050d 100%)',
      tgHeaderColor: '#1f1224',
      tgBgColor: '#09050d',
      lighting: {
        hemiSky: 0xfce7f3,
        hemiGround: 0x291822,
        hemiIntensity: 0.9,
        dirColor: 0xfff1f2,
        dirIntensity: 1.1,
        rimColor: 0xf472b6,
        rimIntensity: 0.55
      },
      materials: {
        floorLight: { color: 0x574238, roughness: 0.82, metalness: 0.04 },
        floorDark: { color: 0x44322a, roughness: 0.85, metalness: 0.04 },
        bedrock: { color: 0x1e1316, roughness: 0.95, metalness: 0.02 },
        wallStone: { color: 0xa8a29e, roughness: 0.78, metalness: 0.06 },
        wallCap: { color: 0xfbcfe8, roughness: 0.72, metalness: 0.04 },
        wallDark: { color: 0x78716c, roughness: 0.82, metalness: 0.05 },
        wallMoss: { color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.2, roughness: 0.72, metalness: 0.05 },
        goalBase: { color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2 },
        goalCrystal: { color: 0xfbcfe8, emissive: 0xf472b6, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.25 }
      }
    },
    {
      id: 'obsidian-gold',
      name: 'Obsidian Vault',
      subtitle: 'Volcanic basalt & gilded trims',
      price: 750,
      proExclusive: true,
      swatches: ['#18181b', '#fbbf24', '#34d399'],
      bgGradient: 'radial-gradient(circle at 50% 20%, #2e2410 0%, #111116 68%, #030305 100%)',
      tgHeaderColor: '#111116',
      tgBgColor: '#030305',
      lighting: {
        hemiSky: 0xfef3c7,
        hemiGround: 0x09090b,
        hemiIntensity: 0.82,
        dirColor: 0xfde68a,
        dirIntensity: 1.25,
        rimColor: 0xfbbf24,
        rimIntensity: 0.65
      },
      materials: {
        floorLight: { color: 0x27272a, roughness: 0.5, metalness: 0.32 },
        floorDark: { color: 0x18181b, roughness: 0.55, metalness: 0.35 },
        bedrock: { color: 0x09090b, roughness: 0.9, metalness: 0.15 },
        wallStone: { color: 0x18181b, roughness: 0.45, metalness: 0.35 },
        wallCap: { color: 0xfbbf24, roughness: 0.28, metalness: 0.72 },
        wallDark: { color: 0x3f3f46, roughness: 0.52, metalness: 0.3 },
        wallMoss: { color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.25, roughness: 0.32, metalness: 0.65 },
        goalBase: { color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.65 },
        goalCrystal: { color: 0xfef08a, emissive: 0xfbbf24, emissiveIntensity: 0.88, roughness: 0.15, metalness: 0.7 }
      }
    }
  ];

  const BOT_SKINS = [
    {
      id: 'worker-bot',
      name: 'Scout Bot',
      subtitle: 'Standard glowing antenna',
      price: 0,
      proExclusive: false,
      accessory: 'antenna',
      swatches: ['#38bdf8', '#f59e0b', '#34d399'],
      materials: {
        playerBody: { color: 0x38bdf8, roughness: 0.42, metalness: 0.15 },
        playerDark: { color: 0x1e293b, roughness: 0.65, metalness: 0.2 },
        playerPack: { color: 0xf59e0b, roughness: 0.55, metalness: 0.1 },
        playerVisor: { color: 0x0f172a, roughness: 0.2, metalness: 0.6 },
        playerEye: { color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 },
        playerAccent: { color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.3 }
      }
    },
    {
      id: 'builder-bot',
      name: 'Foreman Bot',
      subtitle: 'Safety hard-hat & hi-vis',
      price: 180,
      proExclusive: false,
      accessory: 'hardhat',
      swatches: ['#f97316', '#facc15', '#334155'],
      materials: {
        playerBody: { color: 0xf97316, roughness: 0.48, metalness: 0.12 },
        playerDark: { color: 0x334155, roughness: 0.68, metalness: 0.2 },
        playerPack: { color: 0x64748b, roughness: 0.55, metalness: 0.25 },
        playerVisor: { color: 0x0f172a, roughness: 0.2, metalness: 0.6 },
        playerEye: { color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 },
        playerAccent: { color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.18, roughness: 0.38, metalness: 0.1 }
      }
    },
    {
      id: 'cyber-bot',
      name: 'Neon Runner',
      subtitle: 'Stealth hull & cyber fins',
      price: 280,
      proExclusive: false,
      accessory: 'cyberfins',
      swatches: ['#1e293b', '#ec4899', '#22d3ee'],
      materials: {
        playerBody: { color: 0x1e293b, roughness: 0.32, metalness: 0.45 },
        playerDark: { color: 0x090d16, roughness: 0.5, metalness: 0.4 },
        playerPack: { color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.3 },
        playerVisor: { color: 0x020617, roughness: 0.15, metalness: 0.7 },
        playerEye: { color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.1 },
        playerAccent: { color: 0xec4899, emissive: 0xdb2777, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.35 }
      }
    },
    {
      id: 'frost-bot',
      name: 'Arctic Rover',
      subtitle: 'Polar armor & cryo tanks',
      price: 320,
      proExclusive: false,
      accessory: 'cryopack',
      swatches: ['#e2e8f0', '#38bdf8', '#0ea5e9'],
      materials: {
        playerBody: { color: 0xe2e8f0, roughness: 0.38, metalness: 0.2 },
        playerDark: { color: 0x475569, roughness: 0.55, metalness: 0.28 },
        playerPack: { color: 0x0284c7, roughness: 0.42, metalness: 0.25 },
        playerVisor: { color: 0x0c4a6e, roughness: 0.18, metalness: 0.65 },
        playerEye: { color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.95, roughness: 0.2, metalness: 0.1 },
        playerAccent: { color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.65, roughness: 0.25, metalness: 0.3 }
      }
    },
    {
      id: 'sakura-bot',
      name: 'Sakura Ronin',
      subtitle: 'Blossom armor & kabuto crest',
      price: 400,
      proExclusive: false,
      accessory: 'kabuto',
      swatches: ['#f8fafc', '#f472b6', '#334155'],
      materials: {
        playerBody: { color: 0xf8fafc, roughness: 0.42, metalness: 0.14 },
        playerDark: { color: 0x334155, roughness: 0.58, metalness: 0.25 },
        playerPack: { color: 0xdb2777, roughness: 0.45, metalness: 0.18 },
        playerVisor: { color: 0x1f1224, roughness: 0.2, metalness: 0.6 },
        playerEye: { color: 0xfbcfe8, emissive: 0xf472b6, emissiveIntensity: 0.95, roughness: 0.2, metalness: 0.1 },
        playerAccent: { color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.45, roughness: 0.28, metalness: 0.35 }
      }
    },
    {
      id: 'royal-bot',
      name: 'Gilded King',
      subtitle: 'Brushed gold & voxel crown',
      price: 600,
      proExclusive: true,
      accessory: 'crown',
      swatches: ['#fbbf24', '#7e22ce', '#fef08a'],
      materials: {
        playerBody: { color: 0xfbbf24, roughness: 0.26, metalness: 0.72 },
        playerDark: { color: 0x451a03, roughness: 0.45, metalness: 0.45 },
        playerPack: { color: 0x7e22ce, roughness: 0.38, metalness: 0.3 },
        playerVisor: { color: 0x18181b, roughness: 0.16, metalness: 0.75 },
        playerEye: { color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.2 },
        playerAccent: { color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 }
      }
    }
  ];

  const CRATE_SKINS = [
    {
      id: 'wood-crate',
      name: 'Timber Cargo',
      subtitle: 'Classic oak & emerald lock',
      price: 0,
      proExclusive: false,
      swatches: ['#d97706', '#92400e', '#10b981'],
      pushParticleColor: 0xfbbf24,
      lockParticleColor: 0x34d399,
      materials: {
        crateWood: { color: 0xd97706, roughness: 0.65, metalness: 0.08 },
        crateTrim: { color: 0x92400e, roughness: 0.72, metalness: 0.1 },
        crateDone: { color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.15 },
        crateDoneTrim: { color: 0x047857, roughness: 0.6, metalness: 0.15 }
      }
    },
    {
      id: 'steel-crate',
      name: 'Industrial Steel',
      subtitle: 'Gunmetal & hazard stripes',
      price: 160,
      proExclusive: false,
      swatches: ['#64748b', '#eab308', '#22d3ee'],
      pushParticleColor: 0xfacc15,
      lockParticleColor: 0x22d3ee,
      materials: {
        crateWood: { color: 0x64748b, roughness: 0.36, metalness: 0.65 },
        crateTrim: { color: 0xeab308, roughness: 0.45, metalness: 0.35 },
        crateDone: { color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.4, roughness: 0.32, metalness: 0.5 },
        crateDoneTrim: { color: 0x0e7490, roughness: 0.4, metalness: 0.55 }
      }
    },
    {
      id: 'holo-crate',
      name: 'Holo Cube',
      subtitle: 'Indigo core & neon frame',
      price: 260,
      proExclusive: false,
      swatches: ['#312e81', '#a855f7', '#4ade80'],
      pushParticleColor: 0xa78bfa,
      lockParticleColor: 0x4ade80,
      materials: {
        crateWood: { color: 0x312e81, emissive: 0x3730a3, emissiveIntensity: 0.22, roughness: 0.25, metalness: 0.4 },
        crateTrim: { color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.45 },
        crateDone: { color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.35 },
        crateDoneTrim: { color: 0x86efac, emissive: 0x4ade80, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.4 }
      }
    },
    {
      id: 'ice-crate',
      name: 'Cryo Block',
      subtitle: 'Frosted cyan & silver trim',
      price: 300,
      proExclusive: false,
      swatches: ['#38bdf8', '#e2e8f0', '#2dd4bf'],
      pushParticleColor: 0x7dd3fc,
      lockParticleColor: 0x2dd4bf,
      materials: {
        crateWood: { color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.15, roughness: 0.22, metalness: 0.25 },
        crateTrim: { color: 0xe2e8f0, roughness: 0.35, metalness: 0.45 },
        crateDone: { color: 0x2dd4bf, emissive: 0x0d9488, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.3 },
        crateDoneTrim: { color: 0xf0fdfa, roughness: 0.3, metalness: 0.4 }
      }
    },
    {
      id: 'sakura-crate',
      name: 'Lantern Box',
      subtitle: 'Cedar frame & blossom glow',
      price: 380,
      proExclusive: false,
      swatches: ['#44322a', '#f472b6', '#fef08a'],
      pushParticleColor: 0xf472b6,
      lockParticleColor: 0xfef08a,
      materials: {
        crateWood: { color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.32, roughness: 0.45, metalness: 0.08 },
        crateTrim: { color: 0x44322a, roughness: 0.78, metalness: 0.06 },
        crateDone: { color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.12 },
        crateDoneTrim: { color: 0x78350f, roughness: 0.65, metalness: 0.1 }
      }
    },
    {
      id: 'vault-crate',
      name: 'Diamond Vault',
      subtitle: 'Titanium chest & radiant gold',
      price: 550,
      proExclusive: true,
      swatches: ['#27272a', '#fbbf24', '#fef08a'],
      pushParticleColor: 0xfde047,
      lockParticleColor: 0xfbbf24,
      materials: {
        crateWood: { color: 0x27272a, roughness: 0.3, metalness: 0.75 },
        crateTrim: { color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.2, roughness: 0.22, metalness: 0.82 },
        crateDone: { color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.55, roughness: 0.18, metalness: 0.78 },
        crateDoneTrim: { color: 0xf59e0b, roughness: 0.24, metalness: 0.85 }
      }
    }
  ];

  const CATALOG_MAP = {
    themes: THEMES,
    bots: BOT_SKINS,
    crates: CRATE_SKINS
  };

  function getCatalog(category) {
    return CATALOG_MAP[category] || [];
  }

  function getById(category, id) {
    const list = getCatalog(category);
    return list.find((item) => item.id === id) || list[0] || null;
  }

  function isItemAccessible(category, item) {
    if (!item) return false;
    if (VS.Monetization && VS.Monetization.getActiveTrial(category) === item.id) {
      return true;
    }
    if (VS.Storage) {
      if (VS.Storage.isCosmeticOwned(category, item.id)) return true;
      const iapEnabled = Boolean(VS.Platform && VS.Platform.getCapabilities().iap);
      if (item.proExclusive && iapEnabled && VS.Storage.isPro()) return true;
    }
    return item.price === 0 && !item.proExclusive;
  }

  function getActiveId(category) {
    const trialId = VS.Monetization ? VS.Monetization.getActiveTrial(category) : null;
    if (trialId) {
      const trialItem = getById(category, trialId);
      if (trialItem && trialItem.id === trialId) return trialId;
    }
    const equippedId = VS.Storage ? VS.Storage.getEquippedCosmetic(category) : null;
    const equippedItem = getById(category, equippedId);
    if (equippedItem && isItemAccessible(category, equippedItem)) {
      return equippedItem.id;
    }
    const def = getCatalog(category)[0];
    return def ? def.id : null;
  }

  function getActiveTheme() {
    return getById('themes', getActiveId('themes'));
  }

  function getActiveBotSkin() {
    return getById('bots', getActiveId('bots'));
  }

  function getActiveCrateSkin() {
    return getById('crates', getActiveId('crates'));
  }

  function applyActiveCosmetics(options) {
    const opts = options || {};
    const rebuildPlayer = opts.rebuildPlayer !== false;
    const theme = getActiveTheme();
    const bot = getActiveBotSkin();
    const crate = getActiveCrateSkin();

    if (VS.Voxels) {
      if (theme && VS.Voxels.applyThemeMaterials) VS.Voxels.applyThemeMaterials(theme);
      if (bot && VS.Voxels.applyBotMaterials) VS.Voxels.applyBotMaterials(bot);
      if (crate && VS.Voxels.applyCrateMaterials) VS.Voxels.applyCrateMaterials(crate);
    }

    if (VS.Renderer) {
      if (theme && VS.Renderer.applyThemeLighting) VS.Renderer.applyThemeLighting(theme);
      if (rebuildPlayer && bot && VS.Renderer.refreshPlayerMesh) {
        VS.Renderer.refreshPlayerMesh(bot.accessory);
      }
    }

    if (theme && VS.Platform && typeof VS.Platform.setThemeColor === 'function') {
      VS.Platform.setThemeColor(theme.tgHeaderColor, theme.tgBgColor);
    }

    if (typeof global.__renderVoxelWordmarks === 'function') {
      global.__renderVoxelWordmarks({
        themeId: theme ? theme.id : undefined,
        botId: bot ? bot.id : undefined,
        force: true
      });
    }
  }

  VS.Cosmetics = {
    THEMES,
    BOT_SKINS,
    CRATE_SKINS,
    getCatalog,
    getById,
    getActiveId,
    getActiveTheme,
    getActiveBotSkin,
    getActiveCrateSkin,
    applyActiveCosmetics
  };
})(window);
