const daemon = require('./daemon.js');
const bitcoin = require('bitcoinjs-lib');
const scriptCompile = require('./transactions.js');
const options = require('../server.js');

// Read the evrmore.conf file from /mnt/evrmore/evrmore.conf 
// find rpcuser and rpcpassword and set them to user and password
const fs = require('fs');
const configFile = '/mnt/evrmore/evrmore.conf';
// For our droplets we use /mnt/evrmore/evrmore.conf
const config = fs.readFileSync(configFile, 'utf8');
const configLines = config.split('\n');
const user = configLines.find(line => line.startsWith('rpcuser')).split('=')[1].trim();
const password = configLines.find(line => line.startsWith('rpcpassword')).split('=')[1].trim();


const Daemon = new daemon.interface([{
    host: '127.0.0.1',
    port: 8819,
    user: user,
    password: password//
  }], function (severity, message) {
    console.log(severity + ': ' + message);
  });
async function getInfernaBalance(workerName){
    const workerAddress = workerName.split('.')[0];
    return new Promise((resolve, reject) => {
        Daemon.cmd('getaddressbalance', [{addresses: [workerAddress]}, true], function (results) {
            let assetBalances = results[0].response;
            let assetBalance = 0;
            try{
                assetBalances = assetBalances.filter(asset => asset.assetName === 'INFERNA');
                assetBalance = assetBalances[0].balance;
            }catch(error){
                //console.log('Worker '+workerName+' does not have any inferna balance');
            }
            resolve(assetBalance/100000000);
        });
    });
}

async function calculateInfernaEVRRebate(workerName, payout){

    // Get the worker address
    const workerAddress = workerName.split('.')[0];

    // Get the inferna balance
    const infernaBalance = await getInfernaBalance(workerName);

    // We offer scaled rebates based on the amount of inferna held by the worker
    // We offer 0-1% bonuses applied to the payout (essentially a rebate for the pool fee) 
    // We may offer promotional bonuses for holding inferna for a certain amount of time
    // For example, for limited time we may offer 10% EVR bonuses for workers holding more than 500000 inferna 
    // Or we may offer general asset bonuses for inferna holders, such as 1:1 evr to <promoted asset> while supplies last

    // The scale for inferna rebates is the following equation
    // inferna_balance / max_inferna_bonus = rebate_percentage

    max_inferna_balance = 1000000
    max_inferna_bonus = 1

    // Calculate the rebate percentage 
    rebate_percentage = (Math.min(infernaBalance, max_inferna_balance) / max_inferna_balance)/100

    // Calculate the bonus
    bonus = Math.floor(payout * rebate_percentage)

    return bonus;
}

async function calculatePoolFee(workerName, workerPayout){
    console.log('Calculating pool fee for worker: '+workerName+' with payout: '+workerPayout);
    const poolFeePercent = 1;
    let poolFee = Math.floor(workerPayout * poolFeePercent / 100);

    const workerBonus = Math.floor(await calculateInfernaEVRRebate(workerName, workerPayout));
    poolFee = poolFee - workerBonus;
    if (poolFee < 0){
        poolFee = 0;
    }
    
    return poolFee;
}

function getPoolBalance(poolAddress){
    return new Promise((resolve, reject) => {
        Daemon.cmd('listunspent', [10, 99999999, [poolAddress]], function (results) {
            const poolUtxos = results[0].response;
            let poolBalance = 0;
            for (var i = 0; i < poolUtxos.length; i++) {
                const utxo = poolUtxos[i];
                poolBalance = poolBalance + utxo.amount;
            }
            resolve(Math.floor(poolBalance*100000000));
        });
    });
}

function getUnspent(poolAddress){
    return new Promise((resolve, reject) => {
        Daemon.cmd('listunspent', [{address: poolAddress}], function (results) {
            resolve(results);
        });
    });
}


async function calculatePayouts(tx, poolBalance, poolAddress) {
    console.log('Pool balance: ' + poolBalance);
    // Get the total pool shares for the round
    const roundShares = await getPoolRoundShares();

    // Check if there are any shares to distribute
    if (roundShares === 0) {
        console.log('No valid shares to distribute. Skipping payout.');
        return { payouts: {}, totalPayout: 0, poolShares: 0 };
    }

    // Now we need to get a list of all the workers and their valid shares for the round 
    const workersRoundShares = await getAllWorkerShares();

    // Now loop through each worker
    var payouts = {};
    let totalPayout = 0;
    for (var i = 0; i < workersRoundShares.length; i++) {
        // get the worker address
        const workerAddress = workersRoundShares[i].workername.split('.')[0];

        // ensure that we track payouts by worker address, and track the bonus given to the worker
        if (payouts[workerAddress] == undefined) {
            payouts[workerAddress] = { rewards: 0, fees: 0, payout: 0, shares: 0 };
        }

        const workerName = workersRoundShares[i].workername;
        const workerShares = parseInt(workersRoundShares[i].roundshares);

        // Store the shares in the payouts object
        payouts[workerAddress].shares = workerShares;

        console.log('Worker: ' + workerName + ' Shares: ' + workerShares);
        let workerRewards = Math.floor((workerShares / roundShares) * poolBalance) || 0;
        let workerFee = await calculatePoolFee(workerName, workerRewards) || 0;
        let workerPayout = Math.floor(workerRewards - workerFee) || 0;

        console.log('workerFee: ' + workerFee);

        console.log('workerSharePercent: ' + (workerShares / roundShares || 0));
        console.log('workerRewards: ' + workerRewards);
        console.log('workerFee: ' + workerFee);
        console.log('workerPayout: ' + workerPayout);

        payouts[workerAddress].rewards += workerRewards;
        payouts[workerAddress].fees += workerFee;
        payouts[workerAddress].payout += workerPayout;
        totalPayout += workerPayout;
    }
    console.log('poolBalance: ' + poolBalance);
    console.log('payouts: ' + JSON.stringify(payouts));
    return { payouts: payouts, totalPayout: totalPayout, poolShares: roundShares };
}

async function addPayoutOutputs(tx, payouts){
    /*
    payouts looks like this:
    { EPgHKVDcCfH3eHQ5BkbQt55He23fcffF9T: { rewards: 50309353739512, bonus: 5030, payout: 50309353739512 },
  ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW: { rewards: 6886895291487, bonus: 0, payout: 6886895291487 } }
     */
    for (const [workerAddress, details] of Object.entries(payouts)) {
        const payout = details.payout;
        const addressHash = bitcoin.address.fromBase58Check(workerAddress).hash;
        tx.addOutput(
            scriptCompile(addressHash),
            payout
        );
    }
}

// Add this new function to check actual wallet balance
function getWalletBalance() {
    return new Promise((resolve, reject) => {
        Daemon.cmd('getbalance', [], function(results) {
            if (results[0].error) {
                console.log('Error getting wallet balance:', results[0].error);
                resolve(0);
                return;
            }
            resolve(Math.floor(results[0].response * 100000000)); // Convert to satoshis
        });
    });
}

function printTransactionSummary(availableBalance, payoutsData, outputs) {
    console.log('\n=== Transaction Summary ===');
    console.log('Available Balance:', (availableBalance / 100000000).toFixed(8), 'EVR');
    
    // Pool Statistics
    console.log('\n--- Pool Statistics ---');
    console.log('Total Pool Shares:', payoutsData.poolShares);
    console.log('Total Payout Amount:', (payoutsData.totalPayout / 100000000).toFixed(8), 'EVR');
    
    // Worker Payouts
    console.log('\n--- Worker Payouts ---');
    for (const [address, details] of Object.entries(payoutsData.payouts)) {
        console.log(`\nWorker: ${address}`);
        console.log(`  Shares: ${details.shares || 0}`);
        console.log(`  Share Percentage: ${((details.shares / payoutsData.poolShares) * 100).toFixed(2)}%`);
        console.log(`  Gross Amount: ${(details.rewards / 100000000).toFixed(8)} EVR`);
        console.log(`  Pool Fee: ${(details.fees / 100000000).toFixed(8)} EVR`);
        console.log(`  Net Payout: ${(details.payout / 100000000).toFixed(8)} EVR`);
    }

    // Final Transaction Outputs
    console.log('\n--- Final Transaction Outputs ---');
    const totalOutputAmount = Object.values(outputs).reduce((sum, amount) => sum + amount, 0);
    
    for (const [address, amount] of Object.entries(outputs)) {
        const percentage = ((amount / totalOutputAmount) * 100).toFixed(2);
        const role = address === options.feeAddress ? '(pool fee)' : '(worker)';
        console.log(`${address} ${role}: ${amount.toFixed(8)} EVR (${percentage}%)`);
    }

    // Note about network fee
    console.log(`Network Fee: Will be calculated by fundrawtransaction`);
    
    console.log('========================\n');
}

async function createPayoutTransaction(poolAddress) {
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

            // Calculate the payouts based on available balance
            const payoutsData = await calculatePayouts(null, availableBalance, poolAddress);

            // Check if there are any shares to distribute
            if (payoutsData.poolShares === 0 || Object.keys(payoutsData.payouts).length === 0) {
                console.log('No valid shares or payouts to distribute. Skipping payout.');
                resolve(null);
                return;
            }

            const payouts = payoutsData.payouts;
            
            // Create outputs object for createrawtransaction
            let outputs = {};
            let totalOutput = 0;
            let totalWorkerPayout = 0;
            let totalPoolFee = 0;

            for (const [address, details] of Object.entries(payouts)) {
                const workerPayout = parseInt(details.payout || 0) / 100000000; // Convert to EVR
                const poolFee = parseInt(details.fees || 0) / 100000000; // Convert to EVR

                outputs[address] = workerPayout;
                totalWorkerPayout += workerPayout;
                totalPoolFee += poolFee;
            }

            // Add the pool fee address output
            outputs[options.feeAddress] = totalPoolFee;
            totalOutput = totalWorkerPayout + totalPoolFee;

            // Verify total output doesn't exceed available balance
            if (totalOutput > availableBalance) {
                console.log('Warning: Total output would exceed available balance, reducing payouts proportionally');
                const reductionFactor = availableBalance / totalOutput;
                for (const address in outputs) {
                    outputs[address] = Number((outputs[address] * reductionFactor).toFixed(8));
                }
            }

            // Print transaction summary
            printTransactionSummary(availableBalance, payoutsData, outputs);

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

                    // Only sign the transaction if there are pool shares
                    if (payoutsData.poolShares > 0) {
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
                    } else {
                        console.log('No pool shares available, skipping transaction signing.');
                        resolve(null);
                    }
                });
            });
        }).catch(error => {
            console.log('Error in createPayoutTransaction:', error);
            resolve(null);
        });
    });
}

module.exports = {
    createPayoutTransaction,
    getPoolBalance
}