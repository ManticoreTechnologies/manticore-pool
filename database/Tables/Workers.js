
// Define columns for the WorkerShare table
const workerShareColumns = [
    { name: 'id', type: 'SERIAL PRIMARY KEY' },
    { name: 'workerName', type: 'TEXT UNIQUE NOT NULL' },
    { name: 'valid', type: 'INT DEFAULT 0' },
    { name: 'invalid', type: 'INT DEFAULT 0' },
    { name: 'blocks', type: 'INT DEFAULT 0' },
    { name: 'hashrate', type: 'INT DEFAULT 0' },
    { name: 'roundShares', type: 'INT DEFAULT 0' },
    { name: 'totalShares', type: 'INT DEFAULT 0' },
    { name: 'lastShareTime', type: 'INT DEFAULT 0' },
    { name: 'paid', type: 'INT DEFAULT 0' },
    { name: 'unpaid', type: 'INT DEFAULT 0' },
    { name: 'password', type: 'TEXT DEFAULT NULL' },
    { name: 'payoutThreshold', type: 'INT DEFAULT 0' }
  ];

  module.exports = {
    workerShareColumns
  };
