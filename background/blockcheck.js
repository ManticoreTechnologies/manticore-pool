const {options} = require('../config.dev.js');
const daemon = require('../lib/daemon.js');
const {Workers} = require('../database/workers.js');

// Create a new daemon interface, might not be needed idk
const Daemon = new daemon.interface([options.daemons[0]], function (severity, message) {
    console.log(severity + ': ' + message);
  });
  
async function updateBlockStatus(db){
    // Get all the blocks that are pending
    const blocks = await Workers.getBlocksByStatus('pending');
    const blockBuffer = {};
    for (const block of blocks){
        const blockData = Daemon.cmd('getblock', [block.block_hash], async function(results){
            /*
            hash: '00000032ef8f2fdf02ae912f3deabd8f8864de7000fee46dc4ebce289dcc8f08',
            confirmations: 1,
            strippedsize: 295,
            size: 331,
            weight: 1216,
            height: 775,
            version: 805306368,
            versionHex: '30000000',
            merkleroot: '1181ecf4b67d94f3f59f791d701f3fac4f15051ddfb30e523ed99d7f3907fe89',
            tx: [ '1181ecf4b67d94f3f59f791d701f3fac4f15051ddfb30e523ed99d7f3907fe89' ],
            time: 1735059528,
            mediantime: 1735059524,
            nonce: 0,
            bits: '1e00ffff',
            difficulty: 0.00390625,
            chainwork: '000000000000000000000000000000000000000000000000000000030d3deb87',
            headerhash: '201e97281f5659162219745a73e91b2e76a4ed2585bed0a396dc0ed6985aa6d8',
            mixhash: '0add12e909f3b6014be132e5448faf6463d7e47e81bb4f7c77ab4729c10914d8',
            nonce64: 14128042719743097000,
            previousblockhash: '0000003124ae2a88e2f3a6ed659fc410cf9beb435821bef64a3fa8c5245dbee1'
            */
           blockBuffer[block.block_hash] = results[0].response;
           const confirmed = results[0].response.confirmations > 101;
           const confirmed_at = confirmed ? new Date() : null;
           await db.query(`UPDATE Blocks SET confirmations = $1, status = $2, confirmed_at = $3 WHERE block_hash = $4`, [results[0].response.confirmations, confirmed ? 'confirmed' : 'pending', confirmed_at, block.block_hash]);
        });
    }
}

async function startBlockCheck(db){
    setInterval(updateBlockStatus, 10000, db);
}

module.exports = {
    startBlockCheck
}