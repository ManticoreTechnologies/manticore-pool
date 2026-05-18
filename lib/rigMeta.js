'use strict';

const FACTIONS = [
    { id: 'legion', name: 'Legion', tagline: 'Front-line hashrate discipline' },
    { id: 'syndicate', name: 'Syndicate', tagline: 'Asymmetric edge runners' },
    { id: 'forge', name: 'Forge', tagline: 'Thermal poets of silicon' },
    { id: 'revenant', name: 'Revenant', tagline: 'Never fully powered down' },
    { id: 'nomads', name: 'Nomads', tagline: 'Relay hoppers, signal nomads' }
];

const ALLIANCES = {
    3333: { id: 'coalition', name: 'Coalition Stratum', subtitle: 'Prime port — pooled fireteams' },
    3334: { id: 'vanguard', name: 'Vanguard Relay', subtitle: 'Alternate port — lone wolves who still share the prize' }
};

const PREFIX = [
    'Necro', 'Iron', 'Giga', 'Vault', 'Void', 'Hex', 'Rust', 'Core', 'Turbo', 'Flux',
    'Rogue', 'Crimson', 'Ghost', 'Static', 'Deep', 'Solar', 'Polar', 'Myth', 'Data', 'Ash'
];

const SUFFIX = [
    'Noncer', 'Head', 'Breaker', 'Unit', 'Prime', 'Sentinel', 'Drift', 'Fang', 'Core', 'Runner',
    'Hawk', 'Wolf', 'Smith', 'Forge', 'Node', 'Lancer', 'Stack', 'Byte', 'Grid', 'Pulse'
];

function hashString(input) {
    const s = String(input || '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function factionIndexForAddress(address) {
    return hashString(String(address || '').trim()) % FACTIONS.length;
}

function getFactionForAddress(address) {
    const idx = factionIndexForAddress(address);
    return Object.assign({ index: idx }, FACTIONS[idx]);
}

function getAllianceForPort(port) {
    const p = Number(port) || 0;
    if (ALLIANCES[p]) {
        return Object.assign({ stratumPort: p }, ALLIANCES[p]);
    }
    return {
        id: 'unknown',
        name: 'Unassigned',
        subtitle: 'Connect on 3333 or 3334 to join a league',
        stratumPort: p || null
    };
}

function rigCallsignFromWorkerName(workerName) {
    const h = hashString(workerName);
    const h2 = hashString(workerName + ':rig');
    const prefix = PREFIX[h % PREFIX.length];
    const suffix = SUFFIX[h2 % SUFFIX.length];
    const serial = String((h >>> 8) % 100).padStart(2, '0');
    return `${prefix}${suffix}-${serial}`;
}

function medianDifficulties(history) {
    if (!history || !history.length) {
        return null;
    }
    const sorted = history.map(row => Number(row.difficulty) || 0).filter(n => n > 0).sort((a, b) => a - b);
    if (!sorted.length) {
        return null;
    }
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function efficiency(valid, invalid) {
    const v = Number(valid) || 0;
    const i = Number(invalid) || 0;
    const t = v + i;
    if (t <= 0) {
        return null;
    }
    return v / t;
}

function enrichWorker(worker) {
    const w = worker || {};
    const address = w.address || '';
    const faction = getFactionForAddress(address);
    const alliance = getAllianceForPort(w.stratumPort);
    const eff = efficiency(w.valid, w.invalid);
    return Object.assign({}, w, {
        rigCallsign: rigCallsignFromWorkerName(w.workername || ''),
        faction: { id: faction.id, name: faction.name, index: faction.index },
        alliance: { id: alliance.id, name: alliance.name, stratumPort: alliance.stratumPort },
        efficiency: eff == null ? null : Number(eff.toFixed(4)),
        uptimeStreakMs: safeNumber(w.uptimeStreakMs, 0),
        survivalStreak: safeNumber(w.survivalStreak, 0),
        luckyShares: safeNumber(w.luckyShares, 0),
        jackpotNearHits: safeNumber(w.jackpotNearHits, 0)
    });
}

function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function seasonKeyFromTimestamp(ts) {
    const d = new Date(safeNumber(ts, Date.now()));
    if (Number.isNaN(d.getTime())) {
        return seasonKeyFromTimestamp(Date.now());
    }
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${d.getUTCFullYear()}-Q${q}`;
}

function currentSeasonKey() {
    return seasonKeyFromTimestamp(Date.now());
}

function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

module.exports = {
    FACTIONS,
    ALLIANCES,
    hashString,
    factionIndexForAddress,
    getFactionForAddress,
    getAllianceForPort,
    rigCallsignFromWorkerName,
    medianDifficulties,
    efficiency,
    enrichWorker,
    seasonKeyFromTimestamp,
    currentSeasonKey,
    isoWeekKey
};
