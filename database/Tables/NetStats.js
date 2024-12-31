const netStatsColumns = [
    { name: 'timestamp', type: 'TIMESTAMP PRIMARY KEY DEFAULT CURRENT_TIMESTAMP' },
    { name: 'height', type: 'INT DEFAULT 0' },
    { name: 'hashrate', type: 'FLOAT DEFAULT 0' },
    { name: 'difficulty', type: 'FLOAT DEFAULT 0' },
    { name: 'assetsCount', type: 'INT DEFAULT 0' },
    { name: 'mempoolCount', type: 'INT DEFAULT 0' },
    { name: 'mempoolSize', type: 'FLOAT DEFAULT 0' },
    { name: 'blockReward', type: 'FLOAT DEFAULT 0' },
    

];

module.exports = {
    netStatsColumns
};