// WorkerStats Table
// Purpose: Store aggregated statistics for each worker 

// Columns:


const WorkerStatsTable = [
    { name: 'worker_name', type: 'VARCHAR(255)' },
    { name: 'worker_address', type: 'VARCHAR(255)' },
    { name: 'worker_ip', type: 'VARCHAR(45)' },
    { name: 'worker_port', type: 'INTEGER' },
    { name: 'worker_status', type: 'VARCHAR(20)' },
    { name: 'worker_last_active', type: 'TIMESTAMP' },
    { name: 'worker_hashrate', type: 'NUMERIC(20, 8)' },
    { name: 'worker_shares', type: 'BIGINT' },
    { name: 'worker_accepted', type: 'BIGINT' },
    { name: 'worker_rejected', type: 'BIGINT' },
    { name: 'worker_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'worker_last_updated', type: 'TIMESTAMP' },

];

module.exports = WorkerStatsTable;