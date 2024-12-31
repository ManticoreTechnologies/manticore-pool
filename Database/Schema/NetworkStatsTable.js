// Network Stats Table
// Purpose: Store global network statistics

// Columns:

const NetworkStatsTable = [
    {name: 'timestamp', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP'},
    {name: 'height', type: 'BIGINT', default: '0'},
    {name: 'hashrate', type: 'NUMERIC(20, 8)', default: '0'},
    {name: 'difficulty', type: 'NUMERIC(20, 8)', default: '0'},
    {name: 'assets_count', type: 'BIGINT', default: '0'},
    {name: 'mempool_count', type: 'BIGINT', default: '0'},
    {name: 'mempool_size', type: 'BIGINT', default: '0'},
    {name: 'block_reward', type: 'BIGINT', default: '0'},
];

module.exports = NetworkStatsTable;