const fs = require('fs');
const path = require('path');

const EMPTY_STATE = {
    startedAt: null,
    updatedAt: null,
    workers: {},
    addresses: {},
    hashWars: null,
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

const HASH_WARS_STANCES = [
    { id: 'assault', name: 'Assault', weight: 'attack' },
    { id: 'defend', name: 'Defend', weight: 'shield' },
    { id: 'recon', name: 'Recon', weight: 'energy' }
];

const HASH_WARS_EVENTS = [
    { id: 'difficulty-beast', name: 'Boss Battle: Difficulty Beast', description: 'Every valid share charges the pool cannon. Blocks found trigger faction shockwaves.' },
    { id: 'entropy-storm', name: 'Entropy Storm', description: 'The sector map destabilizes while uptime and share quality harden faction defenses.' },
    { id: 'void-caravan', name: 'Void Caravan Raid', description: 'Recon units expose routes while assault units push territory through raw entropy.' },
    { id: 'titan-gate', name: 'Titan Gate Siege', description: 'Large rentals and veteran rigs punch open new fronts across the map.' }
];

const HASH_WARS_FACILITIES = [
    { type: 'power-plant', name: 'Power Plant', bonus: '+Energy output' },
    { type: 'relay', name: 'Relay Tower', bonus: '+Recon pressure' },
    { type: 'foundry', name: 'Foundry', bonus: '+Assault output' },
    { type: 'shield-array', name: 'Shield Array', bonus: '+Defense' },
    { type: 'data-vault', name: 'Data Vault', bonus: '+XP gain' }
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

function seededRandom(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function() {
        value = value * 16807 % 2147483647;
        return (value - 1) / 2147483646;
    };
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
            this.state.hashWars = parsed.hashWars || null;
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
            territory: HASH_WARS_TERRITORIES[Math.abs(hashString(workerName)) % HASH_WARS_TERRITORIES.length],
            stance: 'assault',
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
        if (Object.prototype.hasOwnProperty.call(identity, 'territory')) {
            const territory = HASH_WARS_TERRITORIES.find(item => item === identity.territory);
            if (territory) {
                worker.territory = territory;
            }
        }
        if (Object.prototype.hasOwnProperty.call(identity, 'stance')) {
            const stance = HASH_WARS_STANCES.find(item => item.id === identity.stance);
            if (stance) {
                worker.stance = stance.id;
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

    ensureHashWarsWorld() {
        if (!this.state.hashWars) {
            const mapSeed = Math.abs(hashString(`${Date.now()}-${this.state.startedAt || ''}`));
            this.state.hashWars = {
                season: {
                    name: 'Season 0: Genesis Skirmish',
                    startedAt: Date.now(),
                    tick: 0
                },
                lastTickAt: 0,
                eventStartValidShares: safeNumber(this.state.pool.validShares, 0),
                eventTarget: 1000,
                eventIndex: 0,
                mapSeed,
                map: this.generateHashWarsMap(mapSeed),
                territories: HASH_WARS_TERRITORIES.map((name, index) => {
                    const owner = HASH_WARS_FACTIONS[index % HASH_WARS_FACTIONS.length];
                    const control = {};
                    HASH_WARS_FACTIONS.forEach(faction => {
                        control[faction.id] = faction.id === owner.id ? 55 : 10;
                    });
                    return {
                        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        name,
                        owner: owner.id,
                        control,
                        buff: index % 3 === 0 ? '+1% XP' : index % 3 === 1 ? '+1% shield' : '+1% energy'
                    };
                }),
                battleLog: []
            };
        }
        if (!this.state.hashWars.map || !this.state.hashWars.map.sectors || !this.state.hashWars.map.facilities || !this.state.hashWars.map.forests) {
            this.state.hashWars.mapSeed = this.state.hashWars.mapSeed || Math.abs(hashString(`${Date.now()}-${this.state.startedAt || ''}`));
            this.state.hashWars.map = this.generateHashWarsMap(this.state.hashWars.mapSeed);
        }
        return this.state.hashWars;
    }

    generateHashWarsMap(seed) {
        const random = seededRandom(seed || 1);
        const sectors = HASH_WARS_TERRITORIES.map((name, index) => {
            const ring = index % 3;
            const angle = ((Math.PI * 2) / HASH_WARS_TERRITORIES.length) * index + random() * 0.45;
            const radius = 24 + ring * 16 + random() * 10;
            const x = clamp(Math.round(50 + Math.cos(angle) * radius + (random() - 0.5) * 10), 8, 92);
            const y = clamp(Math.round(50 + Math.sin(angle) * radius + (random() - 0.5) * 14), 10, 90);
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
                x,
                y,
                size: Math.round(10 + random() * 18),
                anomaly: ['stable', 'volatile', 'rich', 'dark'][Math.floor(random() * 4)]
            };
        });

        const facilities = [];
        const forests = [];
        const links = [];
        sectors.forEach((sector, index) => {
            const distances = sectors
                .filter(other => other.id !== sector.id)
                .map(other => ({
                    id: other.id,
                    distance: Math.hypot(sector.x - other.x, sector.y - other.y)
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, index % 2 === 0 ? 3 : 2);
            distances.forEach(other => {
                const key = [sector.id, other.id].sort().join(':');
                if (!links.some(link => link.key === key)) {
                    links.push({ key, from: sector.id, to: other.id });
                }
            });

            const facilityType = HASH_WARS_FACILITIES[index % HASH_WARS_FACILITIES.length];
            facilities.push({
                id: `${sector.id}-${facilityType.type}`,
                sectorId: sector.id,
                type: facilityType.type,
                name: facilityType.name,
                bonus: facilityType.bonus,
                x: clamp(Math.round(sector.x + (random() - 0.5) * 10), 5, 95),
                y: clamp(Math.round(sector.y + (random() - 0.5) * 10), 8, 92)
            });
        });

        for (let i = 0; i < 34; i++) {
            forests.push({
                id: `forest-${i}`,
                x: clamp(Math.round(random() * 96 + 2), 2, 98),
                y: clamp(Math.round(random() * 88 + 6), 6, 94),
                size: Math.round(6 + random() * 12),
                density: Math.round(2 + random() * 5)
            });
        }

        return { seed, sectors, links, facilities, forests };
    }

    getUnitStats(worker, now) {
        const valid = safeNumber(worker.valid, 0);
        const invalid = safeNumber(worker.invalid, 0);
        const total = valid + invalid;
        const efficiency = total > 0 ? valid / total : 0;
        const hashrate = safeNumber(worker.hashrate, 0);
        const blocks = safeNumber(worker.blocks, 0);
        const activeCutoff = now - 5 * 60 * 1000;
        const active = safeNumber(worker.lastsharetime, 0) >= activeCutoff;
        const uptimeMinutes = active ? Math.floor((now - safeNumber(worker.firstseen, now)) / 60000) : 0;
        const survivalStreak = Math.max(valid - invalid, 0);
        const energy = Math.floor((hashrate / 1000000) + (valid * 10) + (blocks * 10000));
        const attack = Math.floor((hashrate / 1000000) + (valid * 2) + (blocks * 500));
        const shield = Math.floor((efficiency * 100) + Math.min(uptimeMinutes, 1440) + (survivalStreak / 10));
        const variance = total > 0 ? invalid / total : 0;
        const luck = Math.floor((blocks * 100) + (variance * 50) + (valid % 17));
        const xp = Math.floor(valid + (blocks * 1000) + Math.min(uptimeMinutes, 10000));
        return {
            active,
            hashrate,
            valid,
            invalid,
            blocks,
            efficiency,
            uptimeMinutes,
            survivalStreak,
            energy,
            attack,
            shield,
            luck,
            xp,
            level: Math.max(1, Math.floor(Math.log2(xp + 1))),
            archetype: efficiency > 0.96 && uptimeMinutes > 120 ? 'Tank' : variance > 0.1 ? 'Glass Cannon' : blocks > 0 ? 'Legendary' : 'Line Unit'
        };
    }

    tickHashWarsWorld(units, now) {
        const world = this.ensureHashWarsWorld();
        const tickInterval = 60 * 60 * 1000;
        if (world.lastTickAt && now - world.lastTickAt < tickInterval) {
            return world;
        }

        const previousOwners = {};
        world.territories.forEach(territory => {
            previousOwners[territory.id] = territory.owner;
            const scores = {};
            HASH_WARS_FACTIONS.forEach(faction => { scores[faction.id] = 0; });
            units
                .filter(unit => unit.territory === territory.name)
                .forEach(unit => {
                    const stance = HASH_WARS_STANCES.find(item => item.id === unit.stance) || HASH_WARS_STANCES[0];
                    scores[unit.faction] += unit[stance.weight] + (unit.energy * 0.2) + (unit.luck * 2);
                });

            const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
            if (totalScore > 0) {
                HASH_WARS_FACTIONS.forEach(faction => {
                    const gain = (scores[faction.id] / totalScore) * 14;
                    const decay = faction.id === territory.owner ? 1.5 : 3.5;
                    territory.control[faction.id] = clamp(safeNumber(territory.control[faction.id], 0) + gain - decay, 0, 100);
                });
            }

            const leader = HASH_WARS_FACTIONS
                .map(faction => ({ id: faction.id, value: safeNumber(territory.control[faction.id], 0) }))
                .sort((a, b) => b.value - a.value)[0];
            if (leader && leader.value >= 35) {
                territory.owner = leader.id;
            }
            territory.status = leader && leader.value < 50 ? 'contested' : 'controlled';

            if (previousOwners[territory.id] !== territory.owner) {
                const owner = HASH_WARS_FACTIONS.find(faction => faction.id === territory.owner);
                world.battleLog.unshift({
                    timestamp: now,
                    type: 'territory_flip',
                    message: `${owner ? owner.name : territory.owner} seized ${territory.name}`
                });
            }
        });

        const validSinceStart = safeNumber(this.state.pool.validShares, 0) - safeNumber(world.eventStartValidShares, 0);
        if (validSinceStart >= world.eventTarget) {
            const topFaction = units.reduce((best, unit) => {
                const score = unit.attack + unit.shield + unit.energy;
                return !best || score > best.score ? { faction: unit.faction, score } : best;
            }, null);
            const faction = HASH_WARS_FACTIONS.find(item => item.id === (topFaction && topFaction.faction));
            world.battleLog.unshift({
                timestamp: now,
                type: 'boss_defeated',
                message: `${faction ? faction.name : 'The pool'} breached the Difficulty Beast`
            });
            world.eventStartValidShares = safeNumber(this.state.pool.validShares, 0);
            world.eventTarget = Math.ceil(world.eventTarget * 1.2);
            world.eventIndex = (safeNumber(world.eventIndex, 0) + 1) % HASH_WARS_EVENTS.length;
            world.mapSeed = Math.abs(hashString(`${world.mapSeed}:${world.eventIndex}:${now}`));
            world.map = this.generateHashWarsMap(world.mapSeed);
            world.battleLog.unshift({
                timestamp: now,
                type: 'map_shift',
                message: `Sector lattice re-randomized for ${HASH_WARS_EVENTS[world.eventIndex].name}`
            });
        }

        world.battleLog = world.battleLog.slice(0, 50);
        world.lastTickAt = now;
        world.season.tick += 1;
        this.save();
        return world;
    }

    getHashWarsState() {
        const now = Date.now();
        const workers = this.getWorkers();
        const world = this.ensureHashWarsWorld();
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
            const stats = this.getUnitStats(worker, now);
            const factionId = factionById[worker.faction] ? worker.faction : HASH_WARS_FACTIONS[Math.abs(hashString(worker.address || worker.workername)) % HASH_WARS_FACTIONS.length].id;
            const unit = {
                workername: worker.workername,
                callsign: worker.callsign || String(worker.workername || '').split('.').slice(1).join('.') || 'Unnamed Rig',
                address: worker.address,
                faction: factionId,
                factionName: factionById[factionId].name,
                territory: worker.territory || world.territories[Math.abs(hashString(worker.workername)) % world.territories.length].name,
                stance: worker.stance || 'assault',
                className: this.getRigClass(stats.hashrate),
                active: stats.active,
                hashrate: stats.hashrate,
                valid: stats.valid,
                invalid: stats.invalid,
                blocks: stats.blocks,
                efficiency: stats.efficiency,
                uptimeMinutes: stats.uptimeMinutes,
                survivalStreak: stats.survivalStreak,
                luckyShares: stats.blocks,
                nearHits: 0,
                energy: stats.energy,
                attack: stats.attack,
                shield: stats.shield,
                luck: stats.luck,
                xp: stats.xp,
                level: stats.level,
                archetype: stats.archetype
            };
            const faction = factionById[factionId];
            faction.hashrate += stats.hashrate;
            faction.valid += stats.valid;
            faction.invalid += stats.invalid;
            faction.blocks += stats.blocks;
            faction.uptimeScore += stats.uptimeMinutes;
            faction.energy += stats.energy;
            faction.attack += stats.attack;
            faction.shield += stats.shield;
            if (stats.active) faction.activeUnits += 1;
            faction.units.push(unit);
            return unit;
        });

        this.tickHashWarsWorld(units, now);

        const maxInfluence = Math.max(...factions.map(faction => faction.hashrate + faction.energy + faction.shield), 1);
        factions.forEach(faction => {
            faction.efficiency = (faction.valid + faction.invalid) > 0 ? faction.valid / (faction.valid + faction.invalid) : 0;
            faction.influence = Math.round(((faction.hashrate + faction.energy + faction.shield) / maxInfluence) * 100);
            faction.units = faction.units
                .sort((a, b) => (b.attack + b.shield) - (a.attack + a.shield))
                .slice(0, 8);
        });

        const sortedFactions = factions.slice().sort((a, b) => b.influence - a.influence);
        const territories = world.territories.map(territory => {
            const owner = HASH_WARS_FACTIONS.find(faction => faction.id === territory.owner) || factions[0];
            const control = safeNumber(territory.control[owner.id], 0);
            const sector = (world.map.sectors || []).find(item => item.id === territory.id) || {};
            return {
                id: territory.id,
                name: territory.name,
                owner: owner.id,
                ownerName: owner.name,
                ownerColor: owner.color,
                control: Math.round(control),
                status: territory.status,
                buff: territory.buff,
                x: sector.x || 50,
                y: sector.y || 50,
                size: sector.size || 14,
                anomaly: sector.anomaly || 'stable'
            };
        });

        const bossTarget = safeNumber(world.eventTarget, 1000);
        const validSinceStart = safeNumber(this.state.pool.validShares, 0) - safeNumber(world.eventStartValidShares, 0);
        const bossProgress = clamp(Math.round((validSinceStart / bossTarget) * 100), 0, 100);
        const event = HASH_WARS_EVENTS[safeNumber(world.eventIndex, 0) % HASH_WARS_EVENTS.length];
        const topUnits = units
            .slice()
            .sort((a, b) => (b.attack + b.shield + b.energy) - (a.attack + a.shield + a.energy))
            .slice(0, 12);

        const mapUnits = topUnits.map((unit, index) => {
            const territory = territories.find(item => item.name === unit.territory) || territories[Math.abs(hashString(unit.workername)) % territories.length] || { x: 50, y: 50 };
            const angle = ((Math.PI * 2) / Math.max(topUnits.length, 1)) * index;
            const radius = 4 + (index % 4) * 2;
            return Object.assign({}, unit, {
                x: clamp(Math.round(territory.x + Math.cos(angle) * radius), 4, 96),
                y: clamp(Math.round(territory.y + Math.sin(angle) * radius), 6, 94)
            });
        });

        const facilities = (world.map.facilities || []).map(facility => {
            const territory = territories.find(item => item.id === facility.sectorId);
            return Object.assign({}, facility, {
                owner: territory ? territory.owner : 'neutral',
                ownerName: territory ? territory.ownerName : 'Neutral',
                ownerColor: territory ? territory.ownerColor : '#ff9d2e'
            });
        });

        return {
            season: {
                name: world.season.name,
                startedAt: world.season.startedAt,
                tick: world.season.tick
            },
            event: {
                id: event.id,
                name: event.name,
                description: event.description,
                target: bossTarget,
                progress: bossProgress,
                remaining: Math.max(bossTarget - validSinceStart, 0)
            },
            map: {
                seed: world.mapSeed,
                facilities,
                forests: world.map.forests || [],
                links: (world.map.links || []).map(link => {
                    const from = territories.find(territory => territory.id === link.from);
                    const to = territories.find(territory => territory.id === link.to);
                    return { from: link.from, to: link.to, x1: from && from.x, y1: from && from.y, x2: to && to.x, y2: to && to.y };
                })
            },
            constants: {
                factions: HASH_WARS_FACTIONS,
                territories: HASH_WARS_TERRITORIES,
                stances: HASH_WARS_STANCES
            },
            factions: sortedFactions,
            territories,
            units: topUnits,
            mapUnits,
            battleLog: world.battleLog,
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
