// Check node version, must be exactly 8.1.4. If not, then exit the program
require('./version.check.js');

// Import our shit we need
const daemon = require('./lib/daemon.js');
const { user, password } = require('./utils.js');
const Stratum = require('./lib/index.js');
const { Workers } = require('./database/workers.js');
const {options} = require('./config.dev.js');
const autoflush = require('./background/autoflush.js');
const {initializePoolDatabase, getPoolDatabase} = require('./database/db.js');
const { startBlockCheck } = require('./background/blockcheck.js');
const { getPoolBalance } = require('./lib/payout.js');
const autostats = require('./background/autostats.js');
const { Network } = require('./database/network.js');


const MAIN_NODE = true; // Is this the main node? If it is it will handle processing payouts

// Create a new daemon interface, might not be needed idk
const Daemon = new daemon.interface([options.daemons[0]], function (severity, message) {
    console.log(severity + ': ' + message);
  });
  
// Create the stratum mining pool
var pool = Stratum.createPool(options, function(ip, port , workerName, password, extraNonce1, version, callback){ //stratum authorization function
    
    // Log the authorization, even though we are not using it
    console.log("Authorize " + workerName + ":" + password);    
    
    // Create the worker if it is not already in the database
    Workers.initWorker(workerName);

    // Return the authorization
    callback({
        error: null,
        authorized: true,
        disconnect: false
    });

});





// Every share is processed here
pool.on('share', async function(isValidShare, isValidBlock, data, db){

    // Log the share data
    console.log('Share received. Updating worker shares');
    console.log(data);
    const worker = await Workers.getLocalWorkerBuffer(data.worker);
    const roundId = await Workers.getRoundId(db);

    // Update the worker shares
    if (isValidShare) {
        worker.incrementValidShares();
        worker.incrementRoundShares();
    } else {
        worker.incrementInvalidShares();
    }
    worker.incrementTotalShares();

    // Update the worker hashrate
    //worker.setHashrate(await worker.calculateHashrate(worker, data, db));

    if (isValidBlock){
        worker.incrementBlocks();
        /*
{ job: '000000000000000000000000000000000000000000000000000000000000ccce',
  ip: '::ffff:127.0.0.1',
  port: 3334,
  worker: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
  height: 738,
  blockReward: 277800000000,
  difficulty: 0.003,
  shareDiff: '0.00442036',
  submitTime: 1735058826866,
  blockDiff: 0.003891051,
  blockDiffActual: 0.003891051,
  blockHash: '000000e238e9c1e98714fdf9f5a407a66bb893d60537edd4d6e2de93a224c1b4',
  blockHashInvalid: undefined,
  txHash: 'b2b623c665ba5f595302d686c7ff196b6f94799445c7119ed8a0d2f024a32288' }
        */

        // A block was found, lets save it to the database
        await Workers.saveBlock(roundId, data.blockHash, data.height, data.blockReward, data.worker, data.shareDiff, db);
        // What im thiking is we save all the blocks into this table, then we have one node process the blocks into rounds
        // these rounds will then be processed into payouts and be put into the unpaid balance of miners 
    }



});

pool.on('newBlock', async function(block_data, db){
    console.log('Block found. Attempting to process payout');
    if (MAIN_NODE){
        await processPayouts(10, db); // Process payouts every 10 blocks
    }
});

// TODO: 
// Add a payout system that will only run on the main node
// This payout system will run every 90 seconds and it will check 
// each miners unpaid balance. We will add the miner to our payout transaction
// if their payout threshold is met. Each miner can set their own payout threshold
// they set their password when connecting to the pool.

// Every time the pool finds a block we will sum up all the round shares of the miners 
// then give each miner a share of the block reward (minus our pool fee) based on their share of the round
// We update their unpaid balance with the amount we calculated and later the payout system will pay them out 
// this is konwn as pplns (Pay Per Last N Shares)


async function testFlush(db) {
    console.log('--- Testing flush ---');

    // Initialize a test worker
    const workerName = 'testWorker';
    
    console.log('--- Initializing worker ---');
    await Workers.initWorker(workerName, db);
    console.log('--- Worker initialized ---');


    const worker = await Workers.getLocalWorkerBuffer(workerName)

    // Simulate receiving shares
    worker.incrementValidShares(1);
    worker.incrementRoundShares(1);
    worker.incrementTotalShares(1);
    worker.incrementBlocks(1);

    // Flush updates
    //await Workers.flushAllUpdates(db);

    //await Workers.endRound(db, 2588080);
    // Try letting the auto flush do its job
    
    

    // Verify the updates in the database
    //const updatedWorker = await Workers.getWorker(workerName, db);
    //console.log(updatedWorker);

    // Clean up: reset the worker data
    //await Workers.resetAllWorkerData();
    //console.log('Test completed and data reset.');
}

async function main(){

    // Creates the database and tables if they don't exist
    // Each node will do this on startup, REMEMBER to remove the dropping code so we dont keep resetting the db on startup
    //console.log('--- Initializing database ---');
    // This could also just be done in the main node if we decide to set a main node
    // true to reset the entire database
    if (MAIN_NODE){
        //await initializePoolDatabase(true); // Only do this on the first launch of the main node
    }
    
    //console.log('--- Database initialized ---');

    // Get the pool database
    //const db = await getPoolDatabase();

    //// Start the autoflush, this will flush the workers every 10 seconds
    //const db = await autoflush.engage(5000);
    // Start the autostats, this will update the network stats every 10 seconds
    //autostats.engage(1000, db);

    // Start the rest api server
    //const restapi = new RestAPI(db);
    // run rest api server
    //restapi.start(5030);

    // test adding blocks
    //while(true){
    //    await Workers.saveBlock(1, 1, '0x1234567890abcdef', 1, '0x1234567890abcdef', db);
    //    await new Promise(resolve => setTimeout(resolve, 1000));
    //}

    // Test code for autoflush
    //while(true){
    //    await testFlush(db);
    //    await new Promise(resolve => setTimeout(resolve, 1000));
    //}

    // Currently we have autoflush working and the database is showing the correct data
    // The rest api is working so next we should work on saving share data when we receive it

    // For the main node we start our round processing service

    // Automated block updating, fully functional
    //await startBlockCheck(db);

    // Now that the blocks are being updated we need to figure out how to process our payouts
    // can we forgoe the rounds shit? maybe we can just use the blocks table to process payouts
    // We can have a paid_at column and a paid_txid column in the blocks table 
    // blocks that have paid_at set to null are the ones that have not been paid out yet
    // we can get all the confirmed, unpaid blocks from the db and then we can generate a payout transaction for the 
    // sum of the block rewards of all these blocks and then we can set the paid_at and paid_txid columns for each block
    // once the transaction is accepted by the node we can set the paid_at column to the current date and time

    // Here we will use the space to produce a new class. This class will be a database class. 
    // The purpose of this class will be to wrap up all the database operations into a single class. 
    // I want to use a scalable approach to the database operations so that we can easily add new operations in the future
    // To do this we will create a new Table for each worker to allow infinite data columns for each worker
    // This way we can easily get worker history and current data all from one request

    // The way CockroachDB works is there is a system database used to create/update/delete new databases 
    // And then we can use those databases to create/update/delete tables and rows

    // We can now create/delete databases
    // We can also create/delete/rename tables
    //

    // Heres the schema ive decided on
    // | -- Pool Database --
    // | ---> Addresses Table
    // | --------> address_id (Primary Key)
    // | --------> address (VARCHAR(255))
    // | --------> created_at (TIMESTAMP)
    // | --------> last_active (TIMESTAMP)
    // | ---> Workers Table
    // | --------> worker_id (Primary Key)
    // | --------> worker_name (VARCHAR(255))
    // | --------> password (VARCHAR(255))
    // | --------> status (ENUM: active, inactive, banned)
    // | --------> last_active (TIMESTAMP)
    // | ----> Shares Table


    // Create a new cockroachdb instance
    const CockroachDB = require('./Database/CockroachDB/cockroachdb.js');
    const cockroachdb = new CockroachDB();
    await cockroachdb.database.connect();

    // Purge all NON SYSTEM databases
    //await cockroachdb.purgeDatabases();

    // Create a new database for each address 
    await cockroachdb.database.create('evrxxxxxxxxxxxxxx');

    // Connect to the pool database
    await cockroachdb.database.connect('evrxxxxxxxxxxxxxx');

    // We should store these table configs in a file 
    const share_columns = [
        ['timestamp', 'TIMESTAMP PRIMARY KEY'],
        ['worker_name', 'VARCHAR(255)'], // The name provided by the miner (eg worker1)
        ['block_hash', 'VARCHAR(255)'],
        ['block_txid', 'VARCHAR(255)'],
        ['target_difficulty', 'FLOAT'],
        ['share_difficulty', 'FLOAT'],
        ['valid_share', 'BOOLEAN'],
        ['valid_block', 'BOOLEAN'],
        ['block_height', 'INT'],
        ['block_reward', 'INT'],
        ['hashrate', 'FLOAT'],
    ];

    // Create a new table for each address 
    await cockroachdb.table.create('shares', share_columns);

    await cockroachdb.row.insert('shares', ['worker_name', 'timestamp', 'valid_share', 'valid_block', 'target_difficulty', 'share_difficulty', 'block_height', 'block_reward', 'block_hash', 'block_txid'], ['worker1', new Date(), true, true, 1, 1, 1, 1, '0x1234567890abcdef', '0x1234567890abcdef']);
    await cockroachdb.row.insert('shares', ['worker_name', 'timestamp', 'valid_share', 'valid_block', 'target_difficulty', 'share_difficulty', 'block_height', 'block_reward', 'block_hash', 'block_txid'], ['worker2', new Date(), true, false, 1, 1, 1, 1, '0x1234567890abcdef', '0x1234567890abcdef']);
    
    // Ensure we are connected to the correct database
    await cockroachdb.database.connect('evrxxxxxxxxxxxxxx');
    // Select all the valid shares for the worker 
    const address_shares = await cockroachdb.row.select('shares', ['*'], ['valid_share = true']);
    console.log(address_shares.length)

    
    // Start the pool
    //pool.start(db);

}

main();






/* Move some of this shit elsewhere */

async function calculatePayout(blocks){
    /*
    block_id: '1032184782954233858',
round_id: '1032181599398625300',
block_hash: '0000000d0be447d9e14ef340165a8b18e57caa6fb2f4c96f6455dc7a6ceb29e2',
block_height: '980',
confirmations: '0',
reward: '277800000000.00000000',
transaction_id: null,
miner: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
difficulty: '0.07664802',
status: 'pending',
created_at: 2024-12-25T00:23:17.531Z,
confirmed_at: null,
paid_at: null,
paid_txid: null 
 */
    
    return new Promise(async (resolve) => {
        // first we need to know the total reward of all the blocks
        const total_reward = blocks.reduce((sum, block) => sum + parseInt(block.reward), 0);

    // Calculate the pool fee
    const pool_fee = Math.floor(total_reward * (options.poolFee/100));
    
    // then we need to know the total payout of all the blocks
    const total_payout = total_reward - pool_fee;

    // Calculate the payout for each miner
    const workers = await Workers.getAllWorkers();
    
    // Sum up the total round shares of all the miners
    const total_round_shares = workers.reduce((sum, worker) => sum + parseInt(worker.roundshares), 0);

    // Calculate the payout for each miner
    const miner_payouts = {};
    for (const worker of workers){
        const worker_payout = (parseInt(worker.roundshares) / total_round_shares) * total_payout;
        miner_payouts[worker.workername] = worker_payout;
    }

    // Now reduce the miner payouts for each address
    // So each worker name is <address>.<workerName>
    // we need to remove .<workerName> from the address
    // and combine all the payouts for the same address
    const address_payouts = {};
    for (const [address, payout] of Object.entries(miner_payouts)){
        const workerName = address.split('.')[1];
        const newAddress = address.split('.')[0];
        if (address_payouts[newAddress]){
            address_payouts[newAddress] += payout;
        } else {
            address_payouts[newAddress] = payout;
        }
    }
    console.log(address_payouts)

    const payout = {
        total_reward: total_reward,
        total_round_shares: total_round_shares,
        pool_fee: pool_fee,
        total_payout: total_payout,
        miners: address_payouts,
        workers: miner_payouts
    }


        resolve(payout);
    });
}

async function createPayoutTransaction(poolAddress, payouts) {
    return new Promise((resolve) => {
        console.log('Creating payout transaction for pool address: ' + poolAddress);

        // Get the pool balance
        getPoolBalance(poolAddress).then(async (poolBalance) => {
            console.log('Pool calculated balance:', poolBalance / 100000000, 'EVR');

            // Use the pool balance as the available balance
            const availableBalance = poolBalance;
            console.log('Using available balance:', availableBalance / 100000000, 'EVR');

            if (availableBalance <= 0) {
                console.log('No funds available for payout. Skipping transaction.');
                resolve(null);
                return;
            }

            // Extract payout data
            const totalPayout = payouts.total_payout;
            const minerPayouts = payouts.miners;

            // Check if there are any payouts to distribute
            if (Object.keys(minerPayouts).length === 0) {
                console.log('No valid payouts to distribute. Skipping payout.');
                resolve(null);
                return;
            }

            // Create outputs object for createrawtransaction
            let outputs = {};
            let totalOutput = 0;

            for (const [address, payout] of Object.entries(minerPayouts)) {
                const workerPayout = payout / 100000000; // Convert to EVR
                outputs[address] = workerPayout;
                totalOutput += workerPayout;
            }

            // Add the pool fee address output
            const poolFee = payouts.pool_fee / 100000000; // Convert to EVR
            outputs[options.feeAddress] = poolFee;
            totalOutput += poolFee;

            // Verify total output doesn't exceed available balance
            if (totalOutput > availableBalance) {
                console.log('Warning: Total output would exceed available balance, reducing payouts proportionally');
                const reductionFactor = availableBalance / totalOutput;
                for (const address in outputs) {
                    outputs[address] = Number((outputs[address] * reductionFactor).toFixed(8));
                }
            }

            // Print transaction summary
           // printTransactionSummary(availableBalance, payouts, outputs);

            // Create the raw transaction
            Daemon.cmd('createrawtransaction', [[], outputs], function(createResults) {
                if (createResults[0].error) {
                    console.log('Error creating raw transaction:', createResults[0].error);
                    resolve(null);
                    return;
                }

                const rawTx = createResults[0].response;

                // Fund the raw transaction with the pool address as the change address
                Daemon.cmd('fundrawtransaction', [rawTx, { changeAddress: poolAddress }], function(fundResults) {
                    if (fundResults[0].error) {
                        console.log('Error funding transaction:', fundResults[0].error);
                        resolve(null);
                        return;
                    }

                    // Show the network fee that was calculated
                    const fee = fundResults[0].response.fee;
                    console.log(`\nActual Network Fee: ${fee.toFixed(8)} EVR (${((fee / (availableBalance / 100000000)) * 100).toFixed(4)}%)`);

                    // Sign the funded transaction
                    Daemon.cmd('signrawtransaction', [fundResults[0].response.hex], function(signResults) {
                        if (signResults[0].error) {
                            console.log('Error signing transaction:', signResults[0].error);
                            resolve(null);
                            return;
                        }

                        // Return the signed transaction hex
                        resolve(signResults[0].response.hex);
                    });
                });
            });
        }).catch(error => {
            console.log('Error in createPayoutTransaction:', error);
            resolve(null);
        });
    });
}

async function processPayouts(blocks_to_process, db){
    // Here we will get all the confirmed, unpaid blocks from the db
    const unpaid_confirmed_blocks = await Workers.getUnpaidBlocks(db);
    if (unpaid_confirmed_blocks.length < blocks_to_process){
        console.log('Not enough unpaid confirmed blocks found');
        return;
    }
    // We will now create a payout transaction for the sum of the block rewards of all these blocks
    const payouts = await calculatePayout(unpaid_confirmed_blocks);
    console.log(payouts)
    // Create the payout transaction
    const payout_tx = await createPayoutTransaction(options.address, payouts);
    console.log(payout_tx)

    // Once we successfully create the raw transaction, we need to try sending it to the node
    // First i want to try sending a bad transaction to see how it handles it
    Daemon.cmd('sendrawtransaction', [payout_tx], async function(sendResults) {
        const error = sendResults[0].error;
        const txid = sendResults[0].response;

        // Seems that when there is an error, we get an error object with a message {code: -22, message: TX decode failed}
        // It doesnt matter to us what the error is, we just need to know if it failed or not
        if (error || txid == null){
            // If it fails we do not want to update the database, we can maybe log the error later but for now we just skip the payout
            console.log('Error sending transaction:', error);
        } else {
            // However, if we send a good transaction, we want to update the database
            console.log('Transaction sent successfully');
            // First we can update the blocks table to set the paid_at and paid_txid columns
            for (const block of unpaid_confirmed_blocks){
                await db.query(`UPDATE Blocks SET status = 'paid', paid_at = NOW(), paid_txid = '${txid}' WHERE block_id = '${block.block_id}'`);
            }
            // Then we can remove all the round shares from the workers THAT WERE PAID OUT!!
            const paid_addresses = Object.keys(payouts.miners);
            const workers = await Workers.getWorkersByAddresses(paid_addresses);
            for (const worker of workers){
                // We now have each workers payout data 
                const worker_payout = payouts.workers[worker.workername]
                // We now that it was sent successfully so increment paid and decrement unpaid
                worker.incrementPaid(worker_payout);
                //worker.incrementUnpaid(-worker_payout);
                // Set roundshares to 0
                worker.setRoundShares(0);
                // This puts the paid and unpaid values in the buffer, we will flush this in a minute
                // We can flush by doing Workers.flushAllUpdates(db);   
                Workers.flushAllUpdates(db);
            }
        
       }
    });
}