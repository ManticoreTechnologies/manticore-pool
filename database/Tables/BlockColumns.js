const blocksColumns = [
    { name: 'block_id', type: 'SERIAL PRIMARY KEY' },
    { name: 'round_id', type: 'INT NOT NULL' },
    { name: 'block_hash', type: 'VARCHAR(64) UNIQUE' },
    { name: 'block_height', type: 'INT NOT NULL' },
    { name: 'confirmations', type: 'INT DEFAULT 0' },
    { name: 'reward', type: 'NUMERIC(20, 8)' },
    { name: 'transaction_id', type: 'VARCHAR(64)' },
    { name: 'miner', type: 'VARCHAR(64)' },
    { name: 'difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending\'' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
    { name: 'confirmed_at', type: 'TIMESTAMP' },
    { name: 'paid_at', type: 'TIMESTAMP' },
    { name: 'paid_txid', type: 'VARCHAR(64)' }
];

module.exports = {
    blocksColumns
};