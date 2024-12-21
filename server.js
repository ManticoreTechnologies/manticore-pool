const { getPoolBalance } = require('./lib/payout.js');
const { Workers } = require('./database/workers.js');
const { Network } = require('./database/network.js');
const daemon = require('./lib/daemon.js');
const Stratum = require('./lib/index.js');
const {options} = require('./config.js');
const {exit} = require('process');

// For testing the pool, the node is set to 9821
// The mainnet port is 8819

// Setup a daemon connection
let Daemon;

// Read the evrmore.conf file from /mnt/evrmore/evrmore.conf 
// find rpcuser and rpcpassword and set them to user and password
const fs = require('fs');
const configFile = '/home/phoenix/.evrmore/evrmore.conf';
// For our droplets we use /mnt/evrmore/evrmore.conf
const config = fs.readFileSync(configFile, 'utf8');
const configLines = config.split('\n');
const user = configLines.find(line => line.startsWith('rpcuser')).split('=')[1].trim();
const password = configLines.find(line => line.startsWith('rpcpassword')).split('=')[1].trim();

// Get the 'server.js <arg>'
const arg = process.argv[2];
if (arg == 'mainnet') {
    console.log('Mainnet mode');
    Daemon = new daemon.interface([{
      host: '127.0.0.1',
      port: 8819,
      user: user,
      password: password//
    }], function (severity, message) {
      console.log(severity + ': ' + message);
    });
}else if(arg=='testnet'){
    console.log('Testnet mode');
    Daemon = new daemon.interface([{
      host: '127.0.0.1',
      port: 9821,
      user: user,
      password: password//
    }], function (severity, message) {
      console.log(severity + ': ' + message);
    });
}else{
    console.log('specify mainnet or testnet as an argument. E.g: node `server.js mainnet`');
    exit(1);
}



// Setup the pool
var pool = Stratum.createPool(options, function(ip, port , workerName, password, extraNonce1, version, callback){ //stratum authorization function
    console.log("Authorize " + workerName + ":" + password);    
    Workers.initWorker(workerName);
    callback({
        error: null,
        authorized: true,
        disconnect: false
    });
});

// Create pool hooks
pool.on('share', async function(isValidShare, isValidBlock, data){
    // First lets increment the workers share/block counts and update the last share time 
    const workerName = data.worker;
    const worker = await Workers.getWorker(workerName);
    if (isValidShare) {
        worker.incrementValidShares();
        worker.incrementRoundShares();
    } else {
        worker.incrementInvalidShares();
    }
    worker.incrementTotalShares();
    if (isValidBlock) {
        worker.incrementBlocks();
    }
    worker.setLastShareTime(data.submitTime);

    // Whenever there is a new share we will first update the data of the worker who submitted the share
    // Then we will check if it is a valid block and if it is we will end the round and calculate the payout
    // We will not actually payout any funds here, we just update the database unpaid balances for each worker
    // This should be simple and fast, so we can do it in the share hook. 
    // *** Instructions ***
    // 1. get the reward we received for the block
    //    The reward is in data.blockReward, but we dont get the whole reward. Some is given to the recipients.
    //    At the very least the minerdev fund is taken out. Which is 10% of the reward.
    const block_reward = parseInt(data.blockReward)*0.9; // Block reward in satoshis
    // 2. sum the total shares found by miners for this round
    const total_shares = await Workers.getTotalRoundShares();
    console.log('Total shares: ' + total_shares);
    console.log('Block reward: ' + block_reward);
    // 3. calculate each miners share of the block reward based on their shares
    const workers = await Workers.getAllWorkers();
    console.log('Workers: ' + workers);
    // 4. update the unpaid balance for each miner
    for (const worker of workers) {
        const worker_payout = worker.roundshares / total_shares * block_reward * (1-options.poolFee)
        console.log('Worker payout: ' + worker_payout);
        worker.incrementUnpaid(worker_payout);
    }
    // 5. reset the round shares for the next round
    await Workers.resetRoundShares();



});

pool.on('newBlock', async function(block) {
    console.log('New block: ' + block.rpcData.height);

    // Update the network stats
    Network.updateHashrateHistory(await DaemonUtility.getHashrate());
    Network.updateDifficultyHistory(await DaemonUtility.getDifficulty());
    Network.updateAssetHistory(await DaemonUtility.getAssetCount());
    const blockSizeAndHeight = await DaemonUtility.getBlockSizeAndHeight();
    Network.updateBlockSizeHistory(blockSizeAndHeight.blockSize, blockSizeAndHeight.height);

    
});

// Daemon utility functions
class DaemonUtility {   
    static async getHashrate() {
        return new Promise((resolve, reject) => {
            Daemon.cmd('getmininginfo', [], function (results) {
                var hashrate = results[0].response.networkhashps;
                resolve(Math.round(hashrate));
            });
        });
    }
    static async getDifficulty() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('getmininginfo', [], function (results) {
            var difficulty = results[0].response.difficulty;
            resolve(Math.round(difficulty));
          });
        });
    }
    static async getBlockHeight() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('getblockcount', [], function (results) {
            var blockCount = results[0].response;
            resolve(blockCount);
          });
        });
    }
    static async getLastBlockTime() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('getblockcount', [], function (results) {
            var blockCount = results[0].response;
            Daemon.cmd('getblockhash', [blockCount - 1], function (results) {
              Daemon.cmd('getblock', [results[0].response], function (results) {
                  var blockTime = results[0].response.time;
                  resolve(blockTime);
              });
            });
          });
        });
    }
    static getBlockReward() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('getblockcount', [], async function (results) {
            var subsidyHalvingInterval = 1648776;
            var genesisReward = 2778;
            var blockCount = results[0].response;
            var reward = genesisReward / (2 ** (Math.floor(blockCount / subsidyHalvingInterval)));
            resolve(reward);
          });
        });
    }
    static getAssetCount() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('listassets', [], function (results) {
            var assetCount = results[0].response.length;
            resolve(assetCount);
          });
        });
      }
    static getBlockSizeAndHeight() {
        return new Promise((resolve, reject) => {
          Daemon.cmd('getbestblockhash', [], function (results) {
            var blockHash = results[0].response;
            Daemon.cmd('getblock', [blockHash], function (results) {
              var blockSize = results[0].response.size;
              var height = results[0].response.height;
              resolve({blockSize, height});
            });
          });
        });
      } 
}

// API endpoints for frontend to get pool data
const express = require('express');
const app = express();
// cors
const cors = require('cors');
app.use(cors());

app.get('/poolstats', async (req, res) => {
    const poolstats_template = {
      hashrate: await Workers.getActiveWorkersHashrate(),
      difficulty: options.ports[3334].diff,
      activeMiners: await Workers.getActiveWorkersCount(),
      blockFound: await Workers.getTotalBlocks(),
      networkShare: 0,
    }
    res.json(poolstats_template);
  });
app.get('/dashboard/:address', async (req, res) => {
    const address = req.params.address;
    const workers = await Workers.getWorkersByAddress(address);
    res.json(workers);
});
app.get('/netstats', async (req, res) => {
    netstats = {    hashrate: await DaemonUtility.getHashrate(),
      difficulty: await DaemonUtility.getDifficulty(),
      blockHeight: await DaemonUtility.getBlockHeight(),
      blockTime: await DaemonUtility.getLastBlockTime(),
      blockReward: await DaemonUtility.getBlockReward(),
      poolHashrate: await Workers.getActiveWorkersHashrate(),
      networkShare: 0}
    res.json(netstats);
  });
app.get('/netstats/history/:type', async (req, res) => {
    const type = req.params.type;
    const history = await Network.getHistory(type);
    res.json(history);
});
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});



// Main entry point 
async function main(){
    // Now that we have handled our share shit we can check the pool address balance
    const poolBalance = await getPoolBalance(options.address);
    console.log('Pool balance: ' + poolBalance);
    //const workers = await Workers.getAllWorkers();
    //console.log(workers);
    // Start the pool
    //pool.start();
    
    //await Workers.resetAllWorkerData();
    
    //const worker = await Workers.getWorker('ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker');
    //const workers = await Workers.getActiveWorkers();
    
    //console.log(workers);
}
main();

return;




const { WorkerShare, PoolStats, getConnected, getWorker, getPoolRoundShares, getAllWorkerShares, setPoolRoundShares} = require('./db.js');
const bitcoin = require('bitcoinjs-lib');
const util = require('./lib/util.js');
const transactions = require('./lib/transactions.js');
const scriptCompile = transactions.scriptCompile;






// TEst the db functions here
async function testDbFunctions(){
    const workerName = "ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker"
    let maxTries = 10;
    while (!getConnected()){
        console.log('Not connected to db');
        if (maxTries > 0){
            maxTries--;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }else{
            return;
        }

        /* Test the db functions here */
        
        // First try to get the worker 
        const worker = await getWorker(workerName);

        // Purge all worker data to ensure this always works and we start fresh
        //worker.purgeWorkerData(); // Try without purging lists to see if they save on their own

        // Test all the Setter Mutators


        // Now lets get the worker again and see if the data has been updated
        const worker_updated = await getWorker(workerName);

        // Print the worker
        console.log(worker_updated);



    }

}
//testDbFunctions();
//return;
////
  
//Daemon.cmd('getblocktemplate', [], function (results) {
//    const txhex = createPayoutTransaction(options.address);
//});


async function calculateHashrate(worker, data){
    // Get the submit time for the current share in seconds
    currentSubmitTime = data.submitTime / 1000 || 0

    // Get the last share time for the worker in seconds
    lastShareTime = worker.lastsharetime / 1000 || 0
    
    // Calculate the share time
    shareTime = (currentSubmitTime - lastShareTime)

    // Get the average share time
    averageShareTime = worker.historicalsharetimes.reduce((a, b) => a + b, 0) / worker.historicalsharetimes.length;

    // Get the pool difficulty
    poolDifficulty = data.difficulty

    // Calculate the hashrate based on pool difficulty and share time in Hashes per second
    hashrate = Math.floor((poolDifficulty*(Math.pow(2, 32)) / averageShareTime))
    if (hashrate == Infinity) {
      hashrate = 0;
    }
    if (isNaN(hashrate)) {
      hashrate = 0;
    }
    if (hashrate < 0) {
      hashrate = 0;
    }
    if (hashrate > 1000000000) {
      hashrate = 1000000000;
    }
    return hashrate;
    
    /*
    // Update the hashrate, in mh/s
    WorkerShare.updateHashrate(workerName, hashrate/1000000 || 0);

    // Update the last share time 
    WorkerShare.updateLastShareTime(workerName, data.submitTime);

    // Update the historical share times 
    await WorkerShare.updateHistoricalShareTimes(workerName, shareTime || 5);

    // Update the historical hashrate, only saves the last 24 hourse worth so 24*60*60 = 86400
    await WorkerShare.updateHistoricalHashrate(workerName, hashrate/1000000 || 0);
    */
}

pool.on('share', async function(isValidShare, isValidBlock, data) {
    const workerName = data.worker;
    console.log('------- Share: '+workerName + ' -------');

    // Get the worker object
    let workerShare = await getWorker(workerName);
    
    // Increment the workers shares 
    if (isValidShare) {
        workerShare.incrementValidShares();
        workerShare.incrementRoundShares();
    } else {
        workerShare.incrementInvalidShares();
    }
    workerShare.incrementTotalShares();
    
    // Increment the workers blocks
    if (isValidBlock) {
        workerShare.incrementBlocks();
    }

    // Set the last share time
    workerShare.setLastShareTime(data.submitTime);
    workerShare.updateShareTimesHistory(data.submitTime);

    // Calculate and set the hashrate
    const hashrate = await calculateHashrate(workerShare, data);
    workerShare.setHashrate(hashrate);
    workerShare.updateHashrateHistory(hashrate);

    // Worker share is already saved in the database everytime we update it

  });

/*
'severity': can be 'debug', 'warning', 'error'
'logKey':   can be 'system' or 'client' indicating if the error
            was caused by our system or a stratum client
*/
pool.on('log', function(severity, logKey, logText){
    //console.log(severity + ': ' + '[' + logKey + '] ' + logText);
});


pool.on('newBlock', async function(block) {
    console.log('New block detected.');

    // Get the pool miner funds balance
    const poolBalance = await getPoolBalance(options.address) / 100000000; 

    // Get the payout threshold
    console.log('Options: '+JSON.stringify(options));
    const payoutThreshold = parseInt(options.payoutThreshold);
    console.log('Payout threshold: ' + payoutThreshold);
    console.log('Pool balance: ' + poolBalance);

    // Check if the pool balance is greater than the payout threshold
    if (poolBalance > payoutThreshold) {
        console.log('Pool balance: ' + poolBalance);
        console.log("Payout threshold reached");

        // End the round, calculate each miner's share and update unpaid balances
        const poolRoundShares = await getPoolRoundShares();

        // Now get the shares for each worker
        const workerShares = await getAllWorkerShares();

        // Create the payout transaction
        const txhex = await createPayoutTransaction(options.address);

        // Check if a valid transaction hex was returned
        if (txhex) {
            // Send the raw transaction
            Daemon.cmd('sendrawtransaction', [txhex], function(results) {
                console.log('Send raw transaction results: ' + JSON.stringify(results));
                if (results[0].error) {
                    console.log('Error sending raw transaction: ' + results[0].error.message);
                } else {
                    // Get the txid
                    const txid = results[0].response;
                    console.log('Paid out for the workers');
                    console.log('Transaction ID: ' + txid);
                }
            });
        } else {
            console.log('No valid transaction created. Skipping transaction submission.');
        }
    } else {
        console.log('Pool balance is below the payout threshold. No payout will be made.');
    }
});



//console.log("Starting Pool");

//console.log("Pool started", pool);
// setTimeout(() => { console.log('Waiting 10 seconds'); }, 10000);
/*
function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}
console.log('Sleeping 10 seconds'); sleep(10000);
*/
