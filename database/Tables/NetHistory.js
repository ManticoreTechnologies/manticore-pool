const netHistoryColumns = [
    { name: 'id', type: 'SERIAL PRIMARY KEY' },
    { name: 'netHashrate', type: 'INT DEFAULT 0' },
    { name: 'netDifficulty', type: 'INT DEFAULT 0' },
    { name: 'netAsset', type: 'INT DEFAULT 0' },
    { name: 'netBlockSize', type: 'INT DEFAULT 0' },
];

module.exports = {
    netHistoryColumns
};