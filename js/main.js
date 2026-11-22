(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  async function bootstrap() {
    try {
      if (VS.Loader) VS.Loader.setProgress(25, 'Initializing 3D engine...');
      if (typeof global.THREE === 'undefined') {
        throw new Error('Three.js library failed to load.');
      }

      VS.Voxels.init();
      VS.Renderer.init(global.document.getElementById('canvas-container'));

      if (VS.Loader) VS.Loader.setProgress(55, 'Loading 500 warehouses & themes...');
      await VS.Platform.init();
      await VS.Monetization.init();
      VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: false });

      if (VS.Loader) VS.Loader.setProgress(82, 'Building 3D diorama...');
      VS.UI.init();
      VS.Input.init();
      VS.UI.applySettings();
      VS.Game.init();
      VS.Renderer.startLoop();

      if (VS.Loader) {
        await VS.Loader.finish(900);
      }

      const settings = VS.Storage.getSettings();
      if (VS.Intro && !settings.introSeen) {
        VS.Intro.play({ restoreLevelIndex: 0 });
      } else {
        VS.UI.openMainMenu();
      }
    } catch (err) {
      console.error('Failed to initialize Voxel Sokoban 3D:', err);
      if (VS.Loader) {
        VS.Loader.showError(err && err.message ? err.message : 'Failed to initialize game.');
      }
    }
  }

  global.addEventListener('load', bootstrap);
})(window);
