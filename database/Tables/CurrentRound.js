const currentRoundColumns = [
    { name: 'round_id', type: 'SERIAL PRIMARY KEY' },
    { name: 'block_height', type: 'INT NOT NULL' },
    { name: 'block_hash', type: 'VARCHAR(64)' },
    { name: 'total_shares', type: 'NUMERIC(20, 8) DEFAULT 0' },
    { name: 'network_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'start_time', type: 'TIMESTAMP DEFAULT NOW()' },
    { name: 'end_time', type: 'TIMESTAMP' },
    { name: 'status', type: 'VARCHAR(20) DEFAULT \'active\'' }, // active, completed, orphaned
];

module.exports = {
    currentRoundColumns
};
