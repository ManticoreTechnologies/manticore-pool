// Workers Table
// Purpose: Track individual workers associated with each address

// Columns:
// worker_name (Primary Key) - Unique identifier for each worker

const WorkersTable = [
    { name: 'worker_name', type: 'VARCHAR(255) PRIMARY KEY' },
    { name: 'worker_address', type: 'VARCHAR(255)' },
    { name: 'worker_ip', type: 'VARCHAR(45)' },
    { name: 'worker_port', type: 'INTEGER' },
    { name: 'worker_password', type: 'VARCHAR(255)' },
    { name: 'worker_status', type: 'VARCHAR(20)' },
    { name: 'worker_last_active', type: 'TIMESTAMP' },
    { name: 'worker_difficulty', type: 'NUMERIC(20, 8)' }
];

module.exports = WorkersTable;