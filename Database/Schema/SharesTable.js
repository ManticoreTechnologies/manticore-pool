// Shares Table
// Purpose: Record all share submissions for each worker

// Columns:
// worker_name (VARCHAR(255)) - This is the name of the worker that submitted the share (e.g. ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker)
// share_difficulty (NUMERIC(20, 8)) - This is the difficulty of the share submitted (e.g. 0.00341393)
// target_difficulty (NUMERIC(20, 8)) - This is the difficulty of the target block (e.g. 0.003)
// block_difficulty (NUMERIC(20, 8)) - This is the difficulty of the block that the share was submitted for (e.g. 0.003891051)
// block_difficulty_actual (NUMERIC(20, 8)) - This is the actual difficulty of the block that the share was submitted for (e.g. 0.003891051)
// block_hash (VARCHAR(255)) - This is the hash of the block that the share was submitted for (e.g. 00000124e9b2c56d1dffc115d002d8adfc2c4d8a857993c2e421fe9d73b5f7a8)
// block_hash_invalid (BOOLEAN) - Whether the block hash is invalid
// timestamp (TIMESTAMP) - The timestamp of the share submission
// accepted (BOOLEAN) - Whether the share was accepted

/*
{ job: '000000000000000000000000000000000000000000000000000000000000ccd0',
  ip: '::ffff:127.0.0.1',
  port: 3334,
  worker: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
  height: 1274,
  blockReward: 277800000000,
  difficulty: 0.003,
  shareDiff: '0.00389407',
  submitTime: 1735448659039,
  blockDiff: 0.003891051,
  blockDiffActual: 0.003891051,
  blockHash: '00000100cbef7b38f49df9f29d020329394bbcd19809d0afbde971ed624829a7',
  blockHashInvalid: undefined,
  error: { unknown: 'check coin daemon logs' } } 
*/

/*
                worker_name: shareData.worker,
                worker_ip: shareData.ip,
                worker_port: shareData.port,
                share_job: shareData.job,
                share_difficulty: shareData.shareDiff,
                share_valid: isValidShare,
                share_block_valid: isValidBlock,
                target_difficulty: shareData.difficulty,
                block_difficulty: shareData.blockDiff,
                block_difficulty_actual: shareData.blockDiffActual,
                block_hash: shareData.blockHash,
                block_hash_invalid: shareData.blockHashInvalid,
                block_reward: shareData.blockReward,
                block_height: shareData.height,
                timestamp: shareData.submitTime,
                error: shareData.error
*/

const SharesTable = [
    { name: 'worker_name', type: 'VARCHAR(255)' },
    { name: 'worker_address', type: 'VARCHAR(255)' },
    { name: 'worker_ip', type: 'VARCHAR(45)' },
    { name: 'worker_port', type: 'INTEGER' },
    { name: 'share_job', type: 'VARCHAR(255)' },
    { name: 'share_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'share_hashrate', type: 'NUMERIC(20, 8)' },
    { name: 'share_valid', type: 'BOOLEAN' },
    { name: 'share_block_valid', type: 'BOOLEAN' },
    { name: 'target_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'block_difficulty', type: 'NUMERIC(20, 8)' },
    { name: 'block_difficulty_actual', type: 'NUMERIC(20, 8)' },
    { name: 'block_hash', type: 'VARCHAR(255)' },
    { name: 'block_hash_invalid', type: 'BOOLEAN' },
    { name: 'block_reward', type: 'BIGINT' },
    { name: 'block_height', type: 'INTEGER' },
    { name: 'timestamp', type: 'BIGINT' },
];

module.exports = SharesTable;