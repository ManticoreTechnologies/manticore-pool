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

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currentAddressFilter() {
  var parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'dashboard' && parts[1]) {
    return parts[1];
  }
  return byId('address-filter').value.trim();
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
  byId('pool-hashrate').textContent = formatHashrate(pool.hashrate);
  byId('active-miners').textContent = pool.activeMiners || 0;
  byId('blocks-found').textContent = pool.blocksFound || 0;
  byId('valid-shares').textContent = pool.validShares || 0;
  byId('invalid-shares').textContent = pool.invalidShares || 0;
  byId('pool-unpaid').textContent = formatEvr(pool.unpaid);
  byId('pool-paid').textContent = formatEvr(pool.paid) + ' paid';
}

function renderNetwork(net) {
  byId('net-height').textContent = net.height || '-';
  byId('net-difficulty').textContent = net.difficulty ? Number(net.difficulty).toLocaleString() : '-';
  byId('net-hashrate').textContent = formatHashrate(net.hashrate);
  byId('network-share').textContent = net.networkShare ? (net.networkShare * 100).toFixed(6) + '%' : '0%';
}

function renderWorkers(workers) {
  var tbody = byId('workers');
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

  byId('miner-address-label').textContent = address || '-';
  byId('miner-hashrate').textContent = formatHashrate(totals.hashrate);
  byId('miner-unpaid').textContent = formatEvr(totals.unpaid);
  byId('miner-eligible').textContent = formatEvr(candidates.total);
  byId('auto-payout').checked = prefs.autoPayout === true;
  byId('payout-threshold').value = satsToEvrNumber(prefs.payoutThreshold).toFixed(8);
  byId('miner-link').href = address ? '/dashboard/' + encodeURIComponent(address) : '#';
}

async function refresh() {
  var health = byId('health');
  try {
    var address = currentAddressFilter();
    var workersUrl = address ? '/api/workers/' + encodeURIComponent(address) : '/api/workers';
    var requests = [
      getJson('/api/poolstats'),
      getJson('/api/netstats').catch(function(error) { return { error: error.message }; }),
      getJson(workersUrl),
      getJson('/api/blocks'),
      getJson('/api/payouts')
    ];
    if (address) {
      requests.push(getJson('/api/miner/' + encodeURIComponent(address)));
    }
    var results = await Promise.all(requests);

    renderPool(results[0]);
    if (!results[1].error) {
      renderNetwork(results[1]);
      health.textContent = 'Online';
      health.className = 'status online';
    } else {
      health.textContent = 'Node unavailable';
      health.className = 'status warning';
    }
    renderWorkers(results[2]);
    renderBlocks(results[3]);
    renderPayouts(results[4]);
    if (address) {
      renderMiner(results[5]);
      byId('miner-panel').style.display = '';
    } else {
      byId('miner-panel').style.display = '';
      renderMiner({ address: '', totals: {}, preferences: { payoutThreshold: results[0].payoutThreshold || 0 }, payoutCandidates: { total: 0 } });
    }
  } catch (error) {
    health.textContent = 'Dashboard error';
    health.className = 'status warning';
    console.error(error);
  }
}

byId('refresh').addEventListener('click', refresh);
byId('address-filter').addEventListener('input', function() {
  byId('miner-address').value = byId('address-filter').value.trim();
  refresh();
});
byId('miner-address').addEventListener('change', function() {
  var address = byId('miner-address').value.trim();
  byId('address-filter').value = address;
  if (address) {
    window.history.replaceState({}, '', '/dashboard/' + encodeURIComponent(address));
  } else {
    window.history.replaceState({}, '', '/');
  }
  refresh();
});
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

var initialFilter = currentAddressFilter();
if (initialFilter) {
  byId('address-filter').value = initialFilter;
  byId('miner-address').value = initialFilter;
}

refresh();
setInterval(refresh, 15000);
