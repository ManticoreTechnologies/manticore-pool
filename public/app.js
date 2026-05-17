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

function byId(id) {
  return document.getElementById(id);
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

function renderPool(pool) {
  byId('pool-hashrate').textContent = formatHashrate(pool.hashrate);
  byId('active-miners').textContent = pool.activeMiners || 0;
  byId('blocks-found').textContent = pool.blocksFound || 0;
  byId('valid-shares').textContent = pool.validShares || 0;
  byId('invalid-shares').textContent = pool.invalidShares || 0;
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
      '<td><strong>' + worker.workername + '</strong><small>' + worker.address + '</small></td>',
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
      '<span>' + (block.hash || 'pending hash') + '</span>' +
      '<small>Finder: ' + block.finder + ' | Reward: ' + formatEvr(block.reward) + '</small>';
    container.appendChild(item);
  });
}

async function refresh() {
  var health = byId('health');
  try {
    var address = currentAddressFilter();
    var workersUrl = address ? '/api/workers/' + encodeURIComponent(address) : '/api/workers';
    var results = await Promise.all([
      getJson('/api/poolstats'),
      getJson('/api/netstats').catch(function(error) { return { error: error.message }; }),
      getJson(workersUrl),
      getJson('/api/blocks')
    ]);

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
  } catch (error) {
    health.textContent = 'Dashboard error';
    health.className = 'status warning';
    console.error(error);
  }
}

byId('refresh').addEventListener('click', refresh);
byId('address-filter').addEventListener('input', refresh);

var initialFilter = currentAddressFilter();
if (initialFilter) {
  byId('address-filter').value = initialFilter;
}

refresh();
setInterval(refresh, 15000);
