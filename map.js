/**
 * map.js
 * Initialises the Leaflet map and places markers for all 11 stations.
 * Clicking a marker opens the station panel via StationView.
 */

const MapView = (() => {
  let map = null;
  let markers = {};

  function init(onStationSelect) {
    map = L.map('map', {
      center: [-25.2968, -57.5806],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    STATIONS.forEach(station => {
      const marker = _createMarker(station);
      marker.addTo(map);
      marker.on('click', () => onStationSelect(station));
      markers[station.id] = marker;
    });
  }

  function _createMarker(station) {
    const isActive  = station.status === 'active';
    const colorClass = isActive ? 'marker-active' : 'marker-planned';

    const html = `
      <div class="mobi-marker ${colorClass}">
        <div class="mobi-marker-inner">
          <span>${station.id}</span>
        </div>
      </div>`;

    const icon = L.divIcon({
      html,
      className: '',
      iconSize:   [36, 36],
      iconAnchor: [18, 36],
      popupAnchor:[0, -36],
    });

    const marker = L.marker([station.lat, station.lng], { icon });

    // Tooltip
    marker.bindTooltip(
      `<b>${station.name}</b><br>${station.description}<br>
       <span style="font-size:10px;color:#8b909a">${LAYOUT_LABELS[station.layout]}</span>`,
      { direction: 'top', offset: [0, -36], className: 'mobi-tooltip' }
    );

    return marker;
  }

  function panTo(station) {
    if (!map) return;
    map.flyTo([station.lat, station.lng], 15, { duration: 0.8 });
  }

  function highlightMarker(stationId) {
    // Reset all, highlight selected
    Object.entries(markers).forEach(([id, m]) => {
      const el = m.getElement();
      if (!el) return;
      el.style.filter = (parseInt(id) === stationId) ? 'drop-shadow(0 0 8px #00d4aa)' : '';
    });
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  return { init, panTo, highlightMarker, invalidateSize };
})();
