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

pool.on('difficultyUpdate', function (workerName, diff) {
    const worker = stats.ensureWorker(workerName);
    worker.difficulty = diff;
    worker.lastseen = Date.now();
    stats.save();
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

app.get('/dashboard/:address', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
        return;
    }
    res.json(stats.getWorkersByAddress(req.params.address));
});

app.get('/api/dashboard/:address', (req, res) => {
    const workers = stats.getWorkersByAddress(req.params.address);
    res.json({
        address: req.params.address,
        workers,
        totals: workers.reduce((totals, worker) => {
            totals.hashrate += parseNumber(worker.hashrate, 0);
            totals.valid += parseNumber(worker.valid, 0);
            totals.invalid += parseNumber(worker.invalid, 0);
            totals.unpaid += parseNumber(worker.unpaid, 0);
            totals.blocks += parseNumber(worker.blocks, 0);
            return totals;
        }, { hashrate: 0, valid: 0, invalid: 0, unpaid: 0, blocks: 0 })
    });
});

app.get('/api/shares', (req, res) => {
    res.json(stats.getRecentShares(parseNumber(req.query.limit, 50)));
});

app.get('/api/blocks', (req, res) => {
    res.json(stats.getRecentBlocks(parseNumber(req.query.limit, 25)));
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
    pool.start(stats);
}

start().catch(error => {
    console.error(error);
    process.exit(1);
});
