// AddressStats Table
// Purpose: Store aggregated statistics for each address

// Columns:


const AddressStatsTable = [
    { name: 'address', type: 'VARCHAR(255)' },
    { name: 'timestamp', type: 'TIMESTAMP' },
    { name: 'hashrate', type: 'NUMERIC(20, 8)' },
    { name: 'share_count', type: 'INTEGER' },
    { name: 'balance', type: 'NUMERIC(20, 8)' }
];

module.exports = AddressStatsTable;