const fs = require('fs');
const path = require('path');

const EMPTY_STATE = {
    startedAt: null,
    updatedAt: null,
    workers: {},
    addresses: {},
    shares: [],
    blocks: [],
    payouts: [],
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

const HASH_WARS_FACTIONS = [
    { id: 'forge', name: 'Forge', motto: 'Heat, pressure, output.', color: '#ff9d2e' },
    { id: 'revenants', name: 'Revenants', motto: 'Back from stale work, hunting blocks.', color: '#b36bff' },
    { id: 'iron-legion', name: 'Iron Legion', motto: 'Uptime is armor.', color: '#d7dde8' },
    { id: 'null-syndicate', name: 'Null Syndicate', motto: 'Silence, stealth, valid shares.', color: '#6cc7d8' },
    { id: 'ghost-grid', name: 'Ghost Grid', motto: 'Distributed, persistent, unseen.', color: '#78f5a5' }
];

const HASH_WARS_TERRITORIES = [
    'Manticore Prime',
    'Evrmore Gate',
    'Sentinel Belt',
    'PeerWeave Drift',
    'Glyph Arena',
    'Vault Nebula',
    'Null Expanse',
    'Forge Moon',
    'Revenant Reach'
];

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

function hashString(value) {
    return String(value || '').split('').reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }, 0);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
        const address = this.workerAddress(workerName);
        const callsign = String(workerName || '').split('.').slice(1).join('.') || 'Unnamed Rig';
        const faction = HASH_WARS_FACTIONS[Math.abs(hashString(address || workerName)) % HASH_WARS_FACTIONS.length].id;
        return {
            workername: workerName,
            address,
            callsign,
            faction,
            cosmetic: 'standard',
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

    setWorkerIdentity(workerName, identity) {
        const worker = this.ensureWorker(workerName);
        if (Object.prototype.hasOwnProperty.call(identity, 'callsign')) {
            const callsign = String(identity.callsign || '').trim().slice(0, 48);
            if (callsign) {
                worker.callsign = callsign;
            }
        }
        if (Object.prototype.hasOwnProperty.call(identity, 'faction')) {
            const faction = HASH_WARS_FACTIONS.find(item => item.id === identity.faction);
            if (faction) {
                worker.faction = faction.id;
            }
        }
        worker.identityUpdatedAt = Date.now();
        this.save();
        return worker;
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

    getRigClass(hashrate) {
        const rate = safeNumber(hashrate, 0);
        if (rate >= 1000000000) return 'Titan';
        if (rate >= 250000000) return 'Dreadnought';
        if (rate >= 50000000) return 'Gladiator';
        if (rate >= 5000000) return 'Striker';
        return 'Scout';
    }

    getHashWarsState() {
        const now = Date.now();
        const activeCutoff = now - 5 * 60 * 1000;
        const workers = this.getWorkers();
        const factions = HASH_WARS_FACTIONS.map(faction => {
            return Object.assign({}, faction, {
                hashrate: 0,
                valid: 0,
                invalid: 0,
                blocks: 0,
                uptimeScore: 0,
                energy: 0,
                attack: 0,
                shield: 0,
                influence: 0,
                activeUnits: 0,
                units: []
            });
        });
        const factionById = factions.reduce((map, faction) => {
            map[faction.id] = faction;
            return map;
        }, {});

        const units = workers.map(worker => {
            const valid = safeNumber(worker.valid, 0);
            const invalid = safeNumber(worker.invalid, 0);
            const total = valid + invalid;
            const efficiency = total > 0 ? valid / total : 0;
            const hashrate = safeNumber(worker.hashrate, 0);
            const blocks = safeNumber(worker.blocks, 0);
            const active = safeNumber(worker.lastsharetime, 0) >= activeCutoff;
            const uptimeMinutes = active ? Math.floor((now - safeNumber(worker.firstseen, now)) / 60000) : 0;
            const survivalStreak = Math.max(valid - invalid, 0);
            const energy = (valid * 10) + (blocks * 10000);
            const attack = Math.floor((hashrate / 1000000) + (valid * 2) + (blocks * 500));
            const shield = Math.floor((efficiency * 100) + Math.min(uptimeMinutes, 1440) + (survivalStreak / 10));
            const factionId = factionById[worker.faction] ? worker.faction : HASH_WARS_FACTIONS[Math.abs(hashString(worker.address || worker.workername)) % HASH_WARS_FACTIONS.length].id;
            const unit = {
                workername: worker.workername,
                callsign: worker.callsign || String(worker.workername || '').split('.').slice(1).join('.') || 'Unnamed Rig',
                address: worker.address,
                faction: factionId,
                className: this.getRigClass(hashrate),
                active,
                hashrate,
                valid,
                invalid,
                blocks,
                efficiency,
                uptimeMinutes,
                survivalStreak,
                luckyShares: blocks,
                nearHits: 0,
                energy,
                attack,
                shield
            };
            const faction = factionById[factionId];
            faction.hashrate += hashrate;
            faction.valid += valid;
            faction.invalid += invalid;
            faction.blocks += blocks;
            faction.uptimeScore += uptimeMinutes;
            faction.energy += energy;
            faction.attack += attack;
            faction.shield += shield;
            if (active) faction.activeUnits += 1;
            faction.units.push(unit);
            return unit;
        });

        const maxInfluence = Math.max(...factions.map(faction => faction.hashrate + faction.energy + faction.shield), 1);
        factions.forEach(faction => {
            faction.efficiency = (faction.valid + faction.invalid) > 0 ? faction.valid / (faction.valid + faction.invalid) : 0;
            faction.influence = Math.round(((faction.hashrate + faction.energy + faction.shield) / maxInfluence) * 100);
            faction.units = faction.units
                .sort((a, b) => (b.attack + b.shield) - (a.attack + a.shield))
                .slice(0, 8);
        });

        const sortedFactions = factions.slice().sort((a, b) => b.influence - a.influence);
        const territories = HASH_WARS_TERRITORIES.map((name, index) => {
            const owner = sortedFactions[index % sortedFactions.length] || factions[0];
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
                owner: owner.id,
                ownerName: owner.name,
                control: clamp(owner.influence - (index * 3), 8, 100),
                status: index % 3 === 0 ? 'contested' : 'controlled'
            };
        });

        const bossTarget = Math.max(1000, Math.ceil((this.state.pool.validShares + 1000) / 1000) * 1000);
        const bossProgress = clamp(Math.round((this.state.pool.validShares / bossTarget) * 100), 0, 100);
        const topUnits = units
            .slice()
            .sort((a, b) => (b.attack + b.shield + b.energy) - (a.attack + a.shield + a.energy))
            .slice(0, 12);

        return {
            season: {
                name: 'Season 0: Genesis Skirmish',
                startedAt: this.state.startedAt,
                tick: Math.floor(now / 3600000)
            },
            event: {
                name: 'Boss Battle: Difficulty Beast',
                description: 'Every valid share charges the pool cannon. Blocks found trigger faction shockwaves.',
                target: bossTarget,
                progress: bossProgress,
                remaining: Math.max(bossTarget - this.state.pool.validShares, 0)
            },
            factions: sortedFactions,
            territories,
            units: topUnits,
            totals: {
                units: workers.length,
                activeUnits: units.filter(unit => unit.active).length,
                hashrate: units.reduce((sum, unit) => sum + unit.hashrate, 0),
                energy: units.reduce((sum, unit) => sum + unit.energy, 0),
                blocks: units.reduce((sum, unit) => sum + unit.blocks, 0)
            }
        };
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
