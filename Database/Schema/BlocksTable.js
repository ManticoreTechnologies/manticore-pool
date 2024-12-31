// Blocks Table
// Purpose: Track blocks mined by the pool

const { getFees } = require("../../lib/transactions");

// Columns:


const BlocksTable = [
    { name: 'hash', type: 'VARCHAR(64) UNIQUE' },
    { name: 'worker_name', type: 'VARCHAR(255)' },
    { name: 'submit_time', type: 'BIGINT' },
    { name: 'height', type: 'INTEGER' },
    { name: 'reward', type: 'NUMERIC(20, 8)' },
    { name: 'confirmed', type: 'BOOLEAN' },
    { name: 'confirmations', type: 'INTEGER' },
    { name: 'difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'share_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'share_difficulty_actual', type: 'NUMERIC(20, 8)' },
    { name: 'block_hash_invalid', type: 'BOOLEAN' },
    { name: 'block_reward', type: 'BIGINT' },
    { name: 'block_height', type: 'INTEGER' },
];

module.exports = BlocksTable;