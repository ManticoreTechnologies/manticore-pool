const { getPoolDatabase } = require('./db.js');

/*
    Current fields:
    { name: 'id', type: 'SERIAL PRIMARY KEY' },
    { name: 'poolName', type: 'TEXT UNIQUE NOT NULL' },
    { name: 'poolHashrate', type: 'INT DEFAULT 0' },
    { name: 'poolDifficulty', type: 'INT DEFAULT 0' },
    { name: 'poolAsset', type: 'INT DEFAULT 0' },
    { name: 'poolBlockSize', type: 'INT DEFAULT 0' },
*/

class Pool {
    
    constructor(poolData) {
  
        // Assign the worker data to the worker object
        Object.assign(this, poolData);
  
    }

    async updatePoolHashrate(hashrate, db=null){
        if (db == null){
            db = await getPoolDatabase();
        }
        await db.query(`UPDATE pool_stats SET poolHashrate = ${hashrate} WHERE poolName = '${this.poolName}'`);
    }

    async updatePoolDifficulty(difficulty, db=null){
        if (db == null){
            db = await getPoolDatabase();
        }
        await db.query(`UPDATE pool_stats SET poolDifficulty = ${difficulty} WHERE poolName = '${this.poolName}'`);
    }

    // updates the asset counts 
    async updatePoolAsset(asset, db=null){
        if (db == null){
            db = await getPoolDatabase();
        }
        await db.query(`UPDATE pool_stats SET poolAsset = ${asset} WHERE poolName = '${this.poolName}'`);
    }


    
}