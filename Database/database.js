// Purpose: This file is our entry point for the database module
const {setupDatabase} = require('./Init/setupDatabase.js');
const {createDaemon} = require('../utility/evr_daemon.js');
const {options} = require('../config.dev.js');
class PoolDatabase {
    constructor(cockroachdb, name){
        this.cockroachdb = cockroachdb;
        this.name = name.toLowerCase();
        this.daemon = createDaemon(options);
    }

    // Insert a row into a table
    async insert(table, data){
        await this.cockroachdb.database(this.name).table(table).insert(data).execute();
    }

    async select_many(table, columns, limit){
        const data = await this.cockroachdb.database(this.name).table(table).select(columns).limit(limit).orderBy('timestamp', 'desc').execute();
        return data;
    }

    saveShare(share){
        this.cockroachdb.database(this.name).table('shares').insert(share).execute();
    }

    async getShares(limit=100){
        const shares = await this.cockroachdb.database(this.name).table('shares').select("*").limit(limit).execute();
        return shares;
    }

    async saveWorker(worker){
        await this.cockroachdb.database(this.name).table('workers').upsert(worker).execute();
    }

    async saveBlock(block){
        await this.cockroachdb.database(this.name).table('blocks').upsert(block).execute();
    }

    async getBlocks(limit=100){
        const blocks = await this.cockroachdb.database(this.name).table('blocks').select("*").limit(limit).execute();
        return blocks;
    }

    async getWorkers(){
        const workers = await this.cockroachdb.database(this.name).table('workers').select("*").execute();
        return workers;
    }

    async getWorker(workerName){
        const worker = await this.cockroachdb.database(this.name).table('workers').select("*").where(`worker_name='${workerName}'`).execute();
        return worker;
    }

    async updateWorkerDifficulty(workerName, difficulty){
        await this.cockroachdb.database(this.name).table('workers').column('worker_difficulty').update(difficulty).where([`worker_name='${workerName}'`]).execute();
    }

    async getPoolStats(name='pool'){
        const stats = await this.cockroachdb.database(this.name).table('poolstats').select("*").where(`name='${this.name}'`).execute();
        return stats;
    }

    async upsertPoolStats(stats){
        await this.cockroachdb.database(this.name).table('poolstats').upsert(stats).execute();
    }

    async incrementPoolStats(columns, values){    
        await this.cockroachdb.database(this.name).table('poolstats').columns(columns).increment(values).where([`name='${this.name}'`]).execute();
    }
    

    async getActiveWorkersCount(){
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const workers_count = await this.cockroachdb.database(this.name)
            .table('workers')
            .count()
            .where([`worker_last_active >= '${fiveMinutesAgo}'`])
            .execute();
        return workers_count;
    }

    async getLastXWorkerShareTimes(workerName, x){
        // we have a table of shares, with a column of submitTime, we need a list of the deltas between the submitTime and the last submitTime, just get the last x shares
        const shares = await this.cockroachdb.database(this.name).table('shares').select("timestamp").where(`worker_name='${workerName}'`).orderBy("timestamp", "desc").limit(x).execute();
        const shareTimes = shares.reverse().map(share => share.timestamp);
        const deltas = shareTimes.map((time, index) => index > 0 ? time - shareTimes[index - 1] : 0);
        return deltas;
    }

    async calculateWorkerHashrate(workerName, shareData){
        const lastXShareTimes = await this.getLastXWorkerShareTimes(workerName, 10);
        const hashrate = calculateHashrate(workerName, shareData, lastXShareTimes);
        return hashrate;
    }

    async fetchNetworkStats(){
        const stats = await this.daemon.cmd('getnetworkhashps');
        return stats;
    }




}

async function getDatabase(name='pool', verbose = true, purge = false){
    const cockroachdb = await setupDatabase(name, verbose, purge);
    return new PoolDatabase(cockroachdb, name);
}

module.exports = {getDatabase};