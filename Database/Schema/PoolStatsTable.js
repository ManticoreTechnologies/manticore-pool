// Pool Stats Table
// Purpose: Store global pool statistics

// Columns:

const PoolStatsTable = [
    {name: 'timestamp', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP'},
    {name: 'total_workers', type: 'BIGINT', default: '0'},
    {name: 'total_shares', type: 'BIGINT', default: '0'},
    {name: 'total_accepted', type: 'BIGINT', default: '0'},
    {name: 'total_rejected', type: 'BIGINT', default: '0'},
    {name: 'total_difficulty', type: 'NUMERIC(20, 8)', default: '0'},
    {name: 'total_hashrate', type: 'NUMERIC(20, 8)', default: '0'},
    {name: 'total_blocks', type: 'BIGINT', default: '0'},
    {name: 'total_rewards', type: 'BIGINT', default: '0'},
    {name: 'total_workers_online', type: 'BIGINT', default: '0'},
    {name: 'total_workers_offline', type: 'BIGINT', default: '0'},
    {name: 'total_network_share', type: 'BIGINT', default: '0'},
];

module.exports = PoolStatsTable;