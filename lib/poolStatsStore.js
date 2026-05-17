const fs = require('fs');
const path = require('path');

const EMPTY_STATE = {
    startedAt: null,
    updatedAt: null,
    workers: {},
    shares: [],
    blocks: [],
    networkHistory: [],
    pool: {
        validShares: 0,
        invalidShares: 0,
        totalShares: 0,
        totalBlocks: 0,
        totalRewards: 0,
        unpaid: 0,
        paid: 0,
        accruedFees: 0
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

function safeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sumRewardRecipientPercent(recipients) {
    if (!recipients) {
        return 0;
    }

    return Object.keys(recipients).reduce((sum, address) => {
        return sum + safeNumber(recipients[address], 0);
    }, 0);
}

class PoolStatsStore {
    constructor(filePath, options) {
        this.filePath = filePath || path.join(process.cwd(), 'data', 'pool-state.json');
        this.options = options || {};
        this.state = clone(EMPTY_STATE);
        this.load();
    }

    load() {
        if (!fs.existsSync(this.filePath)) {
            this.state.startedAt = new Date().toISOString();
            this.state.updatedAt = this.state.startedAt;
            this.save();
            return;
        }

        try {
            const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            this.state = Object.assign(clone(EMPTY_STATE), parsed);
            this.state.pool = Object.assign(clone(EMPTY_STATE).pool, parsed.pool || {});
            this.state.workers = parsed.workers || {};
            this.state.shares = parsed.shares || [];
            this.state.blocks = parsed.blocks || [];
            this.state.networkHistory = parsed.networkHistory || [];
        } catch (error) {
            const backupPath = `${this.filePath}.${Date.now()}.bad`;
            fs.renameSync(this.filePath, backupPath);
            this.state = clone(EMPTY_STATE);
            this.state.startedAt = new Date().toISOString();
            this.state.updatedAt = this.state.startedAt;
            this.save();
            console.error(`Pool stats file was unreadable; moved it to ${backupPath}`);
        }
    }

    save() {
        ensureDir(path.dirname(this.filePath));
        this.state.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    }

    workerAddress(workerName) {
        return String(workerName || '').split('.')[0] || 'unknown';
    }

    defaultWorker(workerName, password) {
        const now = Date.now();
        return {
            workername: workerName,
            address: this.workerAddress(workerName),
            password: password || '',
            valid: 0,
            invalid: 0,
            blocks: 0,
            hashrate: 0,
            roundshares: 0,
            totalshares: 0,
            lastsharetime: 0,
            firstseen: now,
            lastseen: now,
            paid: 0,
            unpaid: 0,
            payoutThreshold: safeNumber(this.options.payoutThreshold, 0),
            dailyHashrate: [],
            historicalShareTimes: []
        };
    }

    authorizeWorker(workerName, password) {
        const normalized = String(workerName || '').trim();
        if (!normalized || normalized === 'undefined.noname') {
            return {
                error: [20, 'missing worker name', null],
                authorized: false,
                disconnect: false
            };
        }

        const worker = this.ensureWorker(normalized, password);
        worker.lastseen = Date.now();
        if (password && !worker.password) {
            worker.password = password;
        }
        this.save();

        return {
            error: null,
            authorized: true,
            disconnect: false
        };
    }

    ensureWorker(workerName, password) {
        if (!this.state.workers[workerName]) {
            this.state.workers[workerName] = this.defaultWorker(workerName, password);
        }
        return this.state.workers[workerName];
    }

    calculateHashrate(worker, shareData) {
        const previousTime = safeNumber(worker.lastsharetime, 0);
        const submitTime = safeNumber(shareData.submitTime, Date.now());
        const difficulty = safeNumber(shareData.difficulty, 0);
        const deltaSeconds = previousTime > 0 ? Math.max((submitTime - previousTime) / 1000, 1) : 0;

        if (deltaSeconds <= 0 || difficulty <= 0) {
            return worker.hashrate || 0;
        }

        const hashrate = Math.floor(difficulty * Math.pow(2, 32) / deltaSeconds);
        if (!Number.isFinite(hashrate) || hashrate < 0) {
            return 0;
        }
        return hashrate;
    }

    recordShare(isValidShare, isValidBlock, shareData) {
        const workerName = shareData.worker || 'unknown.noname';
        const worker = this.ensureWorker(workerName);
        const submitTime = safeNumber(shareData.submitTime, Date.now());
        const hashrate = isValidShare ? this.calculateHashrate(worker, shareData) : worker.hashrate;

        worker.lastseen = submitTime;
        worker.lastsharetime = submitTime;
        worker.totalshares += 1;
        this.state.pool.totalShares += 1;

        if (isValidShare) {
            worker.valid += 1;
            worker.roundshares += 1;
            this.state.pool.validShares += 1;
        } else {
            worker.invalid += 1;
            this.state.pool.invalidShares += 1;
        }

        worker.hashrate = hashrate;
        worker.dailyHashrate.push({ timestamp: submitTime, hashrate });
        worker.historicalShareTimes.push({
            timestamp: submitTime,
            difficulty: safeNumber(shareData.difficulty, 0)
        });
        worker.dailyHashrate = worker.dailyHashrate.slice(-288);
        worker.historicalShareTimes = worker.historicalShareTimes.slice(-288);

        const share = {
            worker: workerName,
            address: worker.address,
            valid: !!isValidShare,
            block: !!isValidBlock,
            height: shareData.height,
            difficulty: shareData.difficulty,
            shareDiff: shareData.shareDiff,
            blockHash: shareData.blockHash,
            error: shareData.error,
            submittedAt: submitTime
        };
        this.state.shares.push(share);
        this.state.shares = this.state.shares.slice(-500);

        if (isValidBlock) {
            this.recordBlock(worker, shareData);
        }

        this.save();
        return { worker, share };
    }

    recordBlock(finder, shareData) {
        const reward = safeNumber(shareData.blockReward, 0);
        const poolFee = Math.max(safeNumber(this.options.poolFee, 0), 0);
        const recipientPercent = sumRewardRecipientPercent(this.options.rewardRecipients) / 100;
        const distributablePercent = Math.max(1 - poolFee - recipientPercent, 0);
        const distributableReward = Math.floor(reward * distributablePercent);
        const totalRoundShares = Object.keys(this.state.workers).reduce((sum, workerName) => {
            return sum + safeNumber(this.state.workers[workerName].roundshares, 0);
        }, 0);

        Object.keys(this.state.workers).forEach(workerName => {
            const worker = this.state.workers[workerName];
            const roundShares = safeNumber(worker.roundshares, 0);
            if (totalRoundShares > 0 && roundShares > 0) {
                const amount = Math.floor(distributableReward * (roundShares / totalRoundShares));
                worker.unpaid += amount;
                this.state.pool.unpaid += amount;
            }
            worker.roundshares = 0;
        });

        finder.blocks += 1;
        this.state.pool.totalBlocks += 1;
        this.state.pool.totalRewards += reward;
        this.state.pool.accruedFees += Math.floor(reward * poolFee);
        this.state.blocks.push({
            hash: shareData.blockHash,
            height: shareData.height,
            reward,
            distributableReward,
            finder: finder.workername,
            submittedAt: safeNumber(shareData.submitTime, Date.now()),
            difficulty: shareData.blockDiff,
            status: 'submitted'
        });
        this.state.blocks = this.state.blocks.slice(-100);
    }

    recordNetworkStats(stats) {
        const row = Object.assign({ timestamp: Date.now() }, stats || {});
        this.state.networkHistory.push(row);
        this.state.networkHistory = this.state.networkHistory.slice(-288);
        this.save();
        return row;
    }

    getPoolStats() {
        const activeCutoff = Date.now() - 5 * 60 * 1000;
        const workers = Object.keys(this.state.workers).map(workerName => this.state.workers[workerName]);
        const activeWorkers = workers.filter(worker => safeNumber(worker.lastsharetime, 0) >= activeCutoff);
        const poolHashrate = activeWorkers.reduce((sum, worker) => sum + safeNumber(worker.hashrate, 0), 0);

        return {
            startedAt: this.state.startedAt,
            updatedAt: this.state.updatedAt,
            hashrate: poolHashrate,
            activeMiners: activeWorkers.length,
            totalMiners: workers.length,
            validShares: this.state.pool.validShares,
            invalidShares: this.state.pool.invalidShares,
            totalShares: this.state.pool.totalShares,
            blocksFound: this.state.pool.totalBlocks,
            totalRewards: this.state.pool.totalRewards,
            unpaid: this.state.pool.unpaid,
            paid: this.state.pool.paid,
            accruedFees: this.state.pool.accruedFees
        };
    }

    getWorkers() {
        return Object.keys(this.state.workers)
            .sort()
            .map(workerName => this.state.workers[workerName]);
    }

    getWorkersByAddress(address) {
        return this.getWorkers().filter(worker => worker.address === address);
    }

    getRecentShares(limit) {
        return this.state.shares.slice(-(limit || 50)).reverse();
    }

    getRecentBlocks(limit) {
        return this.state.blocks.slice(-(limit || 25)).reverse();
    }

    getNetworkHistory(type) {
        if (!type || type === 'all') {
            return this.state.networkHistory.slice().reverse();
        }

        return this.state.networkHistory
            .filter(row => Object.prototype.hasOwnProperty.call(row, type))
            .map(row => ({ timestamp: row.timestamp, value: row[type] }))
            .reverse();
    }
}

module.exports = PoolStatsStore;
