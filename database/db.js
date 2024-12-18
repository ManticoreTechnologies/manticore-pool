//cockroach start-single-node --insecure --listen-addr=localhost:26257 --background
//cockroach sql --insecure
const { Client } = require('pg');
const path = require('path');


// Import the worker class from the workers.js file
const Worker = require('./workers.js');

// Initialize database connection
const db = new Client({
  host: 'localhost',
  port: 26257,
  database: 'defaultdb', // You may want to change this
  user: 'root',
  password: '', // No password for insecure mode
  ssl: false // For insecure mode
});

let connected = false;
// Connect to database
db.connect()
  .then(() => {
    connected = true;
    console.log('Connected to CockroachDB');
  })
  .catch(err => {
    console.error('Error connecting to CockroachDB:', err);
    // Handle the error appropriately
  });

function getConnected(){
  return connected;
}

// Modify table creation - note SERIAL instead of INTEGER for auto-incrementing
db.query(`
  CREATE TABLE IF NOT EXISTS WorkerShare (
    id SERIAL PRIMARY KEY,
    workerName TEXT UNIQUE NOT NULL,
    valid INT DEFAULT 0,
    invalid INT DEFAULT 0,
    blocks INT DEFAULT 0,
    hashrate INT DEFAULT 0,
    roundShares INT DEFAULT 0,
    totalShares INT DEFAULT 0,
    lastShareTime INT DEFAULT 0,
    paid INT DEFAULT 0,
    unpaid INT DEFAULT 0
  )
`);

// Create PoolStats table
db.query(`
  CREATE TABLE IF NOT EXISTS PoolStats (
    id SERIAL PRIMARY KEY,
    blocks INT DEFAULT 0,
    hashrate INT DEFAULT 0,
    networkShares INT DEFAULT 0
  )
`);

// DELETE the following tables
//db.query(`DROP TABLE IF EXISTS netHashHistory`);
//db.query(`DROP TABLE IF EXISTS netDifficultyHistory`);
//db.query(`DROP TABLE IF EXISTS netAssetHistory`);
//db.query(`DROP TABLE IF EXISTS netBlockSizeHistory`);
// Create NetStats tables //
// Hashrate history
db.query(`
  CREATE TABLE IF NOT EXISTS netHashHistory (
    hashrate FLOAT DEFAULT 0,
    timestamp INT DEFAULT extract(epoch from current_timestamp())::INT
  )
`);

// Difficulty history
db.query(`
  CREATE TABLE IF NOT EXISTS netDifficultyHistory (
    difficulty FLOAT DEFAULT 0,
    timestamp INT DEFAULT extract(epoch from current_timestamp())::INT
  )
`);

// Asset history
db.query(`
  CREATE TABLE IF NOT EXISTS netAssetHistory (
    asset INT DEFAULT 0,
    timestamp INT DEFAULT extract(epoch from current_timestamp())::INT
  )
`);

// Block size history
db.query(`
  CREATE TABLE IF NOT EXISTS netBlockSizeHistory (
    height INT PRIMARY KEY NOT NULL,
    blockSize INT DEFAULT 0
  )
`);



module.exports = db;