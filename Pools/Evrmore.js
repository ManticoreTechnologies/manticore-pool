const Pool = require('./Pool.js');
const {calculateHashrate} = require('../utility/calculateHashrate.js');

class EvrmorePool extends Pool {
    constructor(options, database, severity = 'info'){

        // Setup logging
        const log = function(message){
            console.log("EvrmorePool: " + message);
        };


        // Create the autorize function
        const authorizationFunction = async function(ip, port, workerName, password, extraNonce1, version, callback){
            
            // Try get the worker from the database
            const worker = await database.getWorker(workerName);

            // Check if the worker exists
            if (!worker){
                // Create a new worker
                const newWorker = {
                    worker_name: workerName,
                    worker_ip: ip,
                    worker_port: port,
                    worker_password: password,
                    worker_status: 'active',
                    worker_last_active: new Date().toISOString()
                };
                // Save the worker to the database
                await database.saveWorker(newWorker);
                
                // Increment the total workers
                database.incrementPoolStats(['total_workers'], [1]);
                // Authorize the worker
                console.log("Authorized new worker");
                callback(true);
            }else{      
                // Get the worker password
                const worker_password = worker.worker_password;

                // Check if the password is correct
                if (password === worker_password){
                    console.log("Authorized worker");
                    callback(true);
                } else {
                    console.log("Unauthorized worker");
                    callback(false);
                }
            }
        };

        // Create the pool
        super(options, authorizationFunction);

        // Save the options 
        this.options = options;

        // Save the database
        this.database = database;

        // Save the logging function
        this.log = log;

        // Save the authorization function
        this.authorizationFunction = authorizationFunction;

        // Log the start of the pool
        this._pool.on('started', () => {
            this.log("Pool started");
        });

        // Log the pool logs
        this._pool.on('log', (severity, message) => {
            if (severity === this.severity) this.log("Pool log: " + severity + " - " + message);
        });

        // Log the pool difficulty update
        this._pool.on('difficultyUpdate', (workerName, diff) => {

            // Update the worker difficulty
            this.database.updateWorkerDifficulty(workerName, diff);

            this.log("Pool difficulty update: " + workerName + " - " + diff);
        });
        

        // Log when a worker is banned
        this._pool.on('banIP', (ip, workerName) => {
            this.log("Ban IP: " + ip + " - " + workerName);
        });

        // Listeners, we need share, newBlock
        this._pool.on('share', async (isValidShare, isValidBlock, shareData) => { 

            // Format the share for the database
            const share = {
                worker_name: shareData.worker,
                worker_ip: shareData.ip,
                worker_port: shareData.port,
                share_job: shareData.job,
                share_difficulty: shareData.shareDiff,
                share_valid: isValidShare,
                share_block_valid: isValidBlock,
                target_difficulty: shareData.difficulty,
                block_difficulty: shareData.blockDiff,
                block_difficulty_actual: shareData.blockDiffActual,
                block_hash: shareData.blockHash,
                block_hash_invalid: shareData.blockHashInvalid,
                block_reward: shareData.blockReward,
                block_height: shareData.height,
                timestamp: shareData.submitTime,
            }
            
            // Save the share to the database, dont wait for it to save since 
            this.database.saveShare(share);

            // Check if this is a valid block
            if (isValidBlock){
                // Save the block to the database
                const block = {
                    hash: shareData.blockHash,
                    worker_name: shareData.worker,
                    submit_time: shareData.submitTime,
                    height: shareData.height,
                    reward: shareData.blockReward,
                    confirmed: true,
                    confirmations: 0,
                    difficulty: shareData.blockDiff,
                    share_difficulty: shareData.shareDiff,
                    share_difficulty_actual: shareData.blockDiffActual,
                    block_hash_invalid: shareData.blockHashInvalid,
                    block_reward: shareData.blockReward,
                    block_height: shareData.height,
                }
                this.database.saveBlock(block);
            } 


            // Now we should increment the worker and pool stats
            // lets start with the pool stats, no need  to wait for it to save
            this.database.incrementPoolStats([
                'total_shares', 
                'total_accepted',
                'total_rejected',
                'total_blocks',
                'total_rewards'
            ], [
                1, 
                isValidShare ? 1 : 0,
                isValidShare ? 0 : 1,
                isValidBlock ? 1 : 0,
                isValidBlock ? shareData.blockReward : 0,
            ]);

         /*   { job: '000000000000000000000000000000000000000000000000000000000000ccd2',
                ip: '::ffff:127.0.0.1',
                port: 3334,
                worker: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
                height: 1381,
                blockReward: 277800000000,
                difficulty: 0.003,
                shareDiff: '0.00904921',
                submitTime: 1735627580355,
                blockDiff: 0.003891051,
                blockDiffActual: 0.003891051,
                blockHash: '0000006e8157f709e2252557f820e0e1a4bc23b67da0d76a111d2e291865ff15',
                blockHashInvalid: undefined,
                txHash: '604e0bfbb81fb23db2bb5951e8ed649b685c476992da94a8ed084e56e754b9fd' }*/
            // TODO: Update the worker stats
            //this.database.updateWorkerStats()

            // TODO: Update the pool stats

            
            
        });

        this._pool.on('newBlock', (block) => {

            
            // TODO: Update the block stats

            /*
            BlockTemplate {
  rpcData: 
   { capabilities: [ 'proposal' ],
     version: 805306368,
     rules: [],
     vbavailable: {},
     vbrequired: 0,
     previousblockhash: '000000c53c0493322a2ac83316c882889ae04dd00a5766b9cd9cd13e3bd396b4',
     transactions: [],
     coinbaseaux: { flags: '' },
     coinbasetxn: { minerdevfund: [Object] },
     coinbasevalue: 277800000000,
     longpollid: '000000c53c0493322a2ac83316c882889ae04dd00a5766b9cd9cd13e3bd396b4281',
     target: '000000ffff000000000000000000000000000000000000000000000000000000',
     mintime: 1735450882,
     mutable: [ 'time', 'transactions', 'prevblock' ],
     noncerange: '00000000ffffffff',
     sigoplimit: 80000,
     sizelimit: 8000000,
     weightlimit: 8000000,
     curtime: 1735624845,
     bits: '1e00ffff',
     height: 1356,
     default_witness_commitment: '6a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf9',
     rewardFees: 0 },
  jobId: '000000000000000000000000000000000000000000000000000000000000cccd',
  target: <BigNum 6901641034498895230248057944249341782018790077074986006051269912821760>,
  target_hex: '000000ffff000000000000000000000000000000000000000000000000000000',
  difficulty: 0.003891051,
  rewardFees: 0,
  genTx: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0a024c05006b6177706f77ffffffff0300715a363a0000001976a914d719bcc96bb48bf0764772e0b05f340af453c70588ac0029d1770600000017a914a78f72cdb3a7ee5f09d5259ae7eb64231858bdc2870000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900000000',
  genTxHash: '1b29a0e6fb3e9edc59a0541bb5f065d9df06251609e374eb437dce4165dbff96',
  prevHashReversed: 'b496d33b3ed19ccdb966570ad04de09a8882c81633c82a2a3293043cc5000000',
  merkleRoot: '96ffdb6541ce7d43eb74e309162506dfd965f0b51b54a059dc9e3efbe6a0291b',
  txCount: 1,
  merkleRootReversed: '1b29a0e6fb3e9edc59a0541bb5f065d9df06251609e374eb437dce4165dbff96',
  serializeHeader: [Function],
  serializeBlock: [Function],
  registerSubmit: [Function],
  epoch_number: 0,
  getJobParams: [Function] }
            */
        });


    }
}

module.exports = EvrmorePool;