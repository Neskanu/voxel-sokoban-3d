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
    STORAGE_KEY_V1: 'voxel_sokoban_done_v1'
  });
})(window);
