(function (global) {
  'use strict';

  const VS = (global.VoxelSokoban = global.VoxelSokoban || {});

  let activePackTab = 'classic';
  let resetConfirmArmed = false;
  let resetConfirmTimer = null;
  let hintHideTimer = null;

  const MODAL_IDS = ['modal-settings', 'modal-levels', 'modal-win'];

  function byId(id) {
    return global.document.getElementById(id);
  }

  function showModal(id) {
    const el = byId(id);
    if (el) el.classList.remove('modal-hidden');
  }

  function hideModal(id) {
    const el = byId(id);
    if (el) el.classList.add('modal-hidden');
    if (id === 'modal-settings') {
      disarmResetProgress();
    }
  }

  function isModalOpen(id) {
    const el = byId(id);
    return Boolean(el && !el.classList.contains('modal-hidden'));
  }

  function isAnyModalOpen() {
    return MODAL_IDS.some((id) => isModalOpen(id));
  }

  function closeTopModal() {
    if (isModalOpen('modal-settings')) {
      hideModal('modal-settings');
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
  }

  function openMainMenu() {
    VS.Game.clearWinTimers();
    VS.Game.state.menuOpen = true;
    updateHintVisibility();
    updateMenuStats();
    showModal('modal-menu');
  }

  function closeMainMenu() {
    VS.Game.state.menuOpen = false;
    hideModal('modal-menu');
    updateHintVisibility();
  }

  function openSettings() {
    applySettings();
    showModal('modal-settings');
  }

  function closeSettings() {
    hideModal('modal-settings');
  }

  function applySettings() {
    const s = VS.Storage.getSettings();
    VS.Sound.setEnabled(s.sound);
    byId('icon-sound-on').classList.toggle('hidden', !s.sound);
    byId('icon-sound-off').classList.toggle('hidden', s.sound);
    byId('dpad-container').classList.toggle('hidden', !s.showDpad);

    const syncToggle = (id, val) => {
      const el = byId(id);
      if (!el) return;
      el.classList.toggle('on', val);
      el.setAttribute('aria-checked', val ? 'true' : 'false');
    };
    syncToggle('toggle-sound', s.sound);
    syncToggle('toggle-dpad', s.showDpad);
    syncToggle('toggle-autofollow', s.autoFollow);
  }

  function updateHUD() {
    const state = VS.Game.state;
    const lv = VS.Levels.get(state.levelIndex);
    if (!lv) return;

    const tag = VS.Levels.getLevelTag(lv);
    byId('hud-level-text').textContent = `${tag}. ${lv.name}`;
    byId('hud-moves').textContent = state.moves;
    byId('hud-par').textContent = lv.par || '--';
  }

  function updateGoalCount(locked, total) {
    byId('hud-goals').textContent = `${locked}/${total}`;
  }

  function updateMenuStats() {
    const earned = VS.Storage.getTotalStars();
    const maxS = VS.Storage.getMaxStars();
    byId('menu-stars').textContent = `★ ${earned} / ${maxS}`;
    byId('menu-score').textContent = VS.Storage.getTotalScore().toLocaleString();
    byId('btn-menu-play-label').textContent = earned > 0 ? 'Continue' : 'Play';
  }

  function updatePackTabCounts() {
    const all = VS.Levels.getAll();
    const classicCount = all.filter((l) => l.pack !== 'starter').length;
    const starterCount = all.filter((l) => l.pack === 'starter').length;
    byId('tab-classic').textContent = `Classic (${classicCount})`;
    byId('tab-starter').textContent = `Starter (${starterCount})`;
  }

  function updateHintVisibility() {
    const toast = byId('toast-hint');
    if (!toast) return;

    const state = VS.Game.state;
    const shouldShow = !state.menuOpen && !state.hintDismissed;

    if (hintHideTimer) {
      global.clearTimeout(hintHideTimer);
      hintHideTimer = null;
    }

    if (shouldShow) {
      toast.classList.remove('hidden');
      toast.classList.remove('opacity-0');
    } else {
      toast.classList.add('opacity-0');
      if (state.hintDismissed) {
        hintHideTimer = global.setTimeout(() => {
          if (VS.Game.state.hintDismissed) {
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

  function setActivePackTab(tab) {
    activePackTab = tab;
    renderLevelGrid();
  }

  function openLevelSelectForCurrentPack() {
    const curLv = VS.Levels.get(VS.Game.state.levelIndex);
    activePackTab = curLv && curLv.pack === 'starter' ? 'starter' : 'classic';
    renderLevelGrid();
    showModal('modal-levels');
  }

  function renderLevelGrid() {
    const grid = byId('level-grid');
    const importPanel = byId('import-panel');
    const lockToast = byId('level-lock-toast');
    lockToast.classList.add('hidden');

    const tabMap = {
      classic: byId('tab-classic'),
      starter: byId('tab-starter'),
      import: byId('tab-import')
    };
    Object.entries(tabMap).forEach(([key, el]) => {
      el.className =
        key === activePackTab
          ? 'pack-tab rounded-xl py-1.5 text-xs font-bold transition text-slate-950 bg-sky-400'
          : 'pack-tab rounded-xl py-1.5 text-xs font-bold transition text-slate-300 hover:text-white';
    });

    const allLevels = VS.Levels.getAll();
    const totalStars = VS.Storage.getTotalStars();
    const totalDone = allLevels.filter((l) => {
      const rec = VS.Storage.getLevelRecord(l.id);
      return rec && rec.stars > 0;
    }).length;

    byId('levels-star-badge').textContent = `★ ${totalStars} / ${VS.Storage.getMaxStars()}`;
    byId('level-progress-text').textContent =
      `${totalDone} of ${allLevels.length} cleared • Collect stars to unlock more`;

    if (activePackTab === 'import') {
      grid.classList.add('hidden');
      importPanel.classList.remove('hidden');
      importPanel.classList.add('flex');
      return;
    }

    importPanel.classList.add('hidden');
    importPanel.classList.remove('flex');
    grid.classList.remove('hidden');
    grid.innerHTML = '';

    const filtered = allLevels
      .map((lv, globalIdx) => ({ lv, globalIdx }))
      .filter((item) =>
        activePackTab === 'classic'
          ? item.lv.pack === 'classic' || item.lv.pack === 'custom'
          : item.lv.pack === 'starter'
      );

    filtered.forEach(({ lv, globalIdx }) => {
      const isCurrent = globalIdx === VS.Game.state.levelIndex;
      const unlocked = VS.Storage.isLevelUnlocked(lv);
      const rec = VS.Storage.getLevelRecord(lv.id);
      const stars = rec ? rec.stars : 0;
      const tag = VS.Levels.getLevelTag(lv);

      const btn = global.document.createElement('button');
      btn.className = `game-btn rounded-2xl p-3 text-left flex flex-col justify-between gap-1.5 ${
        isCurrent && unlocked ? 'ring-2 ring-sky-400' : ''
      } ${unlocked ? '' : 'level-locked'}`;

      const rightBadge = unlocked
        ? `<div class="flex items-center gap-0.5">${[1, 2, 3].map((n) => renderStarSVG(n <= stars, 'w-3.5 h-3.5')).join('')}</div>`
        : `<span class="mono text-[11px] font-bold text-amber-300 flex items-center gap-1">
             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
             ${lv.unlockStars}★
           </span>`;

      const tagColor = isCurrent
        ? 'text-sky-300'
        : lv.pack === 'custom'
          ? 'text-amber-300'
          : 'text-slate-400';

      btn.innerHTML = `
        <div class="w-full flex items-center justify-between">
          <span class="mono text-xs font-bold ${tagColor}">${tag}</span>
          ${rightBadge}
        </div>
        <div class="font-bold text-sm text-white truncate w-full"></div>
        <div class="text-[10px] text-slate-400 mono w-full flex justify-between">
          <span>Par ${lv.par || '--'}</span>
          <span>${rec && rec.bestMoves ? `Best ${rec.bestMoves}` : (unlocked ? 'Ready' : 'Locked')}</span>
        </div>
      `;
      btn.querySelector('.font-bold.text-sm').textContent = lv.name;

      btn.addEventListener('click', () => {
        if (!unlocked) {
          VS.Sound.playBump();
          const needed = lv.unlockStars - totalStars;
          lockToast.textContent = `Earn ${needed} more star${needed === 1 ? '' : 's'} to unlock "${lv.name}"!`;
          lockToast.classList.remove('hidden');
          return;
        }
        VS.Game.loadLevel(globalIdx);
        closeMainMenu();
        hideModal('modal-levels');
      });

      grid.appendChild(btn);
    });
  }

  function showWinModal(data) {
    byId('win-stars').innerHTML = [1, 2, 3].map((n) => renderStarSVG(n <= data.stars, 'w-10 h-10')).join('');
    byId('win-title').textContent =
      data.stars === 3 ? 'Perfect Clear!' : (data.isLast ? 'All Levels Cleared!' : 'Level Cleared!');
    byId('win-subtitle').textContent = `"${data.level.name}" — ${data.stars} of 3 Stars`;
    byId('win-score').textContent = data.score.toLocaleString();
    byId('win-moves').textContent = data.moves;
    byId('win-par').textContent = data.par;

    const unlockMsg = byId('win-unlock-msg');
    if (data.newlyUnlockedCount > 0) {
      unlockMsg.textContent = `★ New levels unlocked! (${data.newlyUnlockedCount} added)`;
      unlockMsg.classList.remove('hidden');
    } else if (!data.nextUnlocked) {
      unlockMsg.textContent =
        `Collect ${data.nextLevel.unlockStars}★ total to unlock "${data.nextLevel.name}" (${data.newStars}/${data.nextLevel.unlockStars}★)`;
      unlockMsg.classList.remove('hidden');
    } else {
      unlockMsg.classList.add('hidden');
    }

    byId('btn-win-next').textContent = data.isLast
      ? 'Play Again'
      : (data.nextUnlocked ? 'Next Level' : 'Level Select');
    showModal('modal-win');
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

    activePackTab = 'classic';
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
      resetNote.textContent = 'This clears all stars, scores & unlocked levels.';
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
    updateMenuStats();
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
    openMainMenu,
    closeMainMenu,
    openSettings,
    closeSettings,
    applySettings,
    updateHUD,
    updateGoalCount,
    updateMenuStats,
    updatePackTabCounts,
    updateHintVisibility,
    renderStarSVG,
    setActivePackTab,
    openLevelSelectForCurrentPack,
    renderLevelGrid,
    showWinModal,
    handleXsbImport,
    disarmResetProgress,
    handleResetProgressClick
  };
})(window);
