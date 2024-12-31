// Addresses Table
// Purpose: Track each unique mining address

// Columns:
// address (VARCHAR(255)) - The mining address
// created_at (TIMESTAMP) - The date and time the address was created
// last_active (TIMESTAMP) - The date and time the address was last active

const AddressesTable = [
    { name: 'address', type: 'VARCHAR(255)' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'last_active', type: 'TIMESTAMP' }
];

module.exports = AddressesTable;