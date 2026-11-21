(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  function bootstrap() {
    try {
      if (typeof global.THREE === 'undefined') {
        throw new Error('Three.js library is not loaded.');
      }

      VS.Voxels.init();
      VS.Renderer.init(global.document.getElementById('canvas-container'));
      VS.UI.init();
      VS.Input.init();
      VS.UI.applySettings();
      VS.Game.init();
      VS.UI.openMainMenu();
      VS.Renderer.startLoop();
    } catch (err) {
      console.error('Failed to initialize Voxel Sokoban 3D:', err);
    }
  }

  global.addEventListener('load', bootstrap);
})(window);
