/* We are using CockroachDB cluster for the database */

// Import table definitions
const { workerShareColumns } = require('./Tables/Workers.js');
const { poolStatsColumns } = require('./Tables/PoolStats.js');
const { netHistoryColumns } = require('./Tables/NetHistory.js');
const { blocksColumns } = require('./Tables/BlockColumns.js');
const { currentRoundColumns } = require('./Tables/CurrentRound.js');

// Import the CockroachDB client
const { Client } = require('pg');

async function initializePoolDatabase(drop=false){
    // For production this should just create the database if it doesn't exist
    await setupDatabase(drop);

    // Setup the tables
    await setupTables(drop);
}

// Create a system database connection to the CockroachDB cluster
const system_db = new Client({
  host: 'us.pool.manticore.exchange',
  port: 26257,
  database: 'system', // You may want to change this
  user: 'root',
  password: '', // No password for insecure mode
  ssl: false // For insecure mode
});

// This method will drop and create the database if it doesn't exist
async function setupDatabase(drop=false) {
  return new Promise(async (resolve, reject) => {
  try {
    await system_db.connect();
    // Drop the database if it exists
    console.log('Dropping database if it exists? ', drop);
    if (drop) await system_db.query('DROP DATABASE IF EXISTS pool_manticore_exchange');

    // Create the database if it doesn't exist
    await system_db.query('CREATE DATABASE IF NOT EXISTS pool_manticore_exchange');
    resolve();
  } catch (err) {
    console.error('Error setting up database pool_manticore_exchange:', err);
    reject(err);
      }
  });
}

// This method will drop and create the tables
async function setupTables(drop=false){
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getPoolDatabase();
      // Drop and create the tables
      if (drop) {
        console.log('Dropping tables');
        await db.query('DROP TABLE IF EXISTS WorkerShare');
        await db.query('DROP TABLE IF EXISTS PoolStats');
        await db.query('DROP TABLE IF EXISTS NetHistory');
        await db.query('DROP TABLE IF EXISTS Blocks');
      }
      
  // Array of table definitions
  const tables = [
    { name: 'Workers', columns: workerShareColumns },
    { name: 'PoolStats', columns: poolStatsColumns },
    { name: 'NetHistory', columns: netHistoryColumns },
    { name: 'Blocks', columns: blocksColumns },
    { name: 'CurrentRound', columns: currentRoundColumns },
  ];

  // Create the tables
  for (const table of tables) {
    const createTableSQL = generateCreateTableSQL(table.name, table.columns);
    await db.query(createTableSQL);
      }
      resolve();
    } catch (err) {
      console.error('Error setting up tables:', err);
      reject(err);
    }
  });
}

// This method will return a new database connection to the pool_manticore_exchange database
async function getPoolDatabase(){
  return new Promise((resolve, reject) => {
    const db = new Client({
      host: 'ca.pool.manticore.exchange',
      port: 26257,
      database: 'pool_manticore_exchange',
      user: 'root',
      password: '',
      ssl: false
    });

    db.connect()
    .then(() => {
      resolve(db);
    })
    .catch(err => {
      reject(err);
    });
  });
}



// Function to generate SQL for creating a table
function generateCreateTableSQL(tableName, columns) {
  const columnsSQL = columns.map(col => `${col.name} ${col.type}`).join(', ');
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsSQL})`;
}

module.exports = { initializePoolDatabase, getPoolDatabase};