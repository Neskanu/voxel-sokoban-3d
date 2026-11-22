(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  let sdkReady = false;
  let loadingStarted = false;
  let loadingStopped = false;
  let isPlaying = false;
  let settingsBound = false;

  function getSdk() {
    return (global.CrazyGames && global.CrazyGames.SDK) || null;
  }

  function syncMuteFromSettings(settings) {
    if (settings && typeof settings.muteAudio === 'boolean' && VS.Sound && VS.Sound.setPlatformMuted) {
      VS.Sound.setPlatformMuted(settings.muteAudio);
    }
  }

  function bindSettingsListener(sdk) {
    if (settingsBound || !sdk || !sdk.game) return;
    syncMuteFromSettings(sdk.game.settings);
    if (typeof sdk.game.addSettingsChangeListener === 'function') {
      sdk.game.addSettingsChangeListener((newSettings) => {
        syncMuteFromSettings(newSettings);
      });
      settingsBound = true;
    }
  }

  function requestCrazyAd(adType) {
    const isRewarded = adType === 'rewarded';
    const failResult = (reason) =>
      isRewarded ? { rewarded: false, reason } : { shown: false, reason };
    const successResult = () =>
      isRewarded ? { rewarded: true } : { shown: true };

    const sdk = getSdk();
    if (!sdkReady || !sdk || !sdk.ad || typeof sdk.ad.requestAd !== 'function') {
      return Promise.resolve(failResult('unavailable'));
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (VS.Sound && VS.Sound.setAdMuted) {
          VS.Sound.setAdMuted(false);
        }
        resolve(result);
      };

      const callbacks = {
        adStarted() {
          if (VS.Sound && VS.Sound.setAdMuted) {
            VS.Sound.setAdMuted(true);
          }
        },
        adFinished() {
          finish(successResult());
        },
        adError(err) {
          const reason = (err && (err.code || err.message)) || 'ad_error';
          finish(failResult(reason));
        }
      };

      try {
        const maybePromise = sdk.ad.requestAd(adType, callbacks);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch((err) => {
            const reason = (err && (err.code || err.message)) || 'ad_error';
            finish(failResult(reason));
          });
        }
      } catch (err) {
        const reason = (err && (err.code || err.message)) || 'ad_error';
        finish(failResult(reason));
      }
    });
  }

  const crazyGamesAdapter = {
    id: 'crazygames',
    name: 'CrazyGames SDK v3',
    capabilities: {
      rewardedAds: true,
      interstitialAds: true,
      iap: false,
      restorePurchases: false,
      cloudSave: false
    },

    async init() {
      const sdk = getSdk();
      if (!sdk) {
        console.warn('CrazyGames SDK not present; running with graceful ad fallback.');
        sdkReady = false;
        return false;
      }

      try {
        if (typeof sdk.init === 'function') {
          await sdk.init();
        }
        sdkReady = true;
        bindSettingsListener(sdk);
        return true;
      } catch (err) {
        console.warn('CrazyGames SDK init failed; continuing with fallback:', err);
        sdkReady = false;
        return false;
      }
    },

    loadingStart() {
      const sdk = getSdk();
      if (!sdkReady || loadingStarted || !sdk || !sdk.game || typeof sdk.game.loadingStart !== 'function') {
        return;
      }
      try {
        sdk.game.loadingStart();
        loadingStarted = true;
      } catch (e) {}
    },

    loadingStop() {
      const sdk = getSdk();
      if (!sdkReady || loadingStopped || !sdk || !sdk.game || typeof sdk.game.loadingStop !== 'function') {
        return;
      }
      try {
        sdk.game.loadingStop();
        loadingStopped = true;
      } catch (e) {}
    },

    gameplayStart() {
      const sdk = getSdk();
      if (!sdkReady || isPlaying || !sdk || !sdk.game || typeof sdk.game.gameplayStart !== 'function') {
        return;
      }
      try {
        sdk.game.gameplayStart();
        isPlaying = true;
      } catch (e) {}
    },

    gameplayStop() {
      const sdk = getSdk();
      if (!sdkReady || !isPlaying || !sdk || !sdk.game || typeof sdk.game.gameplayStop !== 'function') {
        return;
      }
      try {
        sdk.game.gameplayStop();
        isPlaying = false;
      } catch (e) {}
    },

    happyTime() {
      const sdk = getSdk();
      if (!sdkReady || !sdk || !sdk.game || typeof sdk.game.happytime !== 'function') {
        return;
      }
      try {
        sdk.game.happytime();
      } catch (e) {}
    },

    showRewardedAd() {
      return requestCrazyAd('rewarded');
    },

    showInterstitialAd() {
      return requestCrazyAd('midgame');
    },

    async getProducts() {
      return [];
    },

    async purchaseProduct(productId) {
      return { purchased: false, productId, entitlements: [], reason: 'unavailable' };
    },

    async restorePurchases() {
      return { restored: false, entitlements: [], reason: 'unavailable' };
    },

    isSdkReady() {
      return sdkReady;
    }
  };

  if (VS.Platform && typeof VS.Platform.registerAdapter === 'function') {
    VS.Platform.registerAdapter(crazyGamesAdapter);
  }
  VS.CrazyGamesAdapter = crazyGamesAdapter;
})(window);
