/**
 * station-view.js
 * Renders the graphical station layout, manages per-lock state,
 * handles MQTT message routing, and runs the auto-polling loop
 * for UNLOCKED locks every 30 seconds.
 */

const StationView = (() => {
  // State
  let currentStation = null;
  let lockStates     = {};   // { lockNum: 'unknown' | 'locked' | 'unlocked' | 'timeout' | 'error' }
  let pollingTimers  = {};   // { lockNum: intervalId }

  // ── Open a station ─────────────────────────────────────────────────────
  function open(station) {
    currentStation = station;
    lockStates     = {};
    _clearAllPolling();

    // Initialise all locks to unknown
    for (let i = 1; i <= station.lockCount; i++) {
      lockStates[i] = 'unknown';
    }

    // Header metadata
    document.getElementById('stationName').textContent      = station.name;
    document.getElementById('stationTypeBadge').textContent = LAYOUT_LABELS[station.layout];
    document.getElementById('topicDisplay').textContent     = station.topicBase + '/lock+/status';

    // Show panel
    document.getElementById('stationPanel').classList.add('visible');

    // Render locks
    _renderLayout(station);

    // Tell map to highlight this marker
    MapView.highlightMarker(station.id);
    MapView.panTo(station);

    AppLog.system('Opened station: ' + station.name + ' (' + station.topicBase + ')');
  }

  // ── Close / reset ──────────────────────────────────────────────────────
  function close() {
    _clearAllPolling();
    currentStation = null;
    lockStates     = {};
    document.getElementById('stationPanel').classList.remove('visible');
    MapView.highlightMarker(null);
    MapView.invalidateSize();
  }

  // ── Render layout based on station profile ────────────────────────────
  function _renderLayout(station) {
    const container = document.getElementById('lockLayoutContainer');
    container.innerHTML = '';

    if (station.status === 'planned') {
      container.innerHTML = `
        <div class="planned-overlay">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div class="planned-title">${station.name}</div>
          <p>This station is planned and not yet deployed.<br>No hardware is connected.</p>
        </div>`;
      return;
    }

    // Active station — render visual
    const visual = document.createElement('div');
    visual.className = 'station-visual';
    visual.innerHTML = `<div class="layout-label">Station Layout — ${LAYOUT_LABELS[station.layout]}</div>`;

    // Cabinet
    const cabinet = _makeCabinetBlock();
    visual.appendChild(cabinet);

    // Locks
    if (station.layout === LAYOUT.DOUBLE_8) {
      visual.appendChild(_makeDoubleLayout(station));
    } else {
      visual.appendChild(_makeSingleRow(station, 1, station.lockCount));
    }

    container.appendChild(visual);
  }

  function _makeCabinetBlock() {
    const el = document.createElement('div');
    el.className = 'cabinet-block';
    el.innerHTML = `
      <svg class="cabinet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="18" rx="2"/>
        <line x1="8" y1="3" x2="8" y2="21"/>
        <circle cx="5" cy="12" r="1" fill="currentColor"/>
      </svg>
      <span class="cabinet-label">Main Cabinet</span>`;
    return el;
  }

  // Single-sided row: locks numbered 1→N outward from cabinet
  function _makeSingleRow(station, from, to) {
    const row = document.createElement('div');
    row.className = 'locks-row';
    for (let n = from; n <= to; n++) {
      row.appendChild(_makeLockCard(station, n));
    }
    return row;
  }

  // Double-sided zig-zag: Side A gets odd nums, Side B gets even nums
  // Cabinet → Lock1(A), Lock2(B), Lock3(A), Lock4(B) …
  function _makeDoubleLayout(station) {
    const wrapper = document.createElement('div');
    wrapper.className = 'locks-double';

    const sideANums = [], sideBNums = [];
    for (let n = 1; n <= station.lockCount; n++) {
      if (n % 2 !== 0) sideANums.push(n); else sideBNums.push(n);
    }

    const labelA = document.createElement('div');
    labelA.className = 'locks-side-label';
    labelA.textContent = '▸ Side A (odd)';
    const rowA = document.createElement('div');
    rowA.className = 'locks-side-row';
    sideANums.forEach(n => rowA.appendChild(_makeLockCard(station, n)));

    const labelB = document.createElement('div');
    labelB.className = 'locks-side-label';
    labelB.textContent = '▸ Side B (even)';
    const rowB = document.createElement('div');
    rowB.className = 'locks-side-row';
    sideBNums.forEach(n => rowB.appendChild(_makeLockCard(station, n)));

    wrapper.appendChild(labelA);
    wrapper.appendChild(rowA);
    wrapper.appendChild(labelB);
    wrapper.appendChild(rowB);
    return wrapper;
  }

  // Individual lock card element
  function _makeLockCard(station, lockNum) {
    const card = document.createElement('div');
    card.className = 'lock-card state-unknown';
    card.id = _lockCardId(station.topicBase, lockNum);
    card.title = 'Click to unlock Lock ' + lockNum;

    card.innerHTML = `
      <div class="polling-badge" id="poll-${_lockCardId(station.topicBase, lockNum)}"></div>
      <div class="lock-number">${lockNum}</div>
      ${_lockIconSVG()}
      <div class="lock-status-text">UNKNOWN</div>
      <button class="lock-check-btn" title="Send CHECK for Lock ${lockNum}">CHK</button>`;

    // Click card body → unlock prompt
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('lock-check-btn')) return;
      _promptUnlock(station, lockNum);
    });

    // Check button
    card.querySelector('.lock-check-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      MQTTClient.publishCheckLock(station, lockNum);
    });

    return card;
  }

  function _lockCardId(topicBase, lockNum) {
    return 'lock-' + topicBase.replace(/[^a-z0-9]/gi, '_') + '-' + lockNum;
  }

  function _lockIconSVG() {
    return `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`;
  }

  // ── Update a single lock's visual state ──────────────────────────────
  function updateLock(topicBase, lockNum, rawPayload) {
    if (!currentStation || currentStation.topicBase !== topicBase) return;

    const state = _payloadToState(rawPayload);
    lockStates[lockNum] = state;

    const card = document.getElementById(_lockCardId(topicBase, lockNum));
    if (!card) return;

    // Reset classes
    card.className = 'lock-card state-' + state;

    // Update status text
    const textEl = card.querySelector('.lock-status-text');
    if (textEl) textEl.textContent = _stateLabel(rawPayload);

    // Manage auto-polling for UNLOCKED locks
    if (state === 'unlocked') {
      _startPolling(topicBase, lockNum);
    } else {
      _stopPolling(lockNum);
    }
  }

  function _payloadToState(payload) {
    const p = payload.toUpperCase();
    if (p === 'LOCKED')                return 'locked';
    if (p === 'UNLOCKED')              return 'unlocked';
    if (p.startsWith('TIMEOUT'))       return 'timeout';
    if (p.startsWith('ERROR'))         return 'error';
    return 'unknown';
  }

  function _stateLabel(payload) {
    const p = payload.toUpperCase();
    if (p === 'LOCKED')          return 'LOCKED';
    if (p === 'UNLOCKED')        return 'UNLOCKED';
    if (p.startsWith('TIMEOUT')) return 'TIMEOUT';
    if (p.startsWith('ERROR'))   return 'CAN ERR';
    return 'UNKNOWN';
  }

  // ── Unlock confirmation prompt ─────────────────────────────────────────
  function _promptUnlock(station, lockNum) {
    const modal   = document.getElementById('confirmModal');
    const title   = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    const okBtn   = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    title.textContent   = 'Unlock Lock ' + lockNum + '?';
    message.innerHTML   = `Send <code style="color:var(--locked)">UNLOCK</code> command to:<br>
      <code style="color:var(--accent)">${station.topicBase}/lock${lockNum}/</code>`;

    modal.classList.add('open');

    const cleanup = () => { modal.classList.remove('open'); okBtn.onclick = null; cancelBtn.onclick = null; };
    cancelBtn.onclick = cleanup;
    okBtn.onclick = () => {
      MQTTClient.publishUnlock(station, lockNum);
      cleanup();
    };
  }

  // ── Auto-polling for UNLOCKED locks ───────────────────────────────────
  function _startPolling(topicBase, lockNum) {
    if (pollingTimers[lockNum]) return; // already polling

    const cardId = _lockCardId(topicBase, lockNum);
    const badge  = document.getElementById('poll-' + cardId);
    if (badge) badge.parentElement.classList.add('polling');

    pollingTimers[lockNum] = setInterval(() => {
      if (!currentStation) return;
      AppLog.system('Auto-check Lock ' + lockNum + ' (still UNLOCKED)');
      MQTTClient.publishCheckLock(currentStation, lockNum);
    }, CONFIG.pollingIntervalMs);
  }

  function _stopPolling(lockNum) {
    if (!pollingTimers[lockNum]) return;
    clearInterval(pollingTimers[lockNum]);
    delete pollingTimers[lockNum];

    // Remove badge from all cards for this lock number
    if (!currentStation) return;
    const cardId = _lockCardId(currentStation.topicBase, lockNum);
    const card   = document.getElementById(cardId);
    if (card) card.classList.remove('polling');
  }

  function _clearAllPolling() {
    Object.keys(pollingTimers).forEach(n => clearInterval(pollingTimers[n]));
    pollingTimers = {};
  }

  // ── Handle incoming MQTT message ──────────────────────────────────────
  // topic format: <topicBase>/lock<N>/status
  function handleMessage(topic, payload) {
    // Match against all stations to find which one owns this topic
    const station = STATIONS.find(s => topic.startsWith(s.topicBase + '/'));
    if (!station) return;

    const match = topic.match(/\/lock(\d+)\/status$/);
    if (!match) return;

    const lockNum = parseInt(match[1], 10);
    updateLock(station.topicBase, lockNum, payload);

    const stateClass = _payloadToState(payload);
    if (stateClass === 'locked')   AppLog.locked(`← LOCKED      [${topic}]`);
    else if (stateClass === 'unlocked') AppLog.receive(`← UNLOCKED    [${topic}]`);
    else if (stateClass === 'timeout')  AppLog.warn(`← TIMEOUT     [${topic}]`);
    else if (stateClass === 'error')    AppLog.error(`← CAN ERROR   [${topic}]`);
    else AppLog.system(`← ${payload}  [${topic}]`);
  }

  return { open, close, handleMessage };
})();
