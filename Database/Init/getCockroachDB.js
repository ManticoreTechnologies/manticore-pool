// Import the setupDatabase function
const { setupDatabase } = require('./setupDatabase.js');

// Static database instance
const cockroachdb = null;

async function getCockroachDB(verbose = false, purge = false){
    return new Promise(async (resolve, reject) => {
        // If the database is already initialized, return it
        if (cockroachdb) return resolve(cockroachdb);

        // Create a new cockroachdb instance
        cockroachdb = await setupDatabase(verbose, purge);

        // Return the cockroachdb instance
        resolve(cockroachdb);
    });
}

module.exports = {
    getCockroachDB
};