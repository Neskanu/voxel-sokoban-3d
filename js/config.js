(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  VS.CONFIG = Object.freeze({
    ANIM_DURATION: 0.14,
    BUMP_DURATION: 0.12,
    CAMERA_ISO_OFFSET: 0.35,
    CAMERA_DEFAULT_PITCH: 0.88,
    CAMERA_PITCH_MIN: 0.42,
    CAMERA_PITCH_MAX: 1.32,
    CAMERA_DIST_MIN: 6.5,
    CAMERA_DIST_MAX: 34,
    HINT_DISMISS_MOVES: 3,
    STAR_TWO_PAR_MULT: 1.45,
    SCORE_PAR_MULT: 1.8,
    SCORE_EFFICIENCY_STEP: 20,
    STORAGE_KEY: 'voxel_sokoban_save_v2',
    STORAGE_KEY_V1: 'voxel_sokoban_done_v1',
    ADAPTER: 'mock',
    COIN_FIRST_CLEAR: 25,
    COIN_PER_STAR: 15,
    COIN_REWARDED_SHOP_GRANT: 50,
    COIN_SHOP_AD_COOLDOWN_SEC: 60,
    COIN_PRO_WELCOME_BONUS: 500,
    INTERSTITIAL_GRACE_CLEARS: 3,
    INTERSTITIAL_LEVEL_INTERVAL: 3,
    INTERSTITIAL_COOLDOWN_SEC: 120,
    PRO_PRODUCT_ID: 'pro_unlock',
    TELEGRAM_API_BASE: '',
    TELEGRAM_CREATE_INVOICE_PATH: '/api/telegram/create-invoice',
    TELEGRAM_ENTITLEMENTS_PATH: '/api/telegram/entitlements',
    TELEGRAM_PRODUCTS: Object.freeze([
      Object.freeze({
        id: 'pro_unlock',
        title: 'Crate Expectations Pro',
        description: 'All 400 master levels, Pro cosmetics, 2x win coins & +500 bonus coins.',
        stars: 250,
        price: '250 ★'
      }),
      Object.freeze({
        id: 'pack_neon_vault',
        packId: 'neon-vault',
        title: 'Neon Vault Pack',
        description: '100 tactical cyber-warehouse puzzles.',
        stars: 100,
        price: '100 ★'
      }),
      Object.freeze({
        id: 'pack_frost_citadel',
        packId: 'frost-citadel',
        title: 'Frost Citadel Pack',
        description: '100 precision ice-corridor challenges.',
        stars: 125,
        price: '125 ★'
      }),
      Object.freeze({
        id: 'pack_sandstone_labyrinth',
        packId: 'sandstone-labyrinth',
        title: 'Sandstone Labyrinth Pack',
        description: '100 tight desert-temple puzzle vaults.',
        stars: 150,
        price: '150 ★'
      }),
      Object.freeze({
        id: 'pack_grandmaster',
        packId: 'grandmaster',
        title: 'Grandmaster Pack',
        description: '100 deep multi-stage logic chambers.',
        stars: 175,
        price: '175 ★'
      })
    ])
  });
})(window);
