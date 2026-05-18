const fs = require('fs');
const path = require('path');

const rigMeta = require('./rigMeta.js');

const DEFAULT_BOSS_TARGET = 75000;

const EMPTY_STATE = {
    startedAt: null,
    updatedAt: null,
    workers: {},
    addresses: {},
    shares: [],
    blocks: [],
    payouts: [],
    networkHistory: [],
    communityEvent: {
        weekKey: '',
        title: 'Boss Battle: Share Surge',
        shareTargetDelta: DEFAULT_BOSS_TARGET,
        baselineValidShares: 0,
        completed: false,
        completedAt: null
    },
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
            this.state.addresses = parsed.addresses || {};
            this.state.shares = parsed.shares || [];
            this.state.blocks = parsed.blocks || [];
            this.state.payouts = parsed.payouts || [];
            this.state.networkHistory = parsed.networkHistory || [];
            this.state.communityEvent = Object.assign(
                clone(EMPTY_STATE).communityEvent,
                parsed.communityEvent || {}
            );
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

    defaultAddress(address) {
        return {
            address,
            autoPayout: false,
            payoutThreshold: safeNumber(this.options.payoutThreshold, 0),
            updatedAt: Date.now()
        };
    }

    ensureAddress(address) {
        const normalized = String(address || '').trim();
        if (!this.state.addresses[normalized]) {
            this.state.addresses[normalized] = this.defaultAddress(normalized);
        }
        return this.state.addresses[normalized];
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
            historicalShareTimes: [],
            stratumPort: 0,
            uptimeStreakMs: 0,
            survivalStreak: 0,
            luckyShares: 0,
            jackpotNearHits: 0,
            peakDifficultySeen: 0
        };
    }

    migrateWorkerFields(worker) {
        if (!worker) {
            return;
        }
        if (worker.stratumPort == null) {
            worker.stratumPort = 0;
        }
        if (worker.uptimeStreakMs == null) {
            worker.uptimeStreakMs = 0;
        }
        if (worker.survivalStreak == null) {
            worker.survivalStreak = 0;
        }
        if (worker.luckyShares == null) {
            worker.luckyShares = 0;
        }
        if (worker.jackpotNearHits == null) {
            worker.jackpotNearHits = 0;
        }
        if (worker.peakDifficultySeen == null) {
            worker.peakDifficultySeen = 0;
        }
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
        this.migrateWorkerFields(this.state.workers[workerName]);
        this.ensureAddress(this.state.workers[workerName].address);
        return this.state.workers[workerName];
    }

    setAddressPayoutPreferences(address, preferences) {
        const current = this.ensureAddress(address);
        if (Object.prototype.hasOwnProperty.call(preferences, 'autoPayout')) {
            current.autoPayout = preferences.autoPayout === true;
        }
        if (Object.prototype.hasOwnProperty.call(preferences, 'payoutThreshold')) {
            current.payoutThreshold = Math.max(Math.floor(safeNumber(preferences.payoutThreshold, current.payoutThreshold)), 0);
        }
        current.updatedAt = Date.now();
        this.save();
        return current;
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
        const previousLastShare = safeNumber(worker.lastsharetime, 0);
        const submitTime = safeNumber(shareData.submitTime, Date.now());
        this.ensureBossWeek();
        const hashrate = isValidShare ? this.calculateHashrate(worker, shareData) : worker.hashrate;
        const stratumPort = safeNumber(shareData.port, 0);
        if (stratumPort > 0) {
            worker.stratumPort = stratumPort;
        }

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

        const difficulty = safeNumber(shareData.difficulty, 0);
        const HOT_STREAK_MS = 10 * 60 * 1000;
        if (isValidShare) {
            if (previousLastShare > 0 && submitTime - previousLastShare < HOT_STREAK_MS) {
                const delta = Math.min(Math.max(submitTime - previousLastShare, 0), HOT_STREAK_MS);
                worker.uptimeStreakMs = safeNumber(worker.uptimeStreakMs, 0) + delta;
            } else if (previousLastShare > 0) {
                worker.uptimeStreakMs = 0;
            }
            worker.survivalStreak = safeNumber(worker.survivalStreak, 0) + 1;

            const historyBefore = (worker.historicalShareTimes || []).slice(-40);
            const median = rigMeta.medianDifficulties(historyBefore);
            if (median && difficulty > median * 1.35) {
                worker.luckyShares = safeNumber(worker.luckyShares, 0) + 1;
            }

            const peak = safeNumber(worker.peakDifficultySeen, 0);
            if (peak > 0 && difficulty < peak && difficulty >= peak * 0.9) {
                worker.jackpotNearHits = safeNumber(worker.jackpotNearHits, 0) + 1;
            }
            if (difficulty > peak) {
                worker.peakDifficultySeen = difficulty;
            }
        } else {
            worker.survivalStreak = 0;
            worker.uptimeStreakMs = 0;
        }

        if (isValidShare && this.state.communityEvent && !this.state.communityEvent.completed) {
            const baseline = safeNumber(this.state.communityEvent.baselineValidShares, 0);
            const target = safeNumber(this.state.communityEvent.shareTargetDelta, DEFAULT_BOSS_TARGET);
            if (this.state.pool.validShares - baseline >= target) {
                this.state.communityEvent.completed = true;
                this.state.communityEvent.completedAt = submitTime;
            }
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

        const allocations = [];
        Object.keys(this.state.workers).forEach(workerName => {
            const worker = this.state.workers[workerName];
            const roundShares = safeNumber(worker.roundshares, 0);
            if (totalRoundShares > 0 && roundShares > 0) {
                const amount = Math.floor(distributableReward * (roundShares / totalRoundShares));
                worker.unpaid += amount;
                this.state.pool.unpaid += amount;
                allocations.push({
                    worker: worker.workername,
                    address: worker.address,
                    amount,
                    shares: roundShares,
                    paid: false,
                    paidTxid: null,
                    paidAt: null
                });
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
            confirmations: 0,
            status: 'submitted',
            allocations
        });
    }

    updateBlockConfirmation(hash, confirmations, status) {
        const block = this.state.blocks.find(row => row.hash === hash);
        if (!block) {
            return null;
        }

        block.confirmations = safeNumber(confirmations, block.confirmations || 0);
        block.status = status || (block.confirmations < 0 ? 'orphaned' : 'confirmed');
        block.updatedAt = Date.now();
        this.save();
        return block;
    }

    getPayoutCandidates(threshold, maturityConfirmations, filters) {
        filters = filters || {};
        const minAmount = safeNumber(threshold, 0);
        const minConfirmations = safeNumber(maturityConfirmations, 100);
        const grouped = {};

        this.state.blocks.forEach((block, blockIndex) => {
            if (safeNumber(block.confirmations, 0) < minConfirmations || block.status === 'orphaned') {
                return;
            }

            (block.allocations || []).forEach((allocation, allocationIndex) => {
                if (allocation.paid || safeNumber(allocation.amount, 0) <= 0) {
                    return;
                }
                if (filters.address && allocation.address !== filters.address) {
                    return;
                }

                if (!grouped[allocation.address]) {
                    const preferences = this.ensureAddress(allocation.address);
                    grouped[allocation.address] = {
                        address: allocation.address,
                        autoPayout: preferences.autoPayout === true,
                        payoutThreshold: safeNumber(preferences.payoutThreshold, minAmount),
                        amount: 0,
                        items: []
                    };
                }

                grouped[allocation.address].amount += safeNumber(allocation.amount, 0);
                grouped[allocation.address].items.push({
                    blockIndex,
                    allocationIndex,
                    worker: allocation.worker,
                    blockHash: block.hash,
                    amount: safeNumber(allocation.amount, 0)
                });
            });
        });

        const payouts = Object.keys(grouped)
            .map(address => grouped[address])
            .filter(candidate => {
                const candidateThreshold = Object.prototype.hasOwnProperty.call(filters, 'thresholdOverride')
                    ? safeNumber(filters.thresholdOverride, minAmount)
                    : safeNumber(candidate.payoutThreshold, minAmount);
                if (filters.autoOnly && candidate.autoPayout !== true) {
                    return false;
                }
                return candidate.amount >= candidateThreshold;
            });

        return {
            threshold: minAmount,
            maturityConfirmations: minConfirmations,
            payouts,
            total: payouts.reduce((sum, candidate) => sum + candidate.amount, 0)
        };
    }

    markPayoutPaid(candidateSummary, txid) {
        const paidAt = Date.now();
        let totalPaid = 0;
        const payoutRecord = {
            txid,
            paidAt,
            outputs: []
        };

        (candidateSummary.payouts || []).forEach(candidate => {
            let addressPaid = 0;
            candidate.items.forEach(item => {
                const block = this.state.blocks[item.blockIndex];
                if (!block || !block.allocations || !block.allocations[item.allocationIndex]) {
                    return;
                }

                const allocation = block.allocations[item.allocationIndex];
                if (allocation.paid) {
                    return;
                }

                const amount = safeNumber(allocation.amount, 0);
                allocation.paid = true;
                allocation.paidTxid = txid;
                allocation.paidAt = paidAt;
                block.paidTxid = txid;
                block.paidAt = paidAt;

                const worker = this.state.workers[allocation.worker];
                if (worker) {
                    worker.unpaid = Math.max(safeNumber(worker.unpaid, 0) - amount, 0);
                    worker.paid = safeNumber(worker.paid, 0) + amount;
                }

                totalPaid += amount;
                addressPaid += amount;
            });

            if (addressPaid > 0) {
                payoutRecord.outputs.push({
                    address: candidate.address,
                    amount: addressPaid
                });
            }
        });

        this.state.pool.unpaid = Math.max(safeNumber(this.state.pool.unpaid, 0) - totalPaid, 0);
        this.state.pool.paid = safeNumber(this.state.pool.paid, 0) + totalPaid;
        payoutRecord.total = totalPaid;
        this.state.payouts.push(payoutRecord);
        this.state.payouts = this.state.payouts.slice(-250);
        this.save();
        return payoutRecord;
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
            accruedFees: this.state.pool.accruedFees,
            payouts: this.state.payouts.length
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

    getAddressSummary(address, maturityConfirmations) {
        const workers = this.getWorkersByAddress(address);
        const preferences = this.ensureAddress(address);
        const totals = workers.reduce((summary, worker) => {
            summary.hashrate += safeNumber(worker.hashrate, 0);
            summary.valid += safeNumber(worker.valid, 0);
            summary.invalid += safeNumber(worker.invalid, 0);
            summary.blocks += safeNumber(worker.blocks, 0);
            summary.unpaid += safeNumber(worker.unpaid, 0);
            summary.paid += safeNumber(worker.paid, 0);
            return summary;
        }, { hashrate: 0, valid: 0, invalid: 0, blocks: 0, unpaid: 0, paid: 0 });

        const candidates = this.getPayoutCandidates(
            preferences.payoutThreshold,
            maturityConfirmations,
            { address }
        );

        return {
            address,
            preferences,
            totals,
            workers,
            payoutCandidates: candidates,
            payouts: this.getRecentPayouts(100).filter(payout => {
                return (payout.outputs || []).some(output => output.address === address);
            })
        };
    }

    getRecentShares(limit) {
        return this.state.shares.slice(-(limit || 50)).reverse();
    }

    getRecentBlocks(limit) {
        return this.state.blocks.slice(-(limit || 25)).reverse();
    }

    getBlocksNeedingConfirmation(maturityConfirmations) {
        const minConfirmations = safeNumber(maturityConfirmations, 100);
        return this.state.blocks.filter(block => {
            if (!block.hash || block.status === 'orphaned') {
                return false;
            }

            const hasUnpaidAllocations = (block.allocations || []).some(allocation => !allocation.paid);
            return safeNumber(block.confirmations, 0) < minConfirmations || hasUnpaidAllocations;
        });
    }

    getRecentPayouts(limit) {
        return this.state.payouts.slice(-(limit || 25)).reverse();
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

    ensureBossWeek() {
        if (!this.state.communityEvent) {
            this.state.communityEvent = Object.assign({}, clone(EMPTY_STATE).communityEvent);
        }
        const ev = this.state.communityEvent;
        const wk = rigMeta.isoWeekKey(new Date());
        if (ev.weekKey !== wk) {
            ev.weekKey = wk;
            ev.baselineValidShares = safeNumber(this.state.pool.validShares, 0);
            ev.completed = false;
            ev.completedAt = null;
            ev.shareTargetDelta = safeNumber(ev.shareTargetDelta, DEFAULT_BOSS_TARGET);
        }
    }

    getCommunityEventSnapshot() {
        this.ensureBossWeek();
        const ev = this.state.communityEvent || clone(EMPTY_STATE).communityEvent;
        const baseline = safeNumber(ev.baselineValidShares, 0);
        const target = Math.max(safeNumber(ev.shareTargetDelta, DEFAULT_BOSS_TARGET), 1);
        const progress = Math.max(0, safeNumber(this.state.pool.validShares, 0) - baseline);
        const percentComplete = Math.min(100, Math.floor((progress / target) * 100));
        return {
            title: ev.title || 'Boss Battle: Share Surge',
            weekKey: ev.weekKey,
            targetValidSharesDelta: target,
            progressValidShares: progress,
            percentComplete,
            completed: !!ev.completed,
            completedAt: ev.completedAt || null,
            rewardCopy: [
                'Reduced pool fee window for 24h when operators mirror the victory policy',
                'Cosmetic unlock: dashboard flair for rigs on the winning alliance',
                'Payout multiplier messaging when treasury rules allow a bonus lane',
                'Proof-trail badge minted for addresses that carried the final megashare push'
            ]
        };
    }

    getFactionsBoard(activeCutoff) {
        const cutoff = safeNumber(activeCutoff, Date.now() - 5 * 60 * 1000);
        const workers = Object.keys(this.state.workers).map(name => this.state.workers[name]);
        const isActive = worker => safeNumber(worker.lastsharetime, 0) >= cutoff;
        const season = rigMeta.currentSeasonKey();

        const factionBuckets = rigMeta.FACTIONS.map((f, idx) => ({
            id: f.id,
            name: f.name,
            tagline: f.tagline,
            index: idx,
            hashrate: 0,
            workersTotal: 0,
            workersActive: 0,
            blocksLifetime: 0,
            rigHours: 0,
            seasonWins: 0
        }));

        workers.forEach(worker => {
            const idx = rigMeta.factionIndexForAddress(worker.address);
            const bucket = factionBuckets[idx];
            bucket.workersTotal += 1;
            bucket.blocksLifetime += safeNumber(worker.blocks, 0);
            bucket.rigHours += Math.max(0, (Date.now() - safeNumber(worker.firstseen, Date.now())) / 3600000);
            if (isActive(worker)) {
                bucket.workersActive += 1;
                bucket.hashrate += safeNumber(worker.hashrate, 0);
            }
        });

        this.state.blocks.forEach(block => {
            if (block.status === 'orphaned') {
                return;
            }
            const finder = String(block.finder || '');
            const addr = finder.split('.')[0] || finder;
            const idx = rigMeta.factionIndexForAddress(addr);
            if (rigMeta.seasonKeyFromTimestamp(block.submittedAt) === season) {
                factionBuckets[idx].seasonWins += 1;
            }
        });

        const allianceDefs = [
            { key: 'coalition', port: 3333 },
            { key: 'vanguard', port: 3334 },
            { key: 'unassigned', port: 0 }
        ];

        const alliances = allianceDefs.map(def => {
            const meta = def.port ? rigMeta.getAllianceForPort(def.port) : {
                id: 'unassigned',
                name: 'Unassigned Relay',
                subtitle: 'Rally onto port 3333 or 3334 to pick a league badge',
                stratumPort: null
            };
            let hashrate = 0;
            let workersActive = 0;
            let blocksLifetime = 0;
            workers.forEach(worker => {
                const port = safeNumber(worker.stratumPort, 0);
                const match = def.port === 0 ? port !== 3333 && port !== 3334 : port === def.port;
                if (!match) {
                    return;
                }
                blocksLifetime += safeNumber(worker.blocks, 0);
                if (isActive(worker)) {
                    workersActive += 1;
                    hashrate += safeNumber(worker.hashrate, 0);
                }
            });
            return {
                key: def.key,
                stratumPort: meta.stratumPort,
                name: meta.name,
                subtitle: meta.subtitle,
                hashrate,
                workersActive,
                blocksLifetime
            };
        });

        return {
            season,
            factions: factionBuckets,
            alliances,
            copy: 'Factions shard by payout address hash so every wallet lands in a tribe. Alliances mirror the two stratum fronts the pool already exposes.'
        };
    }
}

module.exports = PoolStatsStore;
