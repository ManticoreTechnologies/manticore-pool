function formatHashrate(value) {
  var units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  var rate = Number(value || 0);
  var index = 0;
  while (rate >= 1000 && index < units.length - 1) {
    rate = rate / 1000;
    index += 1;
  }
  return rate.toFixed(index === 0 ? 0 : 2) + ' ' + units[index];
}

function formatEvr(sats) {
  return (Number(sats || 0) / 100000000).toFixed(8) + ' EVR';
}

function evrToSats(evr) {
  return Math.floor(Number(evr || 0) * 100000000);
}

function satsToEvrNumber(sats) {
  return Number(sats || 0) / 100000000;
}

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  var el = byId(id);
  if (el) {
    el.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shortAddress(address) {
  if (!address) {
    return 'Pool-wide';
  }
  return address.length > 18 ? address.slice(0, 9) + '...' + address.slice(-7) : address;
}

function currentAddressFilter() {
  var parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'dashboard' && parts[1]) {
    return parts[1];
  }
  var filter = byId('address-filter');
  if (filter) {
    return filter.value.trim();
  }
  var minerAddress = byId('miner-address');
  return minerAddress ? minerAddress.value.trim() : '';
}

function connectHostDefault() {
  return window.location.hostname || 'your-pool-host';
}

async function getJson(url) {
  var response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function sendJson(url, method, body) {
  var headers = { 'content-type': 'application/json' };
  var token = window.localStorage.getItem('payoutAdminToken');
  if (token) {
    headers['x-payout-admin-token'] = token;
  }
  var response = await fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(body || {})
  });
  var data = await response.json().catch(function() { return {}; });
  if (!response.ok) {
    if (response.status === 401) {
      var newToken = window.prompt('Enter payout admin token');
      if (newToken) {
        window.localStorage.setItem('payoutAdminToken', newToken);
        return sendJson(url, method, body);
      }
    }
    throw new Error(data.reason || data.error || JSON.stringify(data));
  }
  return data;
}

function renderPool(pool) {
  setText('pool-hashrate', formatHashrate(pool.hashrate));
  setText('active-miners', pool.activeMiners || 0);
  setText('blocks-found', pool.blocksFound || 0);
  setText('valid-shares', pool.validShares || 0);
  setText('invalid-shares', pool.invalidShares || 0);
  setText('pool-unpaid', formatEvr(pool.unpaid));
  setText('pool-paid', formatEvr(pool.paid) + ' paid');
}

function renderNetwork(net) {
  setText('net-height', net.height || '-');
  setText('net-difficulty', net.difficulty ? Number(net.difficulty).toLocaleString() : '-');
  setText('net-hashrate', formatHashrate(net.hashrate));
  setText('network-share', net.networkShare ? (net.networkShare * 100).toFixed(6) + '%' : '0%');
}

function renderConfig(config) {
  var ports = config.stratumPorts && config.stratumPorts.length ? config.stratumPorts.join(' / ') : '3333 / 3334';
  setText('stratum-signal', ports);
  setText('payout-mode', config.payoutsEnabled ? 'Auto armed' : 'Manual');
  var portSelect = byId('connect-port');
  if (portSelect && config.stratumPorts && config.stratumPorts.length && portSelect.children.length <= 2) {
    portSelect.innerHTML = config.stratumPorts.map(function(port, index) {
      return '<option value="' + escapeHtml(port) + '">' + escapeHtml(port) + (index === 0 ? ' - standard' : ' - alternate') + '</option>';
    }).join('');
    updateConnectPreview();
  }
}

function renderWorkers(workers) {
  var tbody = byId('workers');
  if (!tbody) {
    return;
  }
  tbody.innerHTML = '';

  if (!workers.length) {
    var emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="7" class="empty">No workers found yet.</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  workers.forEach(function(worker) {
    var row = document.createElement('tr');
    row.innerHTML = [
      '<td><strong>' + escapeHtml(worker.workername) + '</strong><small>' + escapeHtml(worker.address) + '</small></td>',
      '<td>' + formatHashrate(worker.hashrate) + '</td>',
      '<td>' + (worker.valid || 0) + '</td>',
      '<td>' + (worker.invalid || 0) + '</td>',
      '<td>' + (worker.blocks || 0) + '</td>',
      '<td>' + formatEvr(worker.unpaid) + '</td>',
      '<td>' + (worker.lastsharetime ? new Date(worker.lastsharetime).toLocaleString() : '-') + '</td>'
    ].join('');
    tbody.appendChild(row);
  });
}

function renderBlocks(blocks) {
  var container = byId('blocks');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!blocks.length) {
    container.innerHTML = '<p class="empty">No block candidates submitted yet.</p>';
    return;
  }

  blocks.forEach(function(block) {
    var item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = '<strong>Height ' + block.height + '</strong>' +
      '<span>' + escapeHtml(block.hash || 'pending hash') + '</span>' +
      '<small>Finder: ' + escapeHtml(block.finder) + ' | Reward: ' + formatEvr(block.reward) +
      ' | Confirmations: ' + (block.confirmations || 0) + ' | Status: ' + escapeHtml(block.status || 'submitted') + '</small>';
    container.appendChild(item);
  });
}

function renderPayouts(payouts) {
  var container = byId('payouts');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!payouts.length) {
    container.innerHTML = '<p class="empty">No payouts sent yet.</p>';
    return;
  }

  payouts.forEach(function(payout) {
    var item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = '<strong>' + formatEvr(payout.total) + '</strong>' +
      '<span>' + escapeHtml(payout.txid || 'pending txid') + '</span>' +
      '<small>' + new Date(payout.paidAt).toLocaleString() + ' | Outputs: ' + (payout.outputs || []).length + '</small>';
    container.appendChild(item);
  });
}

function renderMiner(summary) {
  var address = summary && summary.address ? summary.address : '';
  var totals = summary && summary.totals ? summary.totals : {};
  var prefs = summary && summary.preferences ? summary.preferences : {};
  var candidates = summary && summary.payoutCandidates ? summary.payoutCandidates : { total: 0 };

  setText('miner-address-label', address ? shortAddress(address) : '-');
  setText('miner-hashrate', formatHashrate(totals.hashrate));
  setText('miner-unpaid', formatEvr(totals.unpaid));
  setText('miner-eligible', formatEvr(candidates.total));
  setText('selected-address-readout', shortAddress(address));
  if (byId('auto-payout')) {
    byId('auto-payout').checked = prefs.autoPayout === true;
  }
  if (byId('payout-threshold')) {
    byId('payout-threshold').value = satsToEvrNumber(prefs.payoutThreshold).toFixed(8);
  }
  if (byId('miner-link')) {
    byId('miner-link').href = address ? '/dashboard/' + encodeURIComponent(address) : '/miner';
  }
}

var warfield = null;
var lastWarsState = null;

function initWarfield() {
  if (warfield) return;
  var canvas = byId('war-canvas');
  if (!canvas || typeof Warfield === 'undefined') return;
  warfield = new Warfield(canvas);
  warfield.onSectorSelect = function(sector) {
    if (lastWarsState) renderSectorDetail(sector, lastWarsState);
  };
  warfield.start();
}

function renderHashWars(state) {
  if (!byId('wars-event-name')) return;
  lastWarsState = state;

  initWarfield();
  if (warfield) warfield.updateState(state);

  setText('wars-event-name', state.event.name);
  setText('wars-event-progress', state.event.progress + '%');
  if (byId('wars-event-bar')) {
    byId('wars-event-bar').style.width = state.event.progress + '%';
  }
  setText('wars-units', state.totals.units);
  setText('wars-active-units', state.totals.activeUnits);
  setText('wars-hashrate', formatHashrate(state.totals.hashrate));
  setText('wars-energy', Math.round(state.totals.pressure || state.totals.energy).toLocaleString());

  renderWarFactionBar(state);
  renderWarUnits(state);
  renderWarsCommand(state);
  renderWarsBattleLog(state.battleLog || []);
  renderWarNetworkAlerts(state.networkEvents || []);
}

function renderWarFactionBar(state) {
  var bar = byId('war-faction-bar');
  if (!bar) return;
  bar.innerHTML = state.factions.map(function(faction) {
    return '<div class="war-faction-strip" style="--fc:' + escapeHtml(faction.color) + '">' +
      '<span class="war-faction-name">' + escapeHtml(faction.name) + '</span>' +
      '<span class="war-faction-inf">' + faction.influence + '%</span>' +
      '<div class="war-faction-meter"><div class="war-faction-meter-fill" style="width:' + faction.influence + '%"></div></div>' +
      '<span class="war-faction-terr">' + (faction.territoriesOwned || 0) + ' sectors / ' + faction.activeUnits + ' active</span>' +
      '</div>';
  }).join('');
}

function renderSectorDetail(sector, state) {
  var container = byId('wars-sector-detail');
  if (!container || !sector) return;
  state = state || lastWarsState;
  var factions = (state && state.constants && state.constants.factions) || [];
  var controlMap = sector.controlMap || {};
  var barsHtml = factions.map(function(f) {
    var val = controlMap[f.id] || 0;
    return '<div class="war-intel-bar">' +
      '<span class="war-intel-bar-label" style="color:' + escapeHtml(f.color) + '">' + escapeHtml(f.name.slice(0, 3)) + '</span>' +
      '<div class="war-intel-bar-track"><div class="war-intel-bar-fill" style="width:' + val + '%;background:' + escapeHtml(f.color) + '"></div></div>' +
      '<span class="war-intel-bar-val">' + val + '%</span>' +
      '</div>';
  }).join('');

  var sectorFacilities = state && state.map && state.map.facilities
    ? state.map.facilities.filter(function(f) { return f.sectorId === sector.id; })
    : [];
  var facText = sectorFacilities.map(function(f) { return f.name; }).join(', ') || 'None';

  container.innerHTML = '<div class="war-intel-card">' +
    '<div class="war-intel-name">' + escapeHtml(sector.name) + '</div>' +
    '<div class="war-intel-owner" style="color:' + escapeHtml(sector.ownerColor) + '">' +
      escapeHtml(sector.ownerName) + ' control &mdash; ' + escapeHtml(sector.status) +
    '</div>' +
    '<div class="war-intel-bars">' + barsHtml + '</div>' +
    '<div class="war-intel-meta">Momentum: ' + (sector.momentum || 0) + '% | ' + escapeHtml(sector.anomaly || 'stable') +
    ' | ' + escapeHtml(sector.buff || '') + '<br>Facilities: ' + escapeHtml(facText) + '</div>' +
    '</div>';
}

function renderWarUnits(state) {
  var container = byId('wars-units-list');
  if (!container) return;
  var units = state.units || [];
  if (!units.length) {
    container.innerHTML = '<p class="war-muted">No units enlisted. Connect a miner.</p>';
    return;
  }
  container.innerHTML = units.slice(0, 12).map(function(unit) {
    var fc = state.factions.find(function(f) { return f.id === unit.faction; });
    var color = fc ? fc.color : '#ff9d2e';
    return '<div class="war-unit-chip ' + (unit.active ? 'active' : '') + '">' +
      '<div class="war-unit-icon" style="border-color:' + escapeHtml(color) + '">' +
        escapeHtml(unit.callsign.slice(0, 2).toUpperCase()) +
      '</div>' +
      '<div class="war-unit-info">' +
        '<div class="war-unit-callsign">' + escapeHtml(unit.callsign) + '</div>' +
        '<div class="war-unit-meta">L' + unit.level + ' ' + escapeHtml(unit.className) + ' / ' + escapeHtml(unit.archetype) + ' / ' + escapeHtml(unit.stance) + '</div>' +
      '</div>' +
      '<div class="war-unit-stats-mini">' +
        '<div><span>ATK</span><strong>' + unit.attack + '</strong></div>' +
        '<div><span>SHD</span><strong>' + unit.shield + '</strong></div>' +
      '</div>' +
      '</div>';
  }).join('');
}

function renderWarsCommand(state) {
  if (!byId('wars-command-worker')) return;

  var selected = byId('wars-command-worker').value;
  byId('wars-command-worker').innerHTML = state.units.map(function(unit) {
    return '<option value="' + escapeHtml(unit.workername) + '">' + escapeHtml(unit.callsign) + ' (' + escapeHtml(unit.className) + ')</option>';
  }).join('');
  if (selected) byId('wars-command-worker').value = selected;

  byId('wars-command-faction').innerHTML = state.constants.factions.map(function(faction) {
    return '<option value="' + escapeHtml(faction.id) + '">' + escapeHtml(faction.name) + '</option>';
  }).join('');
  byId('wars-command-territory').innerHTML = state.constants.territories.map(function(territory) {
    return '<option value="' + escapeHtml(territory) + '">' + escapeHtml(territory) + '</option>';
  }).join('');
  byId('wars-command-stance').innerHTML = state.constants.stances.map(function(stance) {
    return '<option value="' + escapeHtml(stance.id) + '">' + escapeHtml(stance.name) + '</option>';
  }).join('');

  var unit = state.units.find(function(item) { return item.workername === byId('wars-command-worker').value; }) || state.units[0];
  if (unit) {
    byId('wars-command-worker').value = unit.workername;
    byId('wars-command-callsign').value = unit.callsign;
    byId('wars-command-faction').value = unit.faction;
    byId('wars-command-territory').value = unit.territory;
    byId('wars-command-stance').value = unit.stance;
  }
}

function renderWarsBattleLog(log) {
  var container = byId('wars-battle-log');
  if (!container) return;
  if (!log.length) {
    container.innerHTML = '<p class="war-muted">No war events yet. Keep hashing.</p>';
    return;
  }
  container.innerHTML = log.slice(0, 10).map(function(entry) {
    return '<div class="war-log-entry" data-type="' + escapeHtml(entry.type) + '">' +
      '<strong>' + escapeHtml(entry.type.replace(/_/g, ' ')) + '</strong>' +
      '<span>' + escapeHtml(entry.message) + '</span>' +
      '<small>' + new Date(entry.timestamp).toLocaleTimeString() + '</small>' +
      '</div>';
  }).join('');
}

function renderWarNetworkAlerts(events) {
  var container = byId('war-network-alert');
  if (!container) return;
  if (!events || !events.length) {
    container.innerHTML = '';
    return;
  }
  var evt = events[0];
  var severity = evt.type === 'difficulty_spike' ? 'high'
    : evt.type === 'block_found' ? 'low'
    : 'medium';
  container.innerHTML = '<div class="war-alert-pill" data-severity="' + severity + '">' +
    escapeHtml(evt.message) + '</div>';
}

async function refresh() {
  var health = byId('health');
  var isWarsPage = !!byId('war-canvas');
  try {
    if (isWarsPage) {
      var warsData = await getJson('/api/hash-wars');
      renderHashWars(warsData);
      return;
    }
    var address = currentAddressFilter();
    var workersUrl = address ? '/api/workers/' + encodeURIComponent(address) : '/api/workers';
    var requests = [
      getJson('/api/config'),
      getJson('/api/poolstats'),
      getJson('/api/netstats').catch(function(error) { return { error: error.message }; }),
      getJson(workersUrl),
      getJson('/api/blocks'),
      getJson('/api/payouts')
    ];
    if (address) {
      requests.push(getJson('/api/miner/' + encodeURIComponent(address)));
    }
    if (byId('wars-event-name') && !isWarsPage) {
      requests.push(getJson('/api/hash-wars'));
    }
    var results = await Promise.all(requests);

    renderConfig(results[0]);
    renderPool(results[1]);
    if (!results[2].error) {
      renderNetwork(results[2]);
      if (health) { health.textContent = 'Online'; health.className = 'status online'; }
    } else {
      if (health) { health.textContent = 'Node unavailable'; health.className = 'status warning'; }
    }
    renderWorkers(results[3]);
    renderBlocks(results[4]);
    renderPayouts(results[5]);
    if (address) {
      renderMiner(results[6]);
      if (byId('miner-panel')) byId('miner-panel').style.display = '';
    } else {
      if (byId('miner-panel')) byId('miner-panel').style.display = '';
      renderMiner({ address: '', totals: {}, preferences: { payoutThreshold: results[0].payoutThreshold || 0 }, payoutCandidates: { total: 0 } });
    }
    if (byId('wars-event-name') && !isWarsPage) {
      renderHashWars(results[results.length - 1]);
    }
  } catch (error) {
    if (health) { health.textContent = 'Dashboard error'; health.className = 'status warning'; }
    console.error(error);
  }
}

if (byId('refresh')) {
  byId('refresh').addEventListener('click', refresh);
}
if (byId('address-filter')) {
  byId('address-filter').addEventListener('input', function() {
    if (byId('miner-address')) {
      byId('miner-address').value = byId('address-filter').value.trim();
    }
    refresh();
  });
}
if (byId('miner-address')) {
  byId('miner-address').addEventListener('change', function() {
    var address = byId('miner-address').value.trim();
    if (byId('address-filter')) {
      byId('address-filter').value = address;
    }
    if (address) {
      window.history.replaceState({}, '', '/dashboard/' + encodeURIComponent(address));
    } else if (document.body.dataset.page === 'miner') {
      window.history.replaceState({}, '', '/miner');
    } else {
      window.history.replaceState({}, '', '/');
    }
    refresh();
  });
}
if (byId('save-payout-settings')) {
  byId('save-payout-settings').addEventListener('click', async function() {
  var address = currentAddressFilter() || byId('miner-address').value.trim();
  if (!address) {
    byId('payout-message').textContent = 'Enter a payout address first.';
    return;
  }
  try {
    await sendJson('/api/miner/' + encodeURIComponent(address) + '/payout-settings', 'PUT', {
      autoPayout: byId('auto-payout').checked,
      payoutThreshold: evrToSats(byId('payout-threshold').value)
    });
    byId('payout-message').textContent = 'Payout settings saved.';
    refresh();
  } catch (error) {
    byId('payout-message').textContent = 'Could not save settings: ' + error.message;
  }
  });
}
if (byId('manual-payout')) {
  byId('manual-payout').addEventListener('click', async function() {
  var address = currentAddressFilter() || byId('miner-address').value.trim();
  if (!address) {
    byId('payout-message').textContent = 'Enter a payout address first.';
    return;
  }
  byId('payout-message').textContent = 'Checking mature balance and sending payout if eligible...';
  try {
    var result = await sendJson('/api/miner/' + encodeURIComponent(address) + '/payout', 'POST', {});
    byId('payout-message').textContent = result.payout
      ? 'Payout sent: ' + result.payout.txid
      : 'No eligible mature balance to pay.';
    refresh();
  } catch (error) {
    byId('payout-message').textContent = 'Manual payout not sent: ' + error.message;
  }
  });
}

function openMenu() {
  document.body.classList.add('nav-open');
  byId('menu-button').setAttribute('aria-expanded', 'true');
  byId('menu-button').textContent = '×';
  byId('nav-overlay').setAttribute('aria-hidden', 'false');
}

function closeMenu() {
  document.body.classList.remove('nav-open');
  byId('menu-button').setAttribute('aria-expanded', 'false');
  byId('menu-button').textContent = '☰';
  byId('nav-overlay').setAttribute('aria-hidden', 'true');
}

function updateConnectPreview() {
  var host = byId('connect-host').value.trim() || connectHostDefault();
  var port = byId('connect-port').value || '3333';
  var address = byId('connect-address').value.trim() || 'EvrmoreAddress';
  var worker = byId('connect-worker').value.trim() || 'Rig01';
  var password = byId('connect-password').value.trim() || 'x';
  var profile = byId('connect-profile').value;
  var workerName = address + '.' + worker.replace(/[^a-zA-Z0-9._-]/g, '');
  var hostPort = host + ':' + port;
  setText('connect-mrr-host', hostPort);
  setText('connect-workername', workerName);
  setText('connect-uri', 'stratum+tcp://' + workerName + ':' + password + '@' + hostPort);
  setText('connect-hint', profile === 'mrr'
    ? 'For MRR, use host:port without the stratum+tcp:// prefix in the host field.'
    : 'For most miners, use the full stratum URI and keep password as x unless you need custom metadata.');
}

async function copyFromElement(id) {
  var text = byId(id).textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  var textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

if (byId('menu-button')) {
  byId('menu-button').addEventListener('click', function() {
    if (document.body.classList.contains('nav-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });
}
if (byId('nav-close')) {
  byId('nav-close').addEventListener('click', closeMenu);
}
if (byId('nav-overlay')) {
  byId('nav-overlay').addEventListener('click', function(event) {
    if (event.target === byId('nav-overlay')) {
      closeMenu();
    }
  });
}
Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function(link) {
  link.addEventListener('click', closeMenu);
});
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeMenu();
  }
});

['connect-host', 'connect-port', 'connect-address', 'connect-worker', 'connect-password', 'connect-profile'].forEach(function(id) {
  if (!byId(id)) {
    return;
  }
  byId(id).addEventListener('input', updateConnectPreview);
  byId(id).addEventListener('change', updateConnectPreview);
});
Array.prototype.forEach.call(document.querySelectorAll('.copy-button'), function(button) {
  button.addEventListener('click', async function() {
    var label = button.textContent;
    try {
      await copyFromElement(button.getAttribute('data-copy-target'));
      button.textContent = 'Copied';
      setTimeout(function() { button.textContent = label; }, 1200);
    } catch (error) {
      button.textContent = 'Copy failed';
      setTimeout(function() { button.textContent = label; }, 1200);
    }
  });
});
if (byId('wars-command-worker')) {
  byId('wars-command-worker').addEventListener('change', refresh);
}
if (byId('wars-command-save')) {
  byId('wars-command-save').addEventListener('click', async function() {
    var worker = byId('wars-command-worker').value;
    if (!worker) {
      setText('wars-command-message', 'No worker selected. Connect a miner first.');
      return;
    }
    try {
      await sendJson('/api/hash-wars/worker/' + encodeURIComponent(worker), 'PUT', {
        callsign: byId('wars-command-callsign').value,
        faction: byId('wars-command-faction').value,
        territory: byId('wars-command-territory').value,
        stance: byId('wars-command-stance').value
      });
      setText('wars-command-message', 'Deployed. Pressure applies next tick.');
      refresh();
    } catch (error) {
      setText('wars-command-message', 'Deploy failed: ' + error.message);
    }
  });
}
if (byId('war-toggle-sidebar')) {
  byId('war-toggle-sidebar').addEventListener('click', function() {
    var sb = byId('war-sidebar');
    if (sb) sb.classList.toggle('collapsed');
  });
}
if (byId('war-close-sidebar')) {
  byId('war-close-sidebar').addEventListener('click', function() {
    var sb = byId('war-sidebar');
    if (sb) sb.classList.add('collapsed');
  });
}

var initialFilter = currentAddressFilter();
if (initialFilter) {
  if (byId('address-filter')) byId('address-filter').value = initialFilter;
  if (byId('miner-address')) byId('miner-address').value = initialFilter;
  if (byId('connect-address')) byId('connect-address').value = initialFilter;
}
if (byId('connect-host')) {
  byId('connect-host').value = connectHostDefault();
}

function updateMissionClock() {
  var now = new Date();
  setText('mission-time', now.toISOString().slice(11, 19));
}

updateMissionClock();
if (byId('connect-host')) {
  updateConnectPreview();
}
setInterval(updateMissionClock, 1000);
refresh();
setInterval(refresh, 15000);
