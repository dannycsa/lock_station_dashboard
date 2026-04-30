/**
 * stations.js
 * Fleet inventory — 11 stations across 3 layout profiles.
 * Token extracted from ESP32 firmware (nexus_station MVP).
 */

// ─── CONNECTION CONFIG ─────────────────────────────────────────────────────
const CONFIG = {
  broker:    'wss://mqtt.flespi.io',
  // Token from firmware — consider a dedicated read-only dashboard token in prod
  token:     'V4jjrjzHpYq8Hs2QnLvkgGRE7bXoa3iC8xzoMKWdbvVTfaLgFsqLUwDxVPsHiwxX',
  clientId:  'MOBI_Dashboard_' + Math.random().toString(16).slice(2, 8),
  pollingIntervalMs: 900000, // 30s auto-check for UNLOCKED locks
};

// ─── LAYOUT TYPES ─────────────────────────────────────────────────────────
const LAYOUT = {
  NEXUS_6:    'nexus_6',    // Single-sided, 6 locks
  DOUBLE_8:   'double_8',   // Double-sided, 8 locks (zig-zag)
  SINGLE_4:   'single_4',   // Single-sided, 4 locks
};

const STATIONS = [
  {
    id: 1,
    name: 'Estación 1 — Costanera Paseo Central',
    topicBase: 'scooter_station_1',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.277190,
    lng: -57.631188,
    description: 'Ambos Lados',
  },
  {
    id: 2,
    name: 'Estación 2 — Costanera Puerto',
    topicBase: 'scooter_station_2',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.275970,
    lng: -57.638047,
    description: 'Ambos Lados',
  },
  {
    id: 3,
    name: 'Estación 3 — Palma Colón',
    topicBase: 'scooter_station_3',
    status: 'planned',
    layout: LAYOUT.SINGLE_4,
    lockCount: 4,
    lat: -25.278267,
    lng: -57.641294,
    description: 'Lado Izquierdo',
  },
  {
    id: 4,
    name: 'Estación 4 — Super 6',
    topicBase: 'scooter_station_4',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.2879981,
    lng: -57.6482014,
    description: 'Ambos Lados',
  },
  {
    id: 5,
    name: 'Estación 5 — Plaza Italia',
    topicBase: 'scooter_station_5',
    status: 'planned',
    layout: LAYOUT.SINGLE_4,
    lockCount: 4,
    lat: -25.288910,
    lng: -57.642328,
    description: 'Lado Izquierdo',
  },
  {
    id: 6,
    name: 'Estación 6 — Biggie',
    topicBase: 'scooter_station_6',
    status: 'planned',
    layout: LAYOUT.SINGLE_4,
    lockCount: 4,
    lat: -25.2864048,
    lng: -57.6396964,
    description: 'Lado Izquierdo',
  },
  {
    id: 7,
    name: 'Estación 7 — Escalinata',
    topicBase: 'scooter_station_7',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.289044,
    lng: -57.631804,
    description: 'Ambos Lados',
  },
  {
    id: 8,
    name: 'Estación 8 — Ministerio',
    topicBase: 'scooter_station_8',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.291038,
    lng: -57.626165,
    description: 'Ambos Lados',
  },
  {
    id: 9,
    name: 'Estación 9 — Plaza Uruguaya',
    topicBase: 'scooter_station_9',
    status: 'planned',
    layout: LAYOUT.DOUBLE_8,
    lockCount: 8,
    lat: -25.285721,
    lng: -57.629711,
    description: 'Ambos Lados',
  },
  {
    id: 10,
    name: 'Estación 10 — Plaza O\'Leary',
    topicBase: 'scooter_station_10',
    status: 'planned',
    layout: LAYOUT.SINGLE_4,
    lockCount: 4,
    lat: -25.282448,
    lng: -57.634426,
    description: 'Lado Derecho',
  },
  {
    id: 11,
    name: 'Estación 11 — Edificio Civis',
    topicBase: 'nexus_station',
    status: 'active',
    layout: LAYOUT.NEXUS_6,
    lockCount: 6,
    lat: -25.2967910,
    lng: -57.5805929,
    description: 'MVP Activo — Single-sided',
  },
];

/**
 * Layout descriptions for display
 */
const LAYOUT_LABELS = {
  [LAYOUT.NEXUS_6]:  'Single-sided · 6 locks',
  [LAYOUT.DOUBLE_8]: 'Double-sided · 8 locks',
  [LAYOUT.SINGLE_4]: 'Single-sided · 4 locks',
};

/**
 * Get a station by its numeric ID.
 */
function getStation(id) {
  return STATIONS.find(s => s.id === id) || null;
}
