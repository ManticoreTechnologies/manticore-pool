const poolStatsColumns = [
    { name: 'id', type: 'SERIAL PRIMARY KEY' },
    { name: 'poolName', type: 'TEXT UNIQUE NOT NULL' },
    { name: 'poolHashrate', type: 'INT DEFAULT 0' },
    { name: 'poolDifficulty', type: 'INT DEFAULT 0' },
    { name: 'poolAsset', type: 'INT DEFAULT 0' },
    { name: 'poolBlockSize', type: 'INT DEFAULT 0' },
];

module.exports = {
    poolStatsColumns
};