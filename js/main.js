(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  async function bootstrap() {
    try {
      if (VS.Loader) VS.Loader.setProgress(20, 'Connecting platform...');
      await VS.Platform.init();
      if (VS.Storage && typeof VS.Storage.reload === 'function') {
        VS.Storage.reload();
      }
      VS.Platform.loadingStart();

      if (VS.Loader) VS.Loader.setProgress(38, 'Initializing 3D engine...');
      if (typeof global.THREE === 'undefined') {
        throw new Error('Three.js library failed to load.');
      }

      VS.Voxels.init();
      VS.Renderer.init(global.document.getElementById('canvas-container'));

      if (VS.Loader) VS.Loader.setProgress(62, 'Loading 500 warehouses & themes...');
      await VS.Monetization.init();
      VS.Cosmetics.applyActiveCosmetics({ rebuildPlayer: false });

      if (VS.Loader) VS.Loader.setProgress(86, 'Building 3D diorama...');
      VS.UI.init();
      VS.Input.init();
      VS.UI.applySettings();
      VS.Game.init();
      VS.Renderer.startLoop();

      if (VS.Loader) {
        const minWait = VS.Platform.isCrazyGamesMode() ? 250 : 700;
        await VS.Loader.finish(minWait);
      }
      VS.Platform.loadingStop();

      const settings = VS.Storage.getSettings();
      if (VS.Platform.isCrazyGamesMode() || !settings.introSeen) {
        VS.Storage.updateSetting('introSeen', true);
        VS.UI.closeMainMenu();
      } else {
        VS.UI.openMainMenu();
      }
    } catch (err) {
      console.error('Failed to initialize Crate Expectations:', err);
      if (VS.Platform) VS.Platform.loadingStop();
      if (VS.Loader) {
        VS.Loader.showError(err && err.message ? err.message : 'Failed to initialize game.');
      }
    }
  }

  global.addEventListener('load', bootstrap);
})(window);
