(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  const PAGE_SIZE = 20;
  const GRID_COLS_BY_COUNT = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5'
  };

  let activePackTab = 'starter';
  let activePremiumPackId = 'neon-vault';
  const packPages = {
    starter: 0,
    classic: 0,
    'neon-vault': 0,
    'frost-citadel': 0,
    'sandstone-labyrinth': 0,
    grandmaster: 0
  };
  let activeShopTab = 'themes';
  let resetConfirmArmed = false;
  let resetConfirmTimer = null;
  let hintHideTimer = null;
  let transientToastTimer = null;
  let isDeadlockToastActive = false;
  let winStarTimers = [];
  let shopCooldownTimer = null;
  let pendingWinDoubleCoins = 0;
  let lastWinNextLockInfo = null;
  let currentLockAction = null;

  const MODAL_IDS = ['modal-settings', 'modal-levels', 'modal-win', 'modal-shop', 'modal-pro', 'modal-ad'];

  function byId(id) {
    return global.document.getElementById(id);
  }

  function syncPlatformBackButton() {
    if (!VS.Platform || typeof VS.Platform.syncNavigation !== 'function') return;
    if (VS.Intro && VS.Intro.isActive()) {
      VS.Platform.syncNavigation(false);
      return;
    }
    const canGoBack = Boolean(
      isModalOpen('modal-settings') ||
      isModalOpen('modal-levels') ||
      isModalOpen('modal-shop') ||
      isModalOpen('modal-pro') ||
      isModalOpen('modal-win') ||
      (VS.Game && VS.Game.state && !VS.Game.state.menuOpen)
    );
    VS.Platform.syncNavigation(canGoBack);
  }

  function handlePlatformBack() {
    if (VS.Intro && VS.Intro.isActive()) return false;
    if (isModalOpen('modal-ad') || (VS.Monetization && VS.Monetization.isAdActive())) {
      return true;
    }
    if (closeTopModal()) {
      return true;
    }
    if (isModalOpen('modal-win')) {
      hideModal('modal-win');
      openMainMenu();
      return true;
    }
    if (VS.Game && VS.Game.state && !VS.Game.state.menuOpen) {
      openMainMenu();
      return true;
    }
    return false;
  }

  function showModal(id) {
    const el = byId(id);
    if (el) el.classList.remove('modal-hidden');
    if (VS.Platform) VS.Platform.gameplayStop();
    syncPlatformBackButton();
  }

  function clearWinStarTimers() {
    for (let i = 0; i < winStarTimers.length; i++) {
      global.clearTimeout(winStarTimers[i]);
    }
    winStarTimers.length = 0;
  }

  function hideModal(id) {
    const el = byId(id);
    if (el) el.classList.add('modal-hidden');
    if (id === 'modal-win') {
      clearWinStarTimers();
    }
    if (id === 'modal-settings') {
      disarmResetProgress();
    }
    if (id === 'modal-shop' && shopCooldownTimer) {
      global.clearInterval(shopCooldownTimer);
      shopCooldownTimer = null;
    }
    if (
      id !== 'modal-win' &&
      id !== 'modal-ad' &&
      VS.Game &&
      VS.Game.state.won &&
      !VS.Game.state.menuOpen &&
      !isAnyModalOpen() &&
      !(VS.Intro && VS.Intro.isActive())
    ) {
      showModal('modal-win');
      return;
    }
    if (VS.Platform && VS.Game && !VS.Game.state.menuOpen && !isAnyModalOpen() && !(VS.Intro && VS.Intro.isActive())) {
      VS.Platform.gameplayStart();
    }
    syncPlatformBackButton();
  }

  function isModalOpen(id) {
    const el = byId(id);
    return Boolean(el && !el.classList.contains('modal-hidden'));
  }

  function isAnyModalOpen() {
    return MODAL_IDS.some((id) => isModalOpen(id));
  }

  function closeTopModal() {
    if (isModalOpen('modal-ad')) {
      return true;
    }
    if (isModalOpen('modal-settings')) {
      hideModal('modal-settings');
      return true;
    }
    if (isModalOpen('modal-pro')) {
      hideModal('modal-pro');
      return true;
    }
    if (isModalOpen('modal-shop')) {
      hideModal('modal-shop');
      return true;
    }
    if (isModalOpen('modal-levels')) {
      hideModal('modal-levels');
      return true;
    }
    return false;
  }

  function init() {
    updatePackTabCounts();
    updateMenuStats();
    refreshEconomyUI();
  }

  function openMainMenu() {
    VS.Game.clearWinTimers();
    VS.Game.state.menuOpen = true;
    if (VS.Platform) VS.Platform.gameplayStop();
    updateHintVisibility();
    updateMenuStats();
    refreshEconomyUI();
    showModal('modal-menu');
    syncPlatformBackButton();
  }

  function closeMainMenu() {
    VS.Game.state.menuOpen = false;
    const baseYaw = VS.CONFIG.CAMERA_ISO_OFFSET;
    const twoPi = Math.PI * 2;
    const currentYaw = VS.Game.state.camYaw;
    VS.Game.state.camTargetYaw = baseYaw + Math.round((currentYaw - baseYaw) / twoPi) * twoPi;
    hideModal('modal-menu');
    updateHintVisibility();
    if (VS.Platform && !isAnyModalOpen()) {
      VS.Platform.gameplayStart();
    }
    syncPlatformBackButton();
  }

  function openSettings() {
    applySettings();
    refreshEconomyUI();
    showModal('modal-settings');
  }

  function closeSettings() {
    hideModal('modal-settings');
  }

  function syncToggle(id, val) {
    const el = byId(id);
    if (!el) return;
    el.classList.toggle('on', val);
    el.setAttribute('aria-checked', val ? 'true' : 'false');
  }

  function applySettings() {
    const s = VS.Storage.getSettings();
    const musicOn = s.music !== false;
    VS.Sound.setEnabled(s.sound);
    if (VS.Sound.setMusicEnabled) {
      VS.Sound.setMusicEnabled(musicOn);
    }
    const anyAudio = Boolean(s.sound || musicOn);
    byId('icon-sound-on').classList.toggle('hidden', !anyAudio);
    byId('icon-sound-off').classList.toggle('hidden', anyAudio);
    byId('dpad-container').classList.toggle('hidden', !s.showDpad);

    const hapticsRow = byId('settings-haptics-row');
    const isTg = Boolean(VS.Platform && typeof VS.Platform.isTelegramMode === 'function' && VS.Platform.isTelegramMode());
    if (hapticsRow) {
      hapticsRow.classList.toggle('hidden', !isTg);
    }

    syncToggle('toggle-music', musicOn);
    syncToggle('toggle-sound', s.sound);
    syncToggle('toggle-dpad', s.showDpad);
    syncToggle('toggle-autofollow', s.autoFollow);
    syncToggle('toggle-haptics', s.haptics !== false);
  }

  function updateHUD() {
    const state = VS.Game.state;
    const lv = VS.Levels.get(state.levelIndex);
    if (!lv) return;

    const tag = VS.Levels.getLevelTag(lv);
    const prefix = Number.isFinite(lv.rank) ? `#${lv.rank} · ${tag}` : tag;
    byId('hud-level-text').textContent = `${prefix}. ${lv.name}`;
    byId('hud-moves').textContent = state.moves;
    byId('hud-par').textContent = lv.par || '--';
  }

  function updateGoalCount(locked, total) {
    byId('hud-goals').textContent = `${locked}/${total}`;
  }

  function updateMenuStats() {
    const earned = VS.Storage.getTotalStars();
    const maxS = VS.Storage.getMaxStars();
    const coins = VS.Storage.getCoins();
    byId('menu-stars').textContent = `${earned}/${maxS}`;
    byId('menu-score').textContent = VS.Storage.getTotalScore().toLocaleString();
    if (byId('menu-coins')) byId('menu-coins').textContent = coins.toLocaleString();
    byId('btn-menu-play-label').textContent = earned > 0 ? 'Continue' : 'Play';
  }

  function updateShopFreeCoinsButton() {
    const btn = byId('btn-shop-free-coins');
    if (!btn || !VS.Monetization) return;
    const caps = VS.Monetization.getCapabilities();
    if (!caps.rewardedAds) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    const rem = VS.Monetization.getShopAdCooldownRemaining();
    const grant = VS.CONFIG.COIN_REWARDED_SHOP_GRANT;
    if (rem > 0) {
      btn.disabled = true;
      btn.textContent = `+${grant} Coins (${rem}s)`;
    } else {
      btn.disabled = false;
      btn.textContent = `+${grant} Coins (Watch Ad)`;
    }
  }

  function refreshEconomyUI() {
    const coins = VS.Storage ? VS.Storage.getCoins() : 0;

    if (byId('hud-coins')) byId('hud-coins').textContent = coins.toLocaleString();
    if (byId('menu-coins')) byId('menu-coins').textContent = coins.toLocaleString();
    if (byId('shop-coins')) byId('shop-coins').textContent = coins.toLocaleString();

    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { iap: false, restorePurchases: false };
    const isPro = Boolean(caps.iap && VS.Storage && VS.Storage.isPro());
    const proPrice = VS.Monetization ? VS.Monetization.getProductPrice(VS.CONFIG.PRO_PRODUCT_ID, '250 ★') : '250 ★';

    if (byId('hud-pro-badge')) byId('hud-pro-badge').classList.toggle('hidden', !isPro);

    const menuProBtn = byId('btn-menu-pro');
    if (menuProBtn) {
      menuProBtn.classList.toggle('hidden', !caps.iap || isPro);
      const labelEl = byId('btn-menu-pro-label');
      if (labelEl) labelEl.textContent = `Go Pro • ${proPrice}`;
    }

    const shopGoProBtn = byId('btn-shop-go-pro');
    if (shopGoProBtn) {
      shopGoProBtn.classList.toggle('hidden', !caps.iap || isPro);
      shopGoProBtn.textContent = `Go Pro • ${proPrice}`;
    }

    const restoreRow = byId('settings-restore-row');
    if (restoreRow) {
      restoreRow.classList.toggle('hidden', !caps.restorePurchases);
    }

    const proBuyBtn = byId('btn-pro-buy');
    if (proBuyBtn) {
      proBuyBtn.disabled = isPro;
      proBuyBtn.textContent = isPro ? 'Pro Active ✓' : `Unlock Pro • ${proPrice}`;
    }

    updateShopFreeCoinsButton();
    updateMenuStats();

    if (isModalOpen('modal-shop')) {
      renderShopGrid();
    }
    if (isModalOpen('modal-levels')) {
      renderLevelGrid();
    }
  }

  function updatePackTabCounts() {
    const all = VS.Levels.getAll();
    const classicCount = all.filter((l) => l.pack === 'classic' || l.pack === 'custom').length;
    const starterCount = all.filter((l) => l.pack === 'starter').length;
    const premiumCount = all.filter((l) => Boolean(l.premiumPackId)).length;
    byId('tab-classic').textContent = `Classic (${classicCount})`;
    byId('tab-starter').textContent = `Starter (${starterCount})`;
    if (byId('tab-premium')) byId('tab-premium').textContent = `★ Packs (${premiumCount})`;
  }

  function showTransientToast(message, tone = 'sky', durationMs = 3600) {
    const toast = byId('toast-hint');
    const dot = byId('toast-hint-dot');
    const text = byId('toast-hint-text');
    if (!toast || !text) return;

    if (hintHideTimer) {
      global.clearTimeout(hintHideTimer);
      hintHideTimer = null;
    }
    if (transientToastTimer) {
      global.clearTimeout(transientToastTimer);
      transientToastTimer = null;
    }

    const dotColors = {
      sky: 'bg-sky-400',
      amber: 'bg-amber-400',
      emerald: 'bg-emerald-400',
      rose: 'bg-rose-400'
    };
    if (dot) {
      dot.className = `w-2 h-2 shrink-0 rounded-full ${dotColors[tone] || 'bg-sky-400'} animate-pulse`;
    }
    text.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.remove('opacity-0');

    if (durationMs > 0) {
      transientToastTimer = global.setTimeout(() => {
        transientToastTimer = null;
        if (!isDeadlockToastActive) {
          toast.classList.add('opacity-0');
        }
      }, durationMs);
    }
  }

  function isTouchUiActive() {
    return Boolean(VS.Platform && typeof VS.Platform.isMobilePlatform === 'function' && VS.Platform.isMobilePlatform());
  }

  function updateDeadlockUI(hasDeadlock) {
    const undoBtn = byId('btn-undo');
    if (undoBtn) {
      undoBtn.classList.toggle('btn-deadlock-pulse', Boolean(hasDeadlock));
    }
    isDeadlockToastActive = Boolean(hasDeadlock);
    if (hasDeadlock) {
      showTransientToast(
        isTouchUiActive() ? 'Crate stuck in corner! Tap Undo' : 'Crate stuck in corner! Press Z to Undo',
        'amber',
        0
      );
    } else if (!transientToastTimer) {
      updateHintVisibility();
    }
  }

  function updateHintButton() {
    const badge = byId('btn-hint-badge');
    if (!badge || !VS.Game) return;
    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { rewardedAds: false };
    const useAd = Boolean(VS.Game.state.freeHintUsed && caps.rewardedAds);
    badge.textContent = useAd ? 'Ad' : 'Free';
    badge.className = useAd
      ? 'mono text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/35'
      : 'mono text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/35';
  }

  function updateHintVisibility() {
    const toast = byId('toast-hint');
    if (!toast) return;
    if (isDeadlockToastActive) return;

    const state = VS.Game.state;
    const shouldShow = !state.menuOpen && !state.hintDismissed;

    if (hintHideTimer) {
      global.clearTimeout(hintHideTimer);
      hintHideTimer = null;
    }

    if (shouldShow) {
      const dot = byId('toast-hint-dot');
      const text = byId('toast-hint-text');
      if (dot) dot.className = 'w-2 h-2 shrink-0 rounded-full bg-sky-400 animate-pulse';
      if (text) {
        if (isTouchUiActive()) {
          text.textContent = 'Tap tiles or use the D-Pad to push crates onto glowing goals';
        } else {
          text.innerHTML =
            'Use <span class="kbd-pill">W</span><span class="kbd-pill">A</span><span class="kbd-pill">S</span><span class="kbd-pill">D</span> or Arrows to push crates onto glowing goals';
        }
      }
      toast.classList.remove('hidden');
      toast.classList.remove('opacity-0');
    } else {
      toast.classList.add('opacity-0');
      if (state.hintDismissed) {
        hintHideTimer = global.setTimeout(() => {
          if (VS.Game.state.hintDismissed && !isDeadlockToastActive && !transientToastTimer) {
            toast.classList.add('hidden');
          }
        }, 500);
      }
    }
  }

  function renderStarSVG(filled, sizeClass = 'w-4 h-4') {
    return `<svg class="${sizeClass} ${filled ? 'star-filled' : 'star-empty'}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`;
  }

  const WIN_STAR_POINTS = [
    [12, 2],
    [15.09, 8.26],
    [22, 9.27],
    [17, 14.14],
    [18.18, 21.02],
    [12, 17.77],
    [5.82, 21.02],
    [7, 14.14],
    [2, 9.27],
    [8.91, 8.26]
  ];
  const winStarUrlCache = { filled: null, empty: null };

  function getWinStarDataUrl(filled) {
    const key = filled ? 'filled' : 'empty';
    if (winStarUrlCache[key]) return winStarUrlCache[key];
    try {
      const doc = global.document;
      if (!doc || typeof doc.createElement !== 'function') return null;
      const canvas = doc.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return null;

      const pad = 16;
      const scale = (160 - pad * 2) / 24;
      ctx.beginPath();
      for (let i = 0; i < WIN_STAR_POINTS.length; i++) {
        const px = pad + WIN_STAR_POINTS[i][0] * scale;
        const py = pad + WIN_STAR_POINTS[i][1] * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      if (filled) {
        ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#fbbf24';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
      }
      ctx.fill();

      const url = canvas.toDataURL('image/png');
      winStarUrlCache[key] = url;
      return url;
    } catch (e) {
      return null;
    }
  }

  function renderWinStarMarkup(filled, extraClass = '') {
    const url = getWinStarDataUrl(filled);
    if (!url) {
      return renderStarSVG(filled, `w-10 h-10 ${extraClass}`.trim());
    }
    return `<img src="${url}" class="w-10 h-10 win-star-img ${extraClass}" alt="" draggable="false" />`;
  }

  function setActivePackTab(tab) {
    activePackTab = tab;
    renderLevelGrid();
  }

  function setActivePremiumPack(packId) {
    if (packId && VS.Levels.getPackMeta(packId)) {
      activePremiumPackId = packId;
    }
    renderLevelGrid();
  }

  function setPackPage(packKey, pageIndex) {
    packPages[packKey] = Math.max(0, pageIndex);
    renderLevelGrid();
  }

  function focusLevelInSelector(lv) {
    const allLevels = VS.Levels.getAll();
    if (!lv) {
      activePackTab = 'starter';
      return;
    }
    if (lv.pack === 'starter') {
      activePackTab = 'starter';
      const idx = allLevels.filter((l) => l.pack === 'starter').findIndex((l) => l.id === lv.id);
      packPages.starter = idx >= 0 ? Math.floor(idx / PAGE_SIZE) : 0;
    } else if (lv.premiumPackId) {
      activePackTab = 'premium';
      activePremiumPackId = lv.premiumPackId;
      const idx = allLevels
        .filter((l) => l.premiumPackId === lv.premiumPackId)
        .findIndex((l) => l.id === lv.id);
      packPages[lv.premiumPackId] = idx >= 0 ? Math.floor(idx / PAGE_SIZE) : 0;
    } else {
      activePackTab = 'classic';
      const idx = allLevels
        .filter((l) => l.pack === 'classic' || l.pack === 'custom')
        .findIndex((l) => l.id === lv.id);
      packPages.classic = idx >= 0 ? Math.floor(idx / PAGE_SIZE) : 0;
    }
  }

  function openLevelSelectForLevel(lv) {
    focusLevelInSelector(lv);
    renderLevelGrid();
    showModal('modal-levels');
  }

  function openLevelSelectForCurrentPack() {
    const curLv = VS.Levels.get(VS.Game.state.levelIndex);
    openLevelSelectForLevel(curLv);
  }

  function hideLevelLockToast() {
    const lockToast = byId('level-lock-toast');
    const lockBtn = byId('btn-level-lock-action');
    currentLockAction = null;
    if (lockToast) lockToast.classList.add('hidden');
    if (lockBtn) lockBtn.classList.add('hidden');
  }

  function showLevelLockToast(message, actionLabel, actionHandler) {
    const lockToast = byId('level-lock-toast');
    const lockText = byId('level-lock-text');
    const lockBtn = byId('btn-level-lock-action');
    if (!lockToast || !lockText || !lockBtn) return;

    lockText.textContent = message;
    currentLockAction = typeof actionHandler === 'function' ? actionHandler : null;
    if (actionLabel && currentLockAction) {
      lockBtn.textContent = actionLabel;
      lockBtn.classList.remove('hidden');
    } else {
      lockBtn.classList.add('hidden');
    }
    lockToast.classList.remove('hidden');
  }

  function createLevelCard(lv, globalIdx) {
    const isCurrent = globalIdx === VS.Game.state.levelIndex;
    const lockInfo = VS.Storage.getLevelLockInfo(lv);
    const unlocked = lockInfo.unlocked;
    const rec = VS.Storage.getLevelRecord(lv.id);
    const stars = rec ? rec.stars : 0;
    const tag = VS.Levels.getLevelTag(lv);
    const topLabel = Number.isFinite(lv.rank) ? `#${lv.rank} · ${tag}` : tag;
    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { rewardedAds: false };

    const btn = global.document.createElement('button');
    btn.className = `game-btn w-full min-w-0 rounded-2xl p-2.5 sm:p-3 text-left flex flex-col justify-between gap-1.5 ${
      isCurrent && unlocked ? 'ring-2 ring-sky-400' : ''
    } ${unlocked ? '' : 'level-locked'}`;

    let rightBadge;
    if (unlocked) {
      const freePreviewPill = lv.freePreview && !VS.Storage.isPackOwned(lv.premiumPackId)
        ? '<span class="mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mr-1">FREE</span>'
        : '';
      rightBadge = `<div class="flex items-center gap-0.5 shrink-0">${freePreviewPill}${[1, 2, 3].map((n) => renderStarSVG(n <= stars, 'w-3.5 h-3.5')).join('')}</div>`;
    } else if (lockInfo.reason === 'pack') {
      rightBadge = `<span class="mono text-[10px] font-bold text-amber-300 flex items-center gap-1 shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        PACK
      </span>`;
    } else {
      rightBadge = `<span class="mono text-[11px] font-bold text-amber-300 flex items-center gap-1 shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        ${lv.unlockStars}★
      </span>`;
    }

    const tagColor = isCurrent
      ? 'text-sky-300'
      : lv.pack === 'custom' || lv.premiumPackId
        ? 'text-amber-300'
        : 'text-slate-400';

    const diffSpan = Number.isFinite(lv.diff) ? `<span class="shrink-0">Diff ${lv.diff}</span>` : '';
    const statusText = rec && rec.bestMoves ? `Best ${rec.bestMoves}` : (unlocked ? 'Ready' : 'Locked');

    btn.innerHTML = `
      <div class="w-full flex items-center justify-between gap-1 min-w-0">
        <span class="mono text-[11px] font-bold ${tagColor} truncate">${topLabel}</span>
        ${rightBadge}
      </div>
      <div class="level-card-title font-bold text-xs sm:text-sm text-white truncate w-full"></div>
      <div class="text-[9.5px] sm:text-[10px] text-slate-400 mono w-full flex items-center justify-between gap-1">
        ${diffSpan}
        <span class="shrink-0">Par ${lv.par || '--'}</span>
        <span class="truncate">${statusText}</span>
      </div>
    `;
    btn.querySelector('.level-card-title').textContent = lv.name;

    btn.addEventListener('click', () => {
      if (!unlocked) {
        VS.Sound.playBump();
        if (lockInfo.reason === 'pack') {
          const packMeta = VS.Levels.getPackMeta(lockInfo.packId);
          const packName = packMeta ? packMeta.name : 'this pack';
          const totalStars = VS.Storage.getTotalStars();
          if (caps.iap) {
            const packPrice = VS.Monetization
              ? VS.Monetization.getProductPrice(packMeta && packMeta.productId, (packMeta && packMeta.defaultPrice) || '100 ★')
              : '';
            showLevelLockToast(
              `Earn ${packMeta ? packMeta.unlockStars : 0}★ (${totalStars}/${packMeta ? packMeta.unlockStars : 0}★), spend ${packMeta ? packMeta.fallbackCoinPrice : 0} Coins, or unlock "${packName}" (${packPrice}).`,
              `Unlock • ${packPrice}`,
              async () => {
                if (!VS.Monetization) return;
                const res = await VS.Monetization.purchasePack(lockInfo.packId);
                if (res && res.ok) {
                  hideLevelLockToast();
                  VS.Game.loadLevel(globalIdx);
                  closeMainMenu();
                  hideModal('modal-levels');
                } else if (res && res.reason !== 'cancelled') {
                  showLevelLockToast(`Could not complete purchase for ${packName}.`);
                }
              }
            );
          } else {
            const toastMsg = `Earn ${packMeta ? packMeta.unlockStars : 0}★ (${totalStars}/${packMeta ? packMeta.unlockStars : 0}★) or spend ${packMeta ? packMeta.fallbackCoinPrice : 0} Coins to unlock "${packName}".`;
            const actionLabel = `Unlock (${packMeta ? packMeta.fallbackCoinPrice : 0} Coins)`;
            showLevelLockToast(
              toastMsg,
              actionLabel,
              async () => {
                if (!VS.Monetization) return;
                const res = await VS.Monetization.purchasePack(lockInfo.packId);
                if (res && res.ok) {
                  hideLevelLockToast();
                  VS.Game.loadLevel(globalIdx);
                  closeMainMenu();
                  hideModal('modal-levels');
                } else if (res && res.reason === 'insufficient_coins') {
                  showLevelLockToast(`Need ${res.needed} more coins to unlock ${packName}!`);
                }
              }
            );
          }
        } else {
          const needed = lockInfo.missingStars || 1;
          showLevelLockToast(
            `Earn ${needed} more star${needed === 1 ? '' : 's'} to unlock "${lv.name}"!`,
            caps.rewardedAds ? 'Unlock Now (Watch Ad)' : '',
            caps.rewardedAds
              ? async () => {
                  if (!VS.Monetization) return;
                  const res = await VS.Monetization.unlockLevelWithAd(lv.id);
                  if (res && res.ok) {
                    hideLevelLockToast();
                    VS.Game.loadLevel(globalIdx);
                    closeMainMenu();
                    hideModal('modal-levels');
                  } else {
                    showLevelLockToast('Ad was not completed — finish the ad to unlock early.');
                  }
                }
              : null
          );
        }
        return;
      }
      VS.Game.loadLevel(globalIdx);
      closeMainMenu();
      hideModal('modal-levels');
    });

    return btn;
  }

  function renderPaginationBar(container, totalCount, currentPage, onSelectPage) {
    if (!container) return 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
    container.innerHTML = '';

    if (totalPages <= 1) {
      container.classList.add('hidden');
      return safePage;
    }

    container.classList.remove('hidden');
    const colsClass = GRID_COLS_BY_COUNT[totalPages] || 'grid-cols-5';
    container.className = `grid ${colsClass} gap-1.5 mb-2.5 shrink-0`;

    for (let p = 0; p < totalPages; p++) {
      const start = p * PAGE_SIZE + 1;
      const end = Math.min(totalCount, (p + 1) * PAGE_SIZE);
      const isActive = p === safePage;
      const btn = global.document.createElement('button');
      btn.type = 'button';
      btn.dataset.page = String(p);
      btn.className = isActive
        ? 'mono rounded-xl py-1.5 px-1 text-[10px] sm:text-[11px] font-extrabold bg-sky-400 text-slate-950 transition text-center cursor-pointer'
        : 'mono rounded-xl py-1.5 px-1 text-[10px] sm:text-[11px] font-bold bg-slate-900/75 text-slate-300 hover:text-white border border-slate-700/60 transition text-center cursor-pointer';
      btn.textContent = `${start}–${end}`;
      btn.addEventListener('click', () => onSelectPage(p));
      container.appendChild(btn);
    }

    return safePage;
  }

  function handlePackUnlockResult(res, packName) {
    if (res && !res.ok && res.reason === 'insufficient_coins') {
      showLevelLockToast(`Need ${res.needed} more coins to unlock ${packName}!`);
    }
  }

  function renderPremiumPacksPanel(allLevels) {
    const panel = byId('premium-packs-panel');
    if (!panel || !VS.Levels.getPremiumPacks) return;
    panel.innerHTML = '';

    const totalStars = VS.Storage.getTotalStars();
    const packs = VS.Levels.getPremiumPacks();
    if (packs.length === 0) return;

    if (!packs.some((p) => p.id === activePremiumPackId)) {
      activePremiumPackId = packs[0].id;
    }

    const packMap = new Map();
    const selectorGrid = global.document.createElement('div');
    selectorGrid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0';

    packs.forEach((pack) => {
      const packItems = allLevels
        .map((lv, globalIdx) => ({ lv, globalIdx }))
        .filter((item) => item.lv.premiumPackId === pack.id);
      const clearedCount = packItems.filter(({ lv }) => {
        const rec = VS.Storage.getLevelRecord(lv.id);
        return rec && rec.stars > 0;
      }).length;
      const owned = VS.Storage.isPackOwned(pack.id);
      packMap.set(pack.id, { pack, packItems, clearedCount, owned });

      const isSelected = pack.id === activePremiumPackId;
      const pill = global.document.createElement('button');
      pill.type = 'button';
      pill.dataset.packPill = pack.id;
      pill.className = isSelected
        ? 'rounded-xl py-1.5 px-2 text-center transition cursor-pointer bg-amber-400 text-slate-950 font-extrabold shadow-sm min-w-0'
        : 'rounded-xl py-1.5 px-2 text-center transition cursor-pointer bg-slate-900/75 text-slate-200 hover:text-white border border-slate-700/60 font-bold min-w-0';
      pill.innerHTML = `
        <div class="text-[11px] leading-tight truncate">${pack.shortName || pack.name}</div>
        <div class="mono text-[9px] leading-tight mt-0.5 ${isSelected ? 'text-slate-900/80' : (owned ? 'text-emerald-300' : 'text-slate-400')}">${owned ? '✓' : '🔒'} ${clearedCount}/${packItems.length}</div>
      `;
      pill.addEventListener('click', () => setActivePremiumPack(pack.id));
      selectorGrid.appendChild(pill);
    });
    panel.appendChild(selectorGrid);

    const activeData = packMap.get(activePremiumPackId);
    if (!activeData) return;
    const { pack, packItems, clearedCount, owned } = activeData;

    const section = global.document.createElement('div');
    section.className = 'bg-slate-900/70 rounded-2xl p-3 border border-slate-700/70 flex flex-col gap-2.5';

    const header = global.document.createElement('div');
    header.className = 'flex flex-col gap-2';

    header.innerHTML = `
      <div class="flex items-start justify-between gap-2 flex-wrap">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h3 class="text-sm font-extrabold text-white"></h3>
            <span class="mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">${pack.difficulty}</span>
            <span class="mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">${clearedCount}/${packItems.length} cleared</span>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5"></p>
        </div>
        <div class="pack-actions flex items-center gap-1.5 flex-wrap shrink-0"></div>
      </div>
    `;
    header.querySelector('h3').textContent = pack.name;
    header.querySelector('p').textContent = pack.subtitle;

    const actionWrap = header.querySelector('.pack-actions');
    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { iap: false };
    if (owned) {
      const badge = global.document.createElement('span');
      badge.className = 'mono text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 inline-block';
      badge.textContent = 'UNLOCKED';
      actionWrap.appendChild(badge);
    } else {
      if (pack.unlockStars > 0) {
        const starPill = global.document.createElement('span');
        starPill.className = 'mono text-[10px] font-bold px-2 py-1 rounded-xl bg-slate-800/90 text-amber-300 border border-amber-400/30 inline-block';
        starPill.textContent = `★ ${totalStars}/${pack.unlockStars}`;
        actionWrap.appendChild(starPill);
      }

      if (caps.iap && VS.Monetization) {
        const starBuyBtn = global.document.createElement('button');
        starBuyBtn.type = 'button';
        starBuyBtn.className = 'game-btn game-btn-primary rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold';
        starBuyBtn.textContent = `Unlock ${VS.Monetization.getProductPrice(pack.productId, pack.defaultPrice || '100 ★')}`;
        starBuyBtn.addEventListener('click', async () => {
          starBuyBtn.disabled = true;
          const res = await VS.Monetization.purchasePack(pack.id);
          starBuyBtn.disabled = false;
          if (res && !res.ok && res.reason !== 'cancelled') {
            showLevelLockToast(`Could not complete purchase for ${pack.name}.`);
          }
        });
        actionWrap.appendChild(starBuyBtn);
      }

      const coinBtn = global.document.createElement('button');
      coinBtn.type = 'button';
      coinBtn.className = 'game-btn game-btn-gold rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold';
      coinBtn.textContent = `Unlock ${pack.fallbackCoinPrice} Coins`;
      coinBtn.addEventListener('click', async () => {
        if (!VS.Monetization) return;
        const res = await VS.Monetization.purchasePack(pack.id, { useCoins: true });
        handlePackUnlockResult(res, pack.name);
      });
      actionWrap.appendChild(coinBtn);
    }

    section.appendChild(header);

    const pageBar = global.document.createElement('div');
    const safePage = renderPaginationBar(
      pageBar,
      packItems.length,
      packPages[pack.id] || 0,
      (p) => setPackPage(pack.id, p)
    );
    packPages[pack.id] = safePage;
    if (!pageBar.classList.contains('hidden')) {
      pageBar.classList.remove('mb-2.5');
      section.appendChild(pageBar);
    }

    const grid = global.document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2';
    const pageSlice = packItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    pageSlice.forEach(({ lv, globalIdx }) => {
      grid.appendChild(createLevelCard(lv, globalIdx));
    });
    section.appendChild(grid);
    panel.appendChild(section);
  }

  function renderLevelGrid() {
    const grid = byId('level-grid');
    const paginationEl = byId('level-pagination');
    const premiumPanel = byId('premium-packs-panel');
    const importPanel = byId('import-panel');
    hideLevelLockToast();

    const tabMap = {
      classic: byId('tab-classic'),
      starter: byId('tab-starter'),
      premium: byId('tab-premium'),
      import: byId('tab-import')
    };
    Object.entries(tabMap).forEach(([key, el]) => {
      if (!el) return;
      el.className =
        key === activePackTab
          ? 'pack-tab rounded-xl py-1.5 px-1 text-[10px] sm:text-[11px] leading-tight font-bold transition text-slate-950 bg-sky-400 flex items-center justify-center text-center min-w-0'
          : `pack-tab rounded-xl py-1.5 px-1 text-[10px] sm:text-[11px] leading-tight font-bold transition ${key === 'premium' ? 'text-amber-300' : 'text-slate-300'} hover:text-white flex items-center justify-center text-center min-w-0`;
    });

    const allLevels = VS.Levels.getAll();
    const totalStars = VS.Storage.getTotalStars();
    const totalDone = allLevels.filter((l) => {
      const rec = VS.Storage.getLevelRecord(l.id);
      return rec && rec.stars > 0;
    }).length;

    byId('levels-star-badge').textContent = `★ ${totalStars} / ${VS.Storage.getMaxStars()}`;
    byId('level-progress-text').textContent =
      `${totalDone} of ${allLevels.length} cleared • Earn stars & Voxel Coins`;

    if (paginationEl) paginationEl.classList.add('hidden');
    grid.classList.add('hidden');
    if (premiumPanel) {
      premiumPanel.classList.add('hidden');
      premiumPanel.classList.remove('flex');
    }
    importPanel.classList.add('hidden');
    importPanel.classList.remove('flex');

    if (activePackTab === 'import') {
      importPanel.classList.remove('hidden');
      importPanel.classList.add('flex');
      return;
    }

    if (activePackTab === 'premium') {
      if (premiumPanel) {
        premiumPanel.classList.remove('hidden');
        premiumPanel.classList.add('flex');
        renderPremiumPacksPanel(allLevels);
      }
      return;
    }

    grid.classList.remove('hidden');
    grid.innerHTML = '';

    const filtered = allLevels
      .map((lv, globalIdx) => ({ lv, globalIdx }))
      .filter((item) =>
        activePackTab === 'classic'
          ? item.lv.pack === 'classic' || item.lv.pack === 'custom'
          : item.lv.pack === 'starter'
      );

    const safePage = renderPaginationBar(
      paginationEl,
      filtered.length,
      packPages[activePackTab] || 0,
      (p) => setPackPage(activePackTab, p)
    );
    packPages[activePackTab] = safePage;

    const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    pageItems.forEach(({ lv, globalIdx }) => {
      grid.appendChild(createLevelCard(lv, globalIdx));
    });
  }

  function openShop(initialTab) {
    if (initialTab) activeShopTab = initialTab;
    const statusEl = byId('shop-status');
    if (statusEl) {
      statusEl.textContent = 'Equip or preview 3D themes, bots & crates live.';
      statusEl.className = 'text-xs text-center text-slate-300 mb-2 min-h-[1rem]';
    }
    refreshEconomyUI();
    renderShopGrid();

    if (shopCooldownTimer) global.clearInterval(shopCooldownTimer);
    shopCooldownTimer = global.setInterval(() => {
      updateShopFreeCoinsButton();
    }, 1000);

    showModal('modal-shop');
  }

  function setShopTab(tab) {
    activeShopTab = tab;
    renderShopGrid();
  }

  function setShopStatus(text, toneClass = 'text-slate-300') {
    const el = byId('shop-status');
    if (!el) return;
    el.textContent = text;
    el.className = `text-xs text-center ${toneClass} mb-2 min-h-[1rem]`;
  }

  function renderShopGrid() {
    const grid = byId('shop-grid');
    if (!grid || !VS.Cosmetics || !VS.Monetization) return;

    const tabs = {
      themes: byId('shop-tab-themes'),
      bots: byId('shop-tab-bots'),
      crates: byId('shop-tab-crates')
    };
    Object.entries(tabs).forEach(([key, el]) => {
      if (!el) return;
      const count = VS.Cosmetics.getCatalog(key).length;
      const label = key === 'themes' ? 'Themes' : (key === 'bots' ? 'Bots' : 'Crates');
      el.textContent = `${label} (${count})`;
      el.className =
        key === activeShopTab
          ? 'rounded-xl py-1.5 text-xs font-bold transition text-slate-950 bg-sky-400'
          : 'rounded-xl py-1.5 text-xs font-bold transition text-slate-300 hover:text-white';
    });

    const items = VS.Cosmetics.getCatalog(activeShopTab);
    const activeId = VS.Cosmetics.getActiveId(activeShopTab);
    const activeTrialId = VS.Monetization.getActiveTrial(activeShopTab);
    const caps = VS.Monetization.getCapabilities();
    const coins = VS.Storage.getCoins();

    grid.innerHTML = '';

    items.forEach((item) => {
      const owned = VS.Monetization.isCosmeticOwned(activeShopTab, item.id);
      const canBuyCoins = VS.Monetization.canBuyCosmeticWithCoins(activeShopTab, item);
      const isTrial = activeTrialId === item.id;
      const isActive = activeId === item.id;

      const card = global.document.createElement('div');
      card.className = `bg-slate-900/75 rounded-2xl p-3 border flex flex-col justify-between gap-2 ${
        isActive ? 'border-sky-400 ring-1 ring-sky-400/50' : 'border-slate-700/70'
      }`;

      let badgeHtml = '';
      if (isTrial) {
        badgeHtml = '<span class="mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">TRIAL</span>';
      } else if (isActive) {
        badgeHtml = '<span class="mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">EQUIPPED</span>';
      } else if (item.proExclusive && !owned) {
        badgeHtml = caps.iap
          ? '<span class="mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">PRO</span>'
          : '<span class="mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">ELITE</span>';
      } else if (owned) {
        badgeHtml = '<span class="mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">OWNED</span>';
      }

      const swatchesHtml = (item.swatches || [])
        .map((hex) => `<span class="swatch-chip" style="background:${hex};"></span>`)
        .join('');

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-1 mb-2">
            <div class="flex items-center gap-1">${swatchesHtml}</div>
            ${badgeHtml}
          </div>
          <div class="shop-item-title font-bold text-xs sm:text-sm text-white truncate"></div>
          <div class="shop-item-subtitle text-[10px] text-slate-400 leading-snug mt-0.5"></div>
        </div>
        <div class="shop-item-actions flex flex-col gap-1.5 mt-1"></div>
      `;
      card.querySelector('.shop-item-title').textContent = item.name;
      card.querySelector('.shop-item-subtitle').textContent = item.subtitle;

      const btnStack = card.querySelector('.shop-item-actions');

      const primaryBtn = global.document.createElement('button');
      if (owned) {
        if (isActive && !isTrial) {
          primaryBtn.className = 'game-btn rounded-xl py-1.5 px-2 text-[11px] font-bold text-sky-300';
          primaryBtn.textContent = 'Equipped ✓';
          primaryBtn.disabled = true;
        } else {
          primaryBtn.className = 'game-btn game-btn-primary rounded-xl py-1.5 px-2 text-[11px] font-extrabold';
          primaryBtn.textContent = 'Equip';
          primaryBtn.addEventListener('click', () => {
            VS.Monetization.equipCosmetic(activeShopTab, item.id);
            setShopStatus(`Equipped "${item.name}"!`, 'text-sky-300');
          });
        }
      } else if (canBuyCoins) {
        const affordable = coins >= item.price;
        primaryBtn.className = `game-btn ${affordable ? 'game-btn-gold' : ''} rounded-xl py-1.5 px-2 text-[11px] font-extrabold ${affordable ? '' : 'text-amber-300/80'}`;
        primaryBtn.textContent = `Buy • ${item.price} V`;
        primaryBtn.addEventListener('click', () => {
          const res = VS.Monetization.buyCosmetic(activeShopTab, item.id);
          if (res.ok) {
            setShopStatus(`Unlocked & equipped "${item.name}"!`, 'text-emerald-300');
          } else if (res.reason === 'insufficient_coins') {
            VS.Sound.playBump();
            setShopStatus(`Need ${res.needed} more coins for "${item.name}".`, 'text-amber-300');
          }
        });
      } else {
        primaryBtn.className = 'game-btn game-btn-gold rounded-xl py-1.5 px-2 text-[11px] font-extrabold';
        primaryBtn.textContent = 'Unlock with Pro';
        primaryBtn.addEventListener('click', () => {
          openProModal();
        });
      }
      btnStack.appendChild(primaryBtn);

      if (!owned && caps.rewardedAds && !isTrial) {
        const tryBtn = global.document.createElement('button');
        tryBtn.className = 'game-btn rounded-xl py-1 px-2 text-[10px] font-bold text-emerald-300';
        tryBtn.textContent = 'Try 1 Level (Ad)';
        tryBtn.addEventListener('click', async () => {
          const res = await VS.Monetization.tryCosmeticWithAd(activeShopTab, item.id);
          if (res.ok) {
            setShopStatus(`Previewing "${item.name}" for your next level clear!`, 'text-emerald-300');
          } else if (res.reason === 'no_fill') {
            setShopStatus('Ad unavailable right now — try again shortly.', 'text-rose-300');
          } else {
            setShopStatus('Finish the rewarded ad to try this item.', 'text-amber-300');
          }
        });
        btnStack.appendChild(tryBtn);
      }

      grid.appendChild(card);
    });
  }

  function openProModal() {
    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { iap: false };
    if (!caps.iap) return;
    const statusEl = byId('pro-status');
    if (statusEl) statusEl.textContent = '';
    refreshEconomyUI();
    showModal('modal-pro');
  }

  function showWinModal(data) {
    clearWinStarTimers();
    const starsHost = byId('win-stars');
    if (starsHost) {
      starsHost.innerHTML = [1, 2, 3]
        .map(
          (n) =>
            `<span class="win-star-slot" data-star-slot="${n}">${renderWinStarMarkup(false)}</span>`
        )
        .join('');

      const earnedCount = Math.max(0, Math.min(3, Number(data.stars) || 0));
      for (let n = 1; n <= earnedCount; n++) {
        const delayMs = 140 + (n - 1) * 230;
        const tid = global.setTimeout(() => {
          const slot = starsHost.querySelector(`[data-star-slot="${n}"]`);
          if (!slot) return;
          let burstHtml = '<span class="win-star-ring"></span>';
          for (let s = 0; s < 6; s++) {
            const angle = (s / 6) * Math.PI * 2 - Math.PI / 6;
            const dist = 24 + (s % 2) * 8;
            const sx = (Math.cos(angle) * dist).toFixed(1);
            const sy = (Math.sin(angle) * dist).toFixed(1);
            burstHtml += `<span class="win-star-spark" style="--sx:${sx}px;--sy:${sy}px"></span>`;
          }
          slot.classList.add('win-star-has-glow');
          slot.innerHTML = `${renderWinStarMarkup(true, 'win-star-pop')}${burstHtml}`;
          if (VS.Sound && typeof VS.Sound.playStarPop === 'function') {
            VS.Sound.playStarPop(n);
          }
          if (n === 3) {
            const perfectTid = global.setTimeout(() => {
              starsHost.querySelectorAll('.win-star-slot').forEach((el) => {
                el.classList.add('win-star-perfect');
              });
            }, 520);
            winStarTimers.push(perfectTid);
          }
        }, delayMs);
        winStarTimers.push(tid);
      }
    }
    byId('win-title').textContent =
      data.stars === 3 ? 'Perfect Clear!' : (data.isLast ? 'All Levels Cleared!' : 'Level Cleared!');
    byId('win-subtitle').textContent = `"${data.level.name}" — ${data.stars} of 3 Stars`;
    byId('win-score').textContent = data.score.toLocaleString();
    byId('win-moves').textContent = data.moves;
    byId('win-par').textContent = data.par;

    const coinsText = byId('win-coins-text');
    const proBadge = byId('win-pro-2x-badge');
    const doubleBtn = byId('btn-win-double');
    const coinsEarned = data.coinsEarned || 0;
    const baseCoinsEarned = data.baseCoinsEarned || 0;
    pendingWinDoubleCoins = baseCoinsEarned;
    lastWinNextLockInfo = data.nextLockInfo || null;

    if (coinsText) {
      if (data.level.pack === 'custom') {
        coinsText.textContent = 'Custom map • 0 Voxel Coins';
      } else if (coinsEarned > 0) {
        coinsText.textContent = `+${coinsEarned} Voxel Coins`;
      } else {
        coinsText.textContent = 'Already mastered • 0 bonus coins';
      }
    }
    if (proBadge) {
      proBadge.classList.toggle('hidden', !data.proAutoDoubled);
    }

    const caps = VS.Monetization ? VS.Monetization.getCapabilities() : { rewardedAds: false, iap: false };
    const effectivePro = Boolean(caps.iap && VS.Storage.isPro());
    const canDouble = !effectivePro && baseCoinsEarned > 0 && caps.rewardedAds;
    if (doubleBtn) {
      doubleBtn.classList.toggle('hidden', !canDouble);
      doubleBtn.disabled = false;
      doubleBtn.textContent = `+${baseCoinsEarned} Coins (2× Watch Ad)`;
    }
    const winAdStatus = byId('win-ad-status');
    if (winAdStatus) {
      winAdStatus.textContent = '';
      winAdStatus.classList.add('hidden');
    }

    const trialMsg = byId('win-trial-msg');
    const trialText = byId('win-trial-text');
    if (trialMsg && trialText) {
      if (data.trialInfo && data.trialInfo.hadTrial && data.trialInfo.items.length > 0) {
        const names = data.trialInfo.items.map((t) => t.item.name).join(', ');
        trialText.textContent = `Liked trying ${names}? Unlock permanently in the Shop!`;
        trialMsg.classList.remove('hidden');
      } else {
        trialMsg.classList.add('hidden');
      }
    }

    const unlockMsg = byId('win-unlock-msg');
    if (data.newlyUnlockedPacks && data.newlyUnlockedPacks.length > 0) {
      const names = data.newlyUnlockedPacks.map((p) => p.name).join(', ');
      unlockMsg.textContent = `★ Pack Unlocked: ${names} (+${data.newlyUnlockedPacks.length * 100} levels)!`;
      unlockMsg.classList.remove('hidden');
    } else if (data.newlyUnlockedCount > 0) {
      unlockMsg.textContent = `★ New levels unlocked! (${data.newlyUnlockedCount} added)`;
      unlockMsg.classList.remove('hidden');
    } else if (!data.nextUnlocked && data.nextLockInfo && data.nextLockInfo.reason === 'pack') {
      const packMeta = VS.Levels.getPackMeta(data.nextLockInfo.packId);
      const packName = packMeta ? packMeta.name : 'this pack';
      const packPrice = packMeta && VS.Monetization
        ? VS.Monetization.getProductPrice(packMeta.productId, packMeta.defaultPrice || '100 ★')
        : '';
      unlockMsg.textContent = caps.iap
        ? `Earn ${packMeta ? packMeta.unlockStars : 0}★ (${data.newStars}/${packMeta ? packMeta.unlockStars : 0}★), spend ${packMeta ? packMeta.fallbackCoinPrice : 0} Coins, or unlock "${packName}" (${packPrice})!`
        : `Earn ${packMeta ? packMeta.unlockStars : 0}★ (${data.newStars}/${packMeta ? packMeta.unlockStars : 0}★) or spend ${packMeta ? packMeta.fallbackCoinPrice : 0} Coins to unlock "${packName}"!`;
      unlockMsg.classList.remove('hidden');
    } else if (!data.nextUnlocked) {
      unlockMsg.textContent =
        `Collect ${data.nextLevel.unlockStars}★ total to unlock "${data.nextLevel.name}" (${data.newStars}/${data.nextLevel.unlockStars}★)`;
      unlockMsg.classList.remove('hidden');
    } else {
      unlockMsg.classList.add('hidden');
    }

    let nextLabel = 'Next Level';
    if (data.isLast) {
      nextLabel = 'Play Again';
    } else if (!data.nextUnlocked) {
      nextLabel = data.nextLockInfo && data.nextLockInfo.reason === 'pack' ? 'Unlock Pack' : 'Level Select';
    }
    byId('btn-win-next').textContent = nextLabel;
    showModal('modal-win');
  }

  function getPendingWinDoubleCoins() {
    return pendingWinDoubleCoins;
  }

  function clearPendingWinDoubleCoins() {
    pendingWinDoubleCoins = 0;
  }

  function getLastWinNextLockInfo() {
    return lastWinNextLockInfo;
  }

  function triggerCurrentLockAction() {
    if (typeof currentLockAction === 'function') {
      return currentLockAction();
    }
    return null;
  }

  function handleXsbImport() {
    const raw = byId('xsb-input').value;
    const statusEl = byId('xsb-status');

    if (!raw.trim()) {
      statusEl.textContent = 'Paste one or more ASCII Sokoban maps first.';
      statusEl.className = 'text-xs text-amber-400 min-h-[1rem]';
      return;
    }

    const parsed = VS.Levels.parseXsbLevels(raw);
    if (parsed.length === 0) {
      statusEl.textContent =
        'No valid levels found. Ensure each map has #, 1 player (@/+), and equal crates ($/*) & goals (./*/+).';
      statusEl.className = 'text-xs text-rose-400 min-h-[1rem]';
      return;
    }

    const firstNewIdx = VS.Levels.addCustomLevels(parsed);
    updatePackTabCounts();
    updateMenuStats();

    statusEl.textContent = `Loaded ${parsed.length} custom level${parsed.length > 1 ? 's' : ''}!`;
    statusEl.className = 'text-xs text-emerald-400 min-h-[1rem]';

    focusLevelInSelector(VS.Levels.get(firstNewIdx));
    renderLevelGrid();
    VS.Game.loadLevel(firstNewIdx);
    closeMainMenu();
    hideModal('modal-levels');
  }

  function disarmResetProgress() {
    if (resetConfirmTimer) {
      global.clearTimeout(resetConfirmTimer);
      resetConfirmTimer = null;
    }
    resetConfirmArmed = false;
    const resetBtn = byId('btn-reset-progress');
    const resetNote = byId('reset-progress-note');
    if (resetBtn) resetBtn.textContent = 'Reset All Stars & Progress';
    if (resetNote) resetNote.textContent = '';
  }

  function handleResetProgressClick() {
    const resetBtn = byId('btn-reset-progress');
    const resetNote = byId('reset-progress-note');

    if (!resetConfirmArmed) {
      resetConfirmArmed = true;
      resetBtn.textContent = 'Tap Again to Confirm Reset';
      resetNote.textContent = 'Clears stars & scores (keeps unlocked packs, coins & cosmetics).';
      if (resetConfirmTimer) global.clearTimeout(resetConfirmTimer);
      resetConfirmTimer = global.setTimeout(() => {
        disarmResetProgress();
      }, 4000);
      return;
    }

    if (resetConfirmTimer) {
      global.clearTimeout(resetConfirmTimer);
      resetConfirmTimer = null;
    }
    resetConfirmArmed = false;

    VS.Storage.resetProgress();
    refreshEconomyUI();
    VS.Game.loadLevel(0);

    resetBtn.textContent = 'Reset All Stars & Progress';
    resetNote.textContent = 'Progress cleared!';
    resetConfirmTimer = global.setTimeout(() => {
      resetNote.textContent = '';
      resetConfirmTimer = null;
    }, 2000);
  }

  VS.UI = {
    init,
    showModal,
    hideModal,
    isModalOpen,
    isAnyModalOpen,
    closeTopModal,
    syncPlatformBackButton,
    handlePlatformBack,
    openMainMenu,
    closeMainMenu,
    openSettings,
    closeSettings,
    applySettings,
    updateHUD,
    updateGoalCount,
    updateMenuStats,
    refreshEconomyUI,
    updatePackTabCounts,
    updateHintVisibility,
    showTransientToast,
    updateDeadlockUI,
    updateHintButton,
    renderStarSVG,
    setActivePackTab,
    setActivePremiumPack,
    setPackPage,
    openLevelSelectForLevel,
    openLevelSelectForCurrentPack,
    renderLevelGrid,
    openShop,
    setShopTab,
    setShopStatus,
    renderShopGrid,
    openProModal,
    showWinModal,
    getPendingWinDoubleCoins,
    clearPendingWinDoubleCoins,
    getLastWinNextLockInfo,
    triggerCurrentLockAction,
    handleXsbImport,
    disarmResetProgress,
    handleResetProgressClick
  };
})(window);
