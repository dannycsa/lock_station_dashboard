/**
 * app.js
 * Root orchestrator: initialises all modules, wires up UI events,
 * and connects the data flow between MQTT ↔ StationView ↔ Map.
 */

// ─── LOGGER ───────────────────────────────────────────────────────────────
// Simple append-only log. Exposed globally so all modules can call it.
const AppLog = (() => {
  const MAX_ENTRIES = 200;

  function _entry(type, msg) {
    const el    = document.getElementById('logEntries');
    if (!el) return;

    const now   = new Date();
    const hh    = String(now.getHours()).padStart(2,'0');
    const mm    = String(now.getMinutes()).padStart(2,'0');
    const ss    = String(now.getSeconds()).padStart(2,'0');
    const time  = `${hh}:${mm}:${ss}`;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${msg}</span>`;
    el.appendChild(entry);

    // Trim old entries
    while (el.children.length > MAX_ENTRIES) el.removeChild(el.firstChild);

    // Auto-scroll to bottom
    el.scrollTop = el.scrollHeight;
  }

  return {
    info:    (m) => _entry('info',    m),
    send:    (m) => _entry('send',    m),
    receive: (m) => _entry('receive', m),
    locked:  (m) => _entry('locked',  m),
    warn:    (m) => _entry('warn',    m),
    error:   (m) => _entry('error',   m),
    system:  (m) => _entry('system',  m),
  };
})();

// ─── APP INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // 1. Init map — clicking a marker opens the station view
  MapView.init((station) => {
    StationView.open(station);
    if (station.status === 'active') {
      MQTTClient.setStation(station, () => {
        // Auto-check all locks immediately after subscription is confirmed
        AppLog.system('Subscription confirmed — running initial Check All…');
        MQTTClient.publishCheckAll(station);
      });
    }
    setTimeout(() => MapView.invalidateSize(), 50);
  });
  // 2. Wire MQTT incoming messages → StationView
  MQTTClient.onMessage((topic, payload) => {
    StationView.handleMessage(topic, payload);
  });

  // 3. Pre-fill settings modal with config defaults
  document.getElementById('cfgToken').value    = CONFIG.token;
  document.getElementById('cfgClientId').value = CONFIG.clientId;

  // 4. Auto-connect on load using defaults from stations.js
  _doConnect();

  // ── UI EVENTS ────────────────────────────────────────────────────────

  // Back to map
  document.getElementById('backToMapBtn').addEventListener('click', () => {
    StationView.close();
    setTimeout(() => MapView.invalidateSize(), 50);
  });

  // Check All Locks
  document.getElementById('checkAllBtn').addEventListener('click', () => {
    const station = _getActiveStation();
    if (!station) return;
    if (!MQTTClient.isConnected()) {
      AppLog.warn('Not connected — cannot send CHECK ALL.');
      return;
    }
    MQTTClient.publishCheckAll(station);
  });

  // Clear log
  document.getElementById('clearLogBtn').addEventListener('click', () => {
    document.getElementById('logEntries').innerHTML = '';
  });

  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
  });
  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });
  // Close modal on overlay click
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });

  // Connect button in settings
  document.getElementById('connectBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
    _doConnect();
  });

  // Disconnect button in settings
  document.getElementById('disconnectBtn').addEventListener('click', () => {
    MQTTClient.disconnect();
    document.getElementById('settingsModal').classList.remove('open');
  });
});

// ─── HELPERS ──────────────────────────────────────────────────────────────
function _doConnect() {
  const cfg = {
    broker:   document.getElementById('cfgBroker')   ? document.getElementById('cfgBroker').value   : CONFIG.broker,
    token:    document.getElementById('cfgToken')     ? document.getElementById('cfgToken').value     : CONFIG.token,
    clientId: document.getElementById('cfgClientId') ? document.getElementById('cfgClientId').value  : CONFIG.clientId,
  };
  MQTTClient.connect(cfg);
}

function _getActiveStation() {
  // Return the station currently displayed in the panel, if any
  const nameEl = document.getElementById('stationName');
  if (!nameEl || nameEl.textContent === '—') return null;
  return STATIONS.find(s => s.name === nameEl.textContent) || null;
}
