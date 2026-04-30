/**
 * mqtt-client.js
 * Manages the MQTT-over-WebSocket connection to Flespi.
 * Handles connect, disconnect, publish, subscribe, auto-reconnect.
 */

const MQTTClient = (() => {
  let client = null;
  let activeStation = null;
  let onMessageCb = null;
  let onStatusCb  = null;
  let _pendingSubscribeCallback = null;

  // ── Internal status broadcast ──────────────────────────────────────────
  function setStatus(state, text) {
    if (onStatusCb) onStatusCb(state, text);
    const dot  = document.getElementById('mqttDot');
    const label = document.getElementById('mqttStatusText');
    if (dot)   { dot.className = 'status-dot ' + state; }
    if (label) { label.textContent = text; }
  }

  // ── Connect ────────────────────────────────────────────────────────────
  function connect(cfg) {
    if (client && client.connected) {
      client.end(true);
    }

    setStatus('connecting', 'Connecting…');
    AppLog.system('Connecting to ' + cfg.broker + ' …');

    const options = {
      clientId:  cfg.clientId  || CONFIG.clientId,
      username:  cfg.token     || CONFIG.token,
      password:  '',
      clean:     true,
      reconnectPeriod: 5000,
      connectTimeout:  15000,
      keepalive: 60,
    };

    client = mqtt.connect(cfg.broker || CONFIG.broker, options);

    client.on('connect', () => {
      setStatus('connected', 'Connected');
      AppLog.system('MQTT connected. Client: ' + options.clientId);
      if (activeStation) {
        const cb = _pendingSubscribeCallback;
        _pendingSubscribeCallback = null;
        _subscribe(activeStation.topicBase, cb);
      }
    });

    client.on('reconnect', () => {
      setStatus('connecting', 'Reconnecting…');
      AppLog.system('Connection lost — retrying…');
    });

    client.on('error', (err) => {
      setStatus('error', 'Error');
      AppLog.error('MQTT error: ' + err.message);
    });

    client.on('offline', () => {
      setStatus('error', 'Offline');
      AppLog.warn('MQTT client went offline.');
    });

    client.on('message', (topic, payload) => {
      const msg = payload.toString().trim();
      if (onMessageCb) onMessageCb(topic, msg);
    });
  }

  // ── Disconnect ─────────────────────────────────────────────────────────
  function disconnect() {
    if (client) {
      client.end(true, {}, () => {
        setStatus('', 'Disconnected');
        AppLog.system('Disconnected from broker.');
      });
      client = null;
    }
  }

  // ── Subscribe to a station's status topic ─────────────────────────────
  function _subscribe(topicBase, onConfirmed) {
    if (!client || !client.connected) return;
    
    // FIX: Use standalone '+' wildcard or '#' multi-level wildcard
    const topic = topicBase + '/+/status'; 
    
    client.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        AppLog.error('Subscribe failed: ' + topic);
      } else {
        AppLog.system('Subscribed → ' + topic);
        if (onConfirmed) onConfirmed();
      }
    });
  }

  // ── Unsubscribe from old station ───────────────────────────────────────
  function _unsubscribe(topicBase) {
    if (!client || !client.connected) return;
    
    // FIX: Must exactly match the string used in subscribe
    client.unsubscribe(topicBase + '/+/status');
  }

  // ── Switch active station ──────────────────────────────────────────────
  function setStation(station, onSubscribed) {
    if (activeStation && activeStation.topicBase !== station.topicBase) {
      _unsubscribe(activeStation.topicBase);
    }
    activeStation = station;
    if (client && client.connected) {
      _subscribe(station.topicBase, onSubscribed);
    } else {
      // Will subscribe on reconnect; store callback to call it then
      _pendingSubscribeCallback = onSubscribed || null;
    }
  }

  // ── Publish helpers ────────────────────────────────────────────────────
  function publishCheckAll(station) {
    const topic = station.topicBase + '/';
    _publish(topic, 'CHECK');
  }

  function publishCheckLock(station, lockNum) {
    const topic = station.topicBase + '/lock' + lockNum + '/';
    _publish(topic, 'CHECK');
  }

  function publishUnlock(station, lockNum) {
    const topic = station.topicBase + '/lock' + lockNum + '/';
    _publish(topic, 'UNLOCK');
    // After hardware has time to operate, send CHECK to get fresh status
    setTimeout(() => {
      _publish(station.topicBase + '/lock' + lockNum + '/', 'CHECK');
    }, 3000);
  }

  function _publish(topic, message) {
    if (!client || !client.connected) {
      AppLog.warn('Cannot publish — not connected.');
      return false;
    }
    client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        AppLog.error('Publish failed → ' + topic);
      } else {
        AppLog.send('→ ' + message + '  [' + topic + ']');
      }
    });
    return true;
  }

  // ── Public API ─────────────────────────────────────────────────────────
  function isConnected() {
    return !!(client && client.connected);
  }

  function onMessage(cb)  { onMessageCb = cb; }
  function onStatus(cb)   { onStatusCb  = cb; }

  return {
    connect, disconnect, isConnected,
    setStation,
    publishCheckAll, publishCheckLock, publishUnlock,
    onMessage, onStatus,
  };
})();
