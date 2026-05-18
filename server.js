const path = require('path');

const express = require('express');
const cors = require('cors');

const daemon = require('./lib/daemon.js');
const Stratum = require('./lib/index.js');
const PoolStatsStore = require('./lib/poolStatsStore.js');
const { options, evrmore_config_path } = require('./config.js');

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function satsToEvr(amount) {
    return Number((parseNumber(amount, 0) / 100000000).toFixed(8));
}

function requirePayoutAdmin(req, res) {
    if (!options.payoutAdminToken) {
        return true;
    }

    const token = req.get('x-payout-admin-token') || req.body.payoutAdminToken || '';
    if (token === options.payoutAdminToken) {
        return true;
    }

    res.status(401).json({ error: 'Payout admin token required' });
    return false;
}

function applyNetworkMode(mode) {
    if (mode === 'testnet') {
        options.testnet = true;
        options.daemons[0].port = parseNumber(
            process.env.EVR_RPC_PORT,
            options.daemons[0].port === 8819 ? 9821 : options.daemons[0].port
        );
        options.p2p.port = parseNumber(process.env.EVR_P2P_PORT, 18771);
    } else {
        options.testnet = false;
        options.daemons[0].port = parseNumber(process.env.EVR_RPC_PORT, options.daemons[0].port || 8819);
        options.p2p.port = parseNumber(process.env.EVR_P2P_PORT, 18770);
    }
}

const networkMode = (process.argv[2] || process.env.EVR_NETWORK || 'mainnet').toLowerCase();
if (networkMode !== 'mainnet' && networkMode !== 'testnet') {
    console.error('Usage: node server.js [mainnet|testnet]');
    process.exit(1);
}
applyNetworkMode(networkMode);

if (!options.daemons[0].user || !options.daemons[0].password) {
    console.warn('EVR RPC credentials were not found. Set EVR_RPC_URL, EVRMORE_CONF, or EVR_RPC_USER/EVR_RPC_PASSWORD before starting against a node.');
}

const stats = new PoolStatsStore(process.env.POOL_STATE_FILE || path.join(__dirname, 'data', 'pool-state.json'), options);
const Daemon = new daemon.interface(options.daemons, function (severity, message) {
    console.log(`${severity}: ${message}`);
});

function daemonCmd(command, args) {
    return new Promise((resolve, reject) => {
        Daemon.cmd(command, args || [], function (results) {
            const result = results && results[0] ? results[0] : {};
            if (result.error) {
                reject(result.error);
                return;
            }
            resolve(result.response);
        });
    });
}

class DaemonUtility {
    static async getMiningInfo() {
        return daemonCmd('getmininginfo', []);
    }

    static async getHashrate() {
        const miningInfo = await this.getMiningInfo();
        return Math.round(parseNumber(miningInfo.networkhashps, 0));
    }

    static async getDifficulty() {
        const miningInfo = await this.getMiningInfo();
        return parseNumber(miningInfo.difficulty, 0);
    }

    static async getBlockHeight() {
        return daemonCmd('getblockcount', []);
    }

    static async getLastBlockTime() {
        const blockCount = await this.getBlockHeight();
        const blockHash = await daemonCmd('getblockhash', [Math.max(blockCount - 1, 0)]);
        const block = await daemonCmd('getblock', [blockHash]);
        return block.time || 0;
    }

    static async getBlockReward() {
        const blockCount = await this.getBlockHeight();
        const subsidyHalvingInterval = 1648776;
        const genesisReward = 2778;
        return genesisReward / (2 ** Math.floor(blockCount / subsidyHalvingInterval));
    }

    static async getAssetCount() {
        try {
            const assets = await daemonCmd('listassets', []);
            return Array.isArray(assets) ? assets.length : 0;
        } catch (error) {
            return 0;
        }
    }

    static async getBlockSizeAndHeight() {
        const blockHash = await daemonCmd('getbestblockhash', []);
        const block = await daemonCmd('getblock', [blockHash]);
        return {
            blockSize: block.size || 0,
            height: block.height || 0
        };
    }

    static async getNetworkSnapshot() {
        const miningInfo = await this.getMiningInfo();
        const height = miningInfo.blocks || await this.getBlockHeight();
        const blockSizeAndHeight = await this.getBlockSizeAndHeight().catch(() => ({ blockSize: 0, height }));

        return {
            height,
            hashrate: Math.round(parseNumber(miningInfo.networkhashps, 0)),
            difficulty: parseNumber(miningInfo.difficulty, 0),
            assetsCount: await this.getAssetCount(),
            blockReward: await this.getBlockReward(),
            blockTime: await this.getLastBlockTime().catch(() => 0),
            blockSize: blockSizeAndHeight.blockSize,
            connections: miningInfo.connections || 0
        };
    }
}

async function refreshTrackedBlockConfirmations() {
    const blocks = stats.getBlocksNeedingConfirmation(options.payoutMaturityConfirmations);
    for (const block of blocks) {
        if (!block.hash || block.status === 'orphaned') {
            continue;
        }

        try {
            const blockData = await daemonCmd('getblock', [block.hash]);
            const confirmations = parseNumber(blockData.confirmations, 0);
            const status = confirmations < 0
                ? 'orphaned'
                : confirmations >= options.payoutMaturityConfirmations ? 'matured' : 'confirmed';
            stats.updateBlockConfirmation(block.hash, confirmations, status);
        } catch (error) {
            console.warn(`Unable to refresh block confirmations for ${block.hash}: ${error.message || JSON.stringify(error)}`);
        }
    }
}

async function validatePayoutAddress(address) {
    try {
        const result = await daemonCmd('validateaddress', [address]);
        return !!(result && result.isvalid);
    } catch (error) {
        console.warn(`Unable to validate payout address ${address}: ${error.message || JSON.stringify(error)}`);
        return false;
    }
}

async function unlockWalletIfConfigured() {
    if (!options.walletPassphrase) {
        return;
    }

    await daemonCmd('walletpassphrase', [options.walletPassphrase, options.walletUnlockSeconds]);
}

async function sendMaturePayouts(candidateSummary) {
    const outputs = {};
    const payableSummary = Object.assign({}, candidateSummary, { payouts: [], total: 0 });

    for (const candidate of candidateSummary.payouts) {
        if (!(await validatePayoutAddress(candidate.address))) {
            console.warn(`Skipping payout for invalid address ${candidate.address}`);
            continue;
        }

        outputs[candidate.address] = satsToEvr(candidate.amount);
        payableSummary.payouts.push(candidate);
        payableSummary.total += candidate.amount;
    }

    if (payableSummary.total <= 0) {
        return null;
    }

    const walletBalance = parseNumber(await daemonCmd('getbalance', []), 0);
    const payoutTotal = satsToEvr(payableSummary.total);
    if (walletBalance + 0.00000001 < payoutTotal) {
        console.warn(`Skipping payouts; wallet balance ${walletBalance} EVR is below payout total ${payoutTotal} EVR`);
        return null;
    }

    await unlockWalletIfConfigured();
    const txid = await daemonCmd('sendmany', [
        '',
        outputs,
        options.payoutMinConfirmations,
        'Manticore EVR pool payout'
    ]);

    return stats.markPayoutPaid(payableSummary, txid);
}

let payoutInProgress = false;
async function processAddressPayout(address) {
    if (payoutInProgress) {
        throw new Error('Payout processing is already running');
    }

    payoutInProgress = true;
    try {
        await refreshTrackedBlockConfirmations();
        const preferences = stats.ensureAddress(address);
        const candidates = stats.getPayoutCandidates(
            preferences.payoutThreshold,
            options.payoutMaturityConfirmations,
            { address }
        );
        if (candidates.total <= 0) {
            return {
                paid: false,
                reason: 'No mature balance at or above payout threshold',
                candidates
            };
        }

        const payout = await sendMaturePayouts(candidates);
        return {
            paid: !!payout,
            payout,
            candidates
        };
    } finally {
        payoutInProgress = false;
    }
}

async function processPayouts() {
    if (payoutInProgress) {
        return;
    }

    payoutInProgress = true;
    try {
        await refreshTrackedBlockConfirmations();

        if (!options.payoutsEnabled) {
            return;
        }

        const candidates = stats.getPayoutCandidates(
            options.payoutThreshold,
            options.payoutMaturityConfirmations,
            { autoOnly: true }
        );
        if (candidates.total <= 0) {
            return;
        }

        const payout = await sendMaturePayouts(candidates);
        if (payout) {
            console.log(`Paid ${satsToEvr(payout.total)} EVR to ${payout.outputs.length} address(es): ${payout.txid}`);
        }
    } catch (error) {
        console.warn(`Payout processing failed: ${error.message || JSON.stringify(error)}`);
    } finally {
        payoutInProgress = false;
    }
}

const pool = Stratum.createPool(options, function (ip, port, workerName, password, extraNonce1, version, callback) {
    console.log(`Authorize ${workerName} from ${ip}:${port}`);
    callback(stats.authorizeWorker(workerName, password));
});

pool.on('share', function (isValidShare, isValidBlock, data) {
    const result = stats.recordShare(isValidShare, isValidBlock, data || {});
    const status = isValidShare ? 'accepted' : 'rejected';
    const blockStatus = isValidBlock ? ' block-candidate' : '';
    const reason = data && data.error ? ` (${data.error})` : '';
    console.log(`Share ${status}${blockStatus}: ${result.worker.workername}${reason}`);

    broadcast('share', {
        worker: result.worker.workername,
        callsign: result.worker.callsign || result.worker.workername.split('.').slice(1).join('.'),
        faction: result.worker.faction,
        territory: result.worker.territory,
        valid: !!isValidShare,
        block: !!isValidBlock,
        hashrate: result.worker.hashrate,
        timestamp: Date.now()
    });

    if (isValidBlock) {
        const faction = result.worker.faction;
        const factionDef = require('./lib/poolStatsStore.js').INVENTORY_ITEMS ? null : null;
        broadcast('block', {
            finder: result.worker.workername,
            callsign: result.worker.callsign,
            faction: faction,
            height: data && data.height,
            timestamp: Date.now()
        });
    }
});

pool.on('difficultyUpdate', function (workerName, diff) {
    const worker = stats.ensureWorker(workerName);
    worker.difficulty = diff;
    worker.lastseen = Date.now();
    stats.save();
    broadcast('worker_update', {
        worker: workerName,
        callsign: worker.callsign,
        faction: worker.faction,
        difficulty: diff,
        hashrate: worker.hashrate,
        timestamp: Date.now()
    });
});

pool.on('newBlock', async function (block) {
    const height = block && block.rpcData ? block.rpcData.height : 'unknown';
    console.log(`New block template detected: ${height}`);
    try {
        const snapshot = await DaemonUtility.getNetworkSnapshot();
        stats.recordNetworkStats(snapshot);
    } catch (error) {
        console.warn(`Unable to update network stats: ${error.message || error}`);
    }
});

pool.on('banIP', function (ip, workerName) {
    console.warn(`Banned ${ip} for worker ${workerName}`);
});

pool.on('log', function (severity, logKey, logText) {
    const message = logText ? `[${logKey}] ${logText}` : logKey;
    console.log(`${severity}: ${message}`);
});

const app = express();
const apiPort = parseNumber(process.env.API_PORT, 3000);
const apiHost = process.env.API_HOST || process.env.API_BIND_ADDRESS || process.env.DASHBOARD_HOST || '0.0.0.0';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sseClients = new Map();
let sseNextId = 1;

function broadcast(event, data) {
    if (sseClients.size === 0) return;
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach((res) => {
        try { res.write(message); } catch (e) { /* client gone */ }
    });
}

app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    const clientId = sseNextId++;
    sseClients.set(clientId, res);
    res.write(`event: connected\ndata: {"clientId":${clientId}}\n\n`);
    const keepalive = setInterval(() => {
        try { res.write(': keepalive\n\n'); } catch (e) { clearInterval(keepalive); }
    }, 15000);
    req.on('close', () => {
        clearInterval(keepalive);
        sseClients.delete(clientId);
    });
});

function resolveAuthToken(req) {
    const header = req.get('authorization') || '';
    if (header.startsWith('Bearer ')) {
        return stats.validateAuthToken(header.slice(7));
    }
    return null;
}

function requireAuth(req, res, next) {
    const address = resolveAuthToken(req);
    if (!address) {
        res.status(401).json({ error: 'Authentication required. Log in with your miner address and password.' });
        return;
    }
    req.authAddress = address;
    next();
}

function requireAddressAuth(req, res, next) {
    const address = resolveAuthToken(req);
    if (!address) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
    }
    const target = req.params.address || '';
    if (address !== target) {
        res.status(403).json({ error: 'Access denied. You can only access your own account.' });
        return;
    }
    req.authAddress = address;
    next();
}

function requireWorkerAuth(req, res, next) {
    const address = resolveAuthToken(req);
    if (!address) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
    }
    const workerName = req.params.workerName || '';
    const workerAddress = stats.workerAddress(workerName);
    if (address !== workerAddress) {
        res.status(403).json({ error: 'Access denied. You can only modify your own workers.' });
        return;
    }
    req.authAddress = address;
    next();
}

app.get('/api/health', async (req, res) => {
    try {
        const height = await DaemonUtility.getBlockHeight();
        res.json({ ok: true, network: networkMode, height });
    } catch (error) {
        res.status(503).json({ ok: false, network: networkMode, error: error.message || String(error) });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        network: networkMode,
        coin: options.coin,
        poolAddress: options.address,
        poolFee: options.poolFee,
        payoutThreshold: options.payoutThreshold,
        payoutsEnabled: options.payoutsEnabled,
        payoutAdminTokenRequired: !!options.payoutAdminToken,
        payoutMaturityConfirmations: options.payoutMaturityConfirmations,
        payoutInterval: options.payoutInterval,
        stratumPorts: Object.keys(options.ports),
        rpcHost: options.daemons[0].host,
        rpcPort: options.daemons[0].port,
        evrmoreConfig: evrmore_config_path
    });
});

app.get('/poolstats', (req, res) => {
    res.json(Object.assign({}, stats.getPoolStats(), {
        difficulty: options.ports[3334] ? options.ports[3334].diff : options.ports[3333].diff
    }));
});

app.get('/api/poolstats', (req, res) => {
    res.json(stats.getPoolStats());
});

app.get('/api/workers', (req, res) => {
    res.json(stats.getWorkers());
});

app.get('/api/workers/:address', (req, res) => {
    res.json(stats.getWorkersByAddress(req.params.address));
});

app.get('/connect', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'connect.html'));
});

app.get('/miner', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'miner.html'));
});

app.get('/proof', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'proof.html'));
});

app.get('/wars', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'wars.html'));
});

app.get('/payouts', (req, res) => {
    res.redirect('/proof');
});

app.get('/api/miner/:address', (req, res) => {
    res.json(stats.getAddressSummary(req.params.address, options.payoutMaturityConfirmations));
});

app.post('/api/auth/login', (req, res) => {
    const { address, password } = req.body || {};
    const authenticated = stats.authenticateAddress(address, password);
    if (!authenticated) {
        res.status(401).json({ error: 'Invalid address or password. Use the password you set when connecting your miner.' });
        return;
    }
    const token = stats.generateAuthToken(authenticated);
    res.json({ token, address: authenticated });
});

app.post('/api/auth/logout', (req, res) => {
    const header = req.get('authorization') || '';
    if (header.startsWith('Bearer ')) {
        stats.revokeAuthToken(header.slice(7));
    }
    res.json({ ok: true });
});

app.get('/api/auth/verify', (req, res) => {
    const address = resolveAuthToken(req);
    if (!address) {
        res.status(401).json({ valid: false });
        return;
    }
    res.json({ valid: true, address });
});

app.get('/api/account', requireAuth, (req, res) => {
    res.json(stats.getAccountState(req.authAddress));
});

app.get('/api/account/inventory', requireAuth, (req, res) => {
    res.json(stats.getInventory(req.authAddress));
});

app.post('/api/account/inventory/use', requireAuth, (req, res) => {
    const result = stats.useItem(req.authAddress, req.body.itemId);
    if (result.error) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});

app.get('/api/hash-wars', (req, res) => {
    res.json(stats.getHashWarsState());
});

app.put('/api/hash-wars/worker/:workerName', requireWorkerAuth, (req, res) => {
    const worker = stats.setWorkerIdentity(req.params.workerName, {
        callsign: req.body.callsign,
        faction: req.body.faction,
        territory: req.body.territory,
        stance: req.body.stance
    });
    res.json(worker);
});

app.put('/api/miner/:address/payout-settings', requireAddressAuth, (req, res) => {
    const preferences = stats.setAddressPayoutPreferences(req.params.address, {
        autoPayout: req.body.autoPayout,
        payoutThreshold: req.body.payoutThreshold
    });
    res.json(preferences);
});

app.post('/api/miner/:address/payout', requireAddressAuth, async (req, res) => {
    try {
        const result = await processAddressPayout(req.params.address);
        if (!result.paid) {
            res.status(409).json(result);
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message || String(error) });
    }
});

app.get('/dashboard/:address', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'miner.html'));
        return;
    }
    res.json(stats.getWorkersByAddress(req.params.address));
});

app.get('/api/dashboard/:address', (req, res) => {
    res.json(stats.getAddressSummary(req.params.address, options.payoutMaturityConfirmations));
});

app.get('/api/shares', (req, res) => {
    res.json(stats.getRecentShares(parseNumber(req.query.limit, 50)));
});

app.get('/api/blocks', (req, res) => {
    res.json(stats.getRecentBlocks(parseNumber(req.query.limit, 25)));
});

app.get('/api/payouts', (req, res) => {
    res.json(stats.getRecentPayouts(parseNumber(req.query.limit, 25)));
});

app.get('/api/payouts/candidates', (req, res) => {
    res.json(stats.getPayoutCandidates(options.payoutThreshold, options.payoutMaturityConfirmations));
});

app.get('/netstats', async (req, res) => {
    try {
        const netstats = await DaemonUtility.getNetworkSnapshot();
        const poolStats = stats.getPoolStats();
        netstats.poolHashrate = poolStats.hashrate;
        netstats.networkShare = netstats.hashrate > 0 ? poolStats.hashrate / netstats.hashrate : 0;
        stats.recordNetworkStats(netstats);
        res.json(netstats);
    } catch (error) {
        res.status(503).json({ error: error.message || String(error), history: stats.getNetworkHistory('all')[0] || null });
    }
});

app.get('/api/netstats', async (req, res) => {
    try {
        const netstats = await DaemonUtility.getNetworkSnapshot();
        const poolStats = stats.getPoolStats();
        netstats.poolHashrate = poolStats.hashrate;
        netstats.networkShare = netstats.hashrate > 0 ? poolStats.hashrate / netstats.hashrate : 0;
        stats.recordNetworkStats(netstats);
        res.json(netstats);
    } catch (error) {
        res.status(503).json({ error: error.message || String(error), history: stats.getNetworkHistory('all')[0] || null });
    }
});

app.get('/netstats/history/:type', (req, res) => {
    res.json(stats.getNetworkHistory(req.params.type));
});

app.get('/api/netstats/history/:type', (req, res) => {
    res.json(stats.getNetworkHistory(req.params.type));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
    const apiServer = app.listen(apiPort, apiHost, () => {
        console.log(`Pool API and dashboard listening on http://${apiHost}:${apiPort}`);
        console.log(`If this is a VPS/cloud server, open TCP ${apiPort} to this instance in the provider firewall/security group.`);
    });

    apiServer.on('error', (error) => {
        console.error(`Pool API failed to listen on ${apiHost}:${apiPort}: ${error.message}`);
        process.exit(1);
    });

    console.log(`Starting EVR pool in ${networkMode} mode`);
    console.log(`RPC daemon: ${options.daemons[0].host}:${options.daemons[0].port}`);
    console.log(`Pool address: ${options.address}`);
    console.log(`Payouts enabled: ${options.payoutsEnabled ? 'yes' : 'no'} (threshold ${satsToEvr(options.payoutThreshold)} EVR, maturity ${options.payoutMaturityConfirmations} confirmations)`);
    setInterval(processPayouts, options.payoutInterval);
    setTimeout(processPayouts, 30000);
    pool.start(stats);
}

start().catch(error => {
    console.error(error);
    process.exit(1);
});
