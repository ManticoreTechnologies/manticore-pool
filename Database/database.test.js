const {getDatabase} = require('./database.js');

async function purgeAndSetup(){

    // Purge and setup the database (verbose, purge)
    const cockroach = await getDatabase(true, true);

    // Get the pool database
    const database = cockroach.database('pool');

    // List the tables in the pool database
    const tables = await database.listTables();

    // It should have all the tables in Schema directory
    console.log(tables);
}

async function testSaveShare(){
    const database = await getDatabase('EVRPool', true, false);
    const isValidShare = true;
    const isValidBlock = false;
    const shareData = { job: '000000000000000000000000000000000000000000000000000000000000ccd0',
        ip: '::ffff:127.0.0.1',
        port: 3334,
        worker: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
        height: 1274,
        blockReward: 277800000000,
        difficulty: 0.003,
        shareDiff: '0.00389407',
        submitTime: 1735448659039,
        blockDiff: 0.003891051,
        blockDiffActual: 0.003891051,
        blockHash: '00000100cbef7b38f49df9f29d020329394bbcd19809d0afbde971ed624829a7',
        blockHashInvalid: undefined,
        error: { unknown: 'check coin daemon logs' } } ;
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
        error: shareData.error}
    database.saveShare(share);
    const shares = await database.getShares(2);
    console.log(shares);
        
}


async function testSaveWorker(){
    const database = await getDatabase('EVRPool', true, false);
    const worker = {    
        worker_name: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
        worker_address: '0x0000000000000000000000000000000000000000',
        worker_ip: '::ffff:127.0.0.1',
        worker_port: 3334,
        worker_password: 'X',
        worker_status: 'active',
        worker_last_active: new Date().toISOString()
    };

    // Save the worker, update if already exists
    console.log("Saving worker ");
    await database.saveWorker(worker);
    console.log("Worker saved");
    const workers = await database.getWorkers();
    console.log(workers);
}

async function testAuthorizeWorker(password_to_check){
    const database = await getDatabase('EVRPool', true, false);
    const worker = await database.getWorker('ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker');
    const password = worker.worker_password;
    console.log(password === password_to_check);
}

async function testSaveBlock(){
    const database = await getDatabase('EVRPool', true, false);
    const block = {
        hash: '00000100cbef7b38f49df9f29d020329394bbcd19809d0afbde971ed624829a7',
        worker_name: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
        submit_time: 1735448659039,
        height: 1274,
        reward: 277800000000,
        confirmed: true,
        confirmations: 101,
        difficulty: 0.003,
        share_difficulty: 0.00389407,
        share_difficulty_actual: 0.003891051,
        block_hash_invalid: false,
        block_reward: 277800000000,
        block_height: 1274,
    };
    database.saveBlock(block);
    const blocks = await database.getBlocks();
    console.log(blocks);
}

async function testPoolStats(){
    const database = await getDatabase('evrpool', true, false);
    const isValidShare = true;
    const isValidBlock = false;
    const shareData = { job: '000000000000000000000000000000000000000000000000000000000000ccd0',
        ip: '::ffff:127.0.0.1',
        port: 3334,
        worker: 'ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker',
        height: 1274,
        blockReward: 277800000000,
        difficulty: 0.003,
        shareDiff: '0.00389407',
        submitTime: 1735448659039,
        blockDiff: 0.003891051,
        blockDiffActual: 0.003891051,
        blockHash: '00000100cbef7b38f49df9f29d020329394bbcd19809d0afbde971ed624829a7',
        blockHashInvalid: undefined,
        error: { unknown: 'check coin daemon logs' } } ;
    database.incrementPoolStats([
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
    const stats = await database.getPoolStats('evrpool');
    console.log(stats);
}

async function testUpdateWorkerDifficulty(){
    const database = await getDatabase('evrpool', true, false);
    await database.updateWorkerDifficulty('ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker', 0.003);
    const worker = await database.getWorker('ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker');
    console.log(worker);
}

async function testActiveWorkersCount(){
    const database = await getDatabase('evrpool', true, false);
    // update the worker last active time to now    
    const count = await database.getActiveWorkersCount();
    console.log(count);
}

async function testUpsertPoolStats(){
    const database = await getDatabase('evrpool', true, true);
    const pool_stats = {
        name: 'evrpool',
        total_workers: 100,
        total_shares: 1000,
        total_accepted: 100,
        total_rejected: 0,
        total_difficulty: 0.003,
        total_hashrate: 0,
        total_blocks: 100,
    }
    await database.upsertPoolStats(pool_stats);
}

async function testLastXWorkerShareTimes(){
    const database = await getDatabase('evrpool', true, false);
    const times = await database.getLastXWorkerShareTimes('ELWj7f95NgAAecYyQMxY9RTx4kvrG5TgFW.worker', 10);
    console.log(times);
}

async function testNetworkStats(){
    const database = await getDatabase('evrpool', true, false);
    const stats = await database.getNetworkStats();
    console.log(stats);
}


// Test the purge and db setup  
//purgeAndSetup();

//testSaveWorker();
//testSaveBlock();
//testPoolStats();
//testUpdateWorkerDifficulty();
//testActiveWorkersCount();
//testUpsertPoolStats();
testLastXWorkerShareTimes();