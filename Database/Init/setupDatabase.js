// Import the CockroachDB module
const { jacobi } = require('bignum');
const CockroachDB = require('../CockroachDB/cockroachdb.js');

const { table_schemas, tableCreationOrder } = require('../Schema/index.js');

async function setupDatabase(name, verbose = false, purge = false){
    return new Promise(async (resolve, reject) => {
        // Ensure the database name is lowercase, cockroachdb is case sensitive and always lowercase 
        name = name.toLowerCase();
        
        // Create a new cockroachdb instance
        const cockroachdb = new CockroachDB(verbose);
        await cockroachdb.connect();

        // Purge all NON SYSTEM databases
        
        if (purge) await cockroachdb.purgeDatabases();
        // Check if the database already exists
        const databases = await cockroachdb.databases();
        if (databases.includes(name)) {

            // Check if the tables already exist
            const tables = await cockroachdb.database(name).listTables();

            // if we have all the tables already return the database
            const allTablesExist = tableCreationOrder.every(table => tables.includes(table.toLowerCase()));

            // If all the tables already exist, return the database
            if (allTablesExist) return resolve(cockroachdb);
        }

        // Create a new database for our pool
        await cockroachdb.database(name).create().execute();

        // Create the tables in the correct order
        for (const table_name of tableCreationOrder) {
            if (table_schemas[table_name]) {
                await cockroachdb.database(name).create().table(table_name).columns(table_schemas[table_name]).execute();
            }
        }
        
        // Create the evrpool poolstats column 
        await cockroachdb.database(name).table('poolstats').insert({name: name, last_updated: new Date().toISOString()}).execute();
            
        // Return the cockroachdb instance
        resolve(cockroachdb);
    });
}

module.exports = {
    setupDatabase
};