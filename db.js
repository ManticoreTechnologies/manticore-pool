const db = require('./database/db.js');
const { getConnected } = require('./database/db.js');

// Add up the total roundshares for each worker in the pool and return the total
async function getPoolRoundShares() {
  return db.query(`SELECT SUM(roundshares) AS total FROM workershare`)
    .then(result => result.rows[0].total);
}

// Set the pool round shares
async function setPoolRoundShares(roundShares) {
  return db.query(`UPDATE workershare SET roundshares = $1`, [roundShares]);
}









  

async function getAddress(address) {
  const address = await db.query(`SELECT * FROM Address WHERE address = $1`, [address])
  .then(result => result.rows.length > 0 ? new Address(result.rows[0]) : new Address({address: address}));
  return address;
}
/* Address class for managing a single address (e.g. EGcNAxXXXXXXXXXXXXNkd) */
class Address {

  constructor(addressData) {
    Object.assign(this, addressData);
  }

}

async function getPool() {
  const pool = await db.query(`SELECT * FROM PoolStats LIMIT 1`)
  .then(result => result.rows.length > 0 ? new Pool(result.rows[0]) : new Pool({}));
  return pool;
}
/* Pool class for managing the pool stats */
class Pool {

  constructor(poolData) {
    Object.assign(this, poolData);
  }

}

async function getNetwork() {
  const network = await db.query(`SELECT * FROM Network LIMIT 1`)
  .then(result => result.rows.length > 0 ? new Network(result.rows[0]) : new Network({}));
  return network;
}
/* Network class for managing the network stats */
class Network {

  constructor(networkData) {
    Object.assign(this, networkData);
  }

}

maxHistory = 5;
class WorkerShareModel {
  constructor(data) {
    Object.assign(this, data);
  }
  getHistoricalShareDifficulty() {
    return JSON.parse(this.historicalShareDifficulty);
  }
  addToHistoricalShareDifficulty(shareDifficulty) {
    const historicalShareDifficulty = this.getHistoricalShareDifficulty();
    historicalShareDifficulty.push(shareDifficulty);
    if (historicalShareDifficulty.length > maxHistory) {
      historicalShareDifficulty.shift();
    }
    db.query(
      `UPDATE WorkerShare
      SET historicalShareDifficulty = $1
      WHERE workerName = $2`,
      [JSON.stringify(historicalShareDifficulty), this.workerName]
    );
  }
  getHistoricalShareTimes() {
    return JSON.parse(this.historicalShareTimes);
  }

  addToHistoricalShareTimes(shareTime) {
    const historicalShareTimes = this.getHistoricalShareTimes();
    
    historicalShareTimes.push(shareTime);
    
    if (historicalShareTimes.length > maxHistory) {
      historicalShareTimes.shift();
    }
    
    db.query(
      `UPDATE WorkerShare
      SET historicalShareTimes = $1
      WHERE workerName = $2`,
      [JSON.stringify(historicalShareTimes), this.workerName]
    );
}
  
  getHistoricalHashrate() {
    return JSON.parse(this.historicalHashrate);
  }

  addToHistoricalHashrate(hashrate) {
    const historicalHashrate = this.getHistoricalHashrate();
    
    historicalHashrate.push(hashrate);
    
    if (historicalHashrate.length > 5) {
      historicalHashrate.shift();
    }
    
    db.query(
      `UPDATE WorkerShare
      SET historicalHashrate = $1
      WHERE workerName = $2`,
      [JSON.stringify(historicalHashrate), this.workerName]
    );
  }

  setHashrate(hashrate) {
    db.query(
      `UPDATE WorkerShare
      SET hashrate = $1
      WHERE workerName = $2`,
      [hashrate, this.workerName]
    );
  }
  updateHashrate(hashrate) {
    this.addToHistoricalHashrate(hashrate);
    this.setHashrate(hashrate);
  }
  setLastShareTime(lastShareTime) {
    db.query(
      `UPDATE WorkerShare
      SET lastShareTime = $1
      WHERE workerName = $2`,
      [lastShareTime, this.workerName]
    );
  }

  incrementValid() {
    console.log('incrementValid: '+this.workerName);
    db.query(
      `UPDATE WorkerShare
      SET valid = valid + 1
      WHERE workerName = $1`,
      [this.workerName]
    );
  }

  incrementInvalid() {
    console.log('incrementInvalid: '+this.workerName);
    db.query(
      `UPDATE WorkerShare
      SET invalid = invalid + 1
      WHERE workerName = $1`,
      [this.workerName]
    );
  }
  incrementTotalShares() {
    console.log('incrementTotalShares: '+this.workerName);
    db.query(
      `UPDATE WorkerShare
      SET totalShares = totalShares + 1
      WHERE workerName = $1`,
      [this.workerName]
    );
  }
  incrementBlocks() {
    console.log('incrementBlocks: '+this.workerName);
    db.query(
      `UPDATE WorkerShare
      SET blocks = blocks + 1
      WHERE workerName = $1`,
      [this.workerName]
    );
  }


  incrementRoundShares() {
    console.log('incrementRoundShares: '+this.workerName);
    db.query(
      `UPDATE WorkerShare
      SET roundShares = roundShares + 1
      WHERE workerName = $1`,
      [this.workerName]
    );
  }

  save(callback) {
    callback = callback || function() {};
    
    const params = [
      parseInt(this.valid || 0),
      parseInt(this.invalid || 0),
      parseInt(this.blocks || 0),
      parseInt(this.hashrate || 0),
      parseInt(this.roundShares || 0),
      parseInt(this.totalShares || 0),
      parseInt(this.lastShareTime || Date.now()),
      this.workerName
    ];

    db.query(
      `UPDATE WorkerShare 
       SET valid = valid + $1,
           invalid = invalid + $2,
           blocks = blocks + $3,
           hashrate = $4,
           roundShares = roundShares + $5,
           totalShares = totalShares + $6,
           lastShareTime = $7
       WHERE workerName = $8`,
      params,
      function(err) {
        if (err) {
          callback(err);
          return;
        }
        if (this.rowCount === 0) {
          // If no row was updated, create a new one
          WorkerShare.create(this, callback);
        } else {
          callback(null, this);
        }
      }
    );
  }
}



// Worker Share methods
const WorkerShare = {


  // For our worker share we need to have mutators for every column
  // Current columns are valid, invalid, blocks, hashrate, roundShares, totalShares, lastShareTime, historicalShareTimes, historicalShareDifficulty, historicalHashrate, historicalPayout, paid, unpaid
  // This is just to wrap methods mutating or accessing a single worker (e.g. EGcNAxXXXXXXXXXXXXNkd.worker1)
  
  /* General Mutators */

  // Find

  // General accessors 





  findAll: function() {
    return db.query('SELECT * FROM WorkerShare')
      .then(result => result.rows.map(row => new WorkerShareModel(row)));
  },
  sum: function(column) {
    return db.query(`SELECT SUM(${column}) AS total FROM WorkerShare`)
      .then(result => result.rows[0].total);
  },
  findAllActive: function() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000; // 5 minutes in milliseconds
    return db.query(`SELECT * FROM WorkerShare WHERE lastShareTime >= $1`, [fiveMinutesAgo])
      .then(result => result.rows.map(row => new WorkerShareModel(row)));
  },


  getTotalHashrate: function() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000; // 5 minutes in milliseconds
    return db.query(`SELECT SUM(hashrate) AS totalHashrate FROM WorkerShare WHERE lastShareTime >= $1`, [fiveMinutesAgo])
      .then(result => result.rows[0].totalHashrate * 1000000);
  },
  //Calculate and return the name and share percantage of each miner so miner shares / total pool shares
  getPoolRoundShares: function() {
    return db.query(`SELECT SUM(roundShares) AS totalRoundShares FROM WorkerShare`)
      .then(result => result.rows[0].totalRoundShares);
  },
  //Get a list of all workers and their valid shares  
  getWorkerShares: function() {
    return db.query(`SELECT workerName, valid FROM WorkerShare`)
      .then(result => result.rows);
  },
  count: function() {
    return db.query(`SELECT COUNT(*) FROM WorkerShare`)
      .then(result => result.rows[0].count);
  },
  findOne: function({ where }) {
    return db.query(`SELECT * FROM WorkerShare WHERE workerName = $1`, [where.workerName])
      .then(result => result.rows.length > 0 ? new WorkerShareModel(result.rows[0]) : null);
  },
  updateHashrate: function(workerName, hashrate) {
    console.log('updateHashrate: '+workerName+' '+hashrate);
    db.query(
      `UPDATE WorkerShare SET hashrate = $1 WHERE workerName = $2`,
      [hashrate, workerName]
    );
  },
  updateLastShareTime: function(workerName, lastShareTime) {
    db.query(
      `UPDATE WorkerShare SET lastShareTime = $1 WHERE workerName = $2`,
      [lastShareTime, workerName]
    );
  },
  clearHistory: function(workerName) {
    db.query(
      `UPDATE WorkerShare SET historicalShareTimes = $1, historicalShareDifficulty = $2, historicalHashrate = $3, historicalPayout = $4 WHERE workerName = $5`,
      [JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), workerName]
    );
  },
  getHistoricalShareTimes: async function(workerName) {
    return db.query(`SELECT historicalShareTimes FROM WorkerShare WHERE workerName = $1`, [workerName])
      .then(result => result.rows.length > 0 ? JSON.parse(result.rows[0].historicalShareTimes) : []);
  },
  updateHistoricalShareTimes: async function(workerName, shareTime) {
    const historicalShareTimes = await this.getHistoricalShareTimes(workerName);  
    const updatedShareTimes = historicalShareTimes;
    updatedShareTimes.push(shareTime);
    if (updatedShareTimes.length > 20) {
      updatedShareTimes.shift();
    }
    db.query(
      `UPDATE WorkerShare SET historicalShareTimes = $1 WHERE workerName = $2`,
      [JSON.stringify(updatedShareTimes), workerName]
    );
  },
  getHistoricalHashrate: async function(workerName) {
    return new Promise(async (resolve, reject) => {
      db.query(`SELECT historicalHashrate FROM WorkerShare WHERE workerName = $1`, [workerName])
        .then(result => {
          try {
            const jsonData = result.rows.length > 0 ? result.rows[0].historicalhashrate : [];
          try{
            const historicalHashrate = JSON.parse(jsonData);
            resolve(historicalHashrate);
          } catch (error) {
            console.error('Failed to parse historicalHashrate:', error);  
            resolve([]);
          }
        } catch (error) {
          console.error('Failed to fetch historicalHashrate:', error);
          resolve([]);
        }
      });
    });
  },
  getAddressWorkers: function(address) {
    return db.query(`SELECT * FROM WorkerShare WHERE workerName LIKE $1`, [address+'%'])
      .then(result => result.rows);
  },
  getAddressHashrate: function(workerName) {
    const address = workerName.split('.')[0];
    return db.query(`SELECT SUM(hashrate) AS totalHashrate FROM WorkerShare WHERE workerName LIKE $1`, [address+'%'])
      .then(result => result.rows.length > 0 ? result.rows[0].totalHashrate : 0);
  },
  updateHistoricalHashrate: async function(workerName, hashrate) {
    console.log('updateHistoricalHashrate: '+workerName+' '+hashrate);
    return new Promise(async (resolve, reject) => {
      if (hashrate==null) {
        reject('Hashrate is null');
        return;
      }
      if (isNaN(hashrate)) {
        reject('Hashrate is not a number');
        return;
      }
      const historicalHashrate = await this.getHistoricalHashrate(workerName);
      if (historicalHashrate==null) {
        reject('Historical hashrate is null');
        return;
      } if (historicalHashrate == undefined) {
        reject('Historical hashrate is undefined');
        return;
      }
      historicalHashrate.push(hashrate);  
      if (historicalHashrate.length > 86400) {
        historicalHashrate.shift();
      }
      db.query(
        `UPDATE WorkerShare SET historicalHashrate = $1 WHERE workerName = $2`,
        [JSON.stringify(historicalHashrate), workerName]
      );
      resolve();
    });
  },
  getAverageShareTime: async function(workerName) {
    return db.query(`SELECT AVG(lastShareTime) AS average_share_time FROM WorkerShare WHERE workerName = $1`, [workerName])
      .then(function(result) {
        return result.rows.length > 0 ? result.rows[0].average_share_time : 0;
      });
  },
  create: function(data, callback) {
    callback = callback || function() {};
    
    if (!data || !data.workerName) {
      callback(new Error('Worker name is required'));
      return;
    }

    const params = [
      data.workerName,
      data.lastShareTime || Date.now(),
      data.hashrate || 0
    ];

    db.query(
      `INSERT INTO WorkerShare (workerName, lastShareTime, hashrate) 
       VALUES ($1, $2, $3) RETURNING id`,
      params
    )
      .then(function(result) {
        var newWorker = new WorkerShareModel({
          id: result.rows[0].id,
          workerName: data.workerName,
          valid: 0,
          invalid: 0,
          blocks: 0,
          hashrate: data.hashrate || 0,
          roundShares: 0,
          totalShares: 0,
          lastShareTime: data.lastShareTime || Date.now()
        });
        callback(null, newWorker);
      })
      .catch(function(err) {
        callback(err);
      });
  }
};

// Pool Stats methods
const PoolStats = {
  findOne: function(callback) {
    callback = callback || function() {};
    db.query(`SELECT * FROM PoolStats LIMIT 1`)
      .then(result => result.rows.length > 0 ? new WorkerShareModel(result.rows[0]) : null)
      .then(callback);
  },
  
  create: function(data, callback) {
    callback = callback || function() {};
    db.query(
      `INSERT INTO PoolStats (blocks) VALUES ($1)`,
      [data.blocks || 0]
    )
      .then(result => callback(null, Object.assign({}, data, { id: result.rows[0].id })))
      .catch(err => callback(err));
  },
  getRoundShares: function() {
    return db.query(`SELECT SUM(roundShares) AS totalRoundShares FROM WorkerShare`)
      .then(result => result.rows[0].totalRoundShares);
  },
  endRound: function() {
    db.query(`UPDATE WorkerShare SET roundShares = 0`);
  },
  getWorkersRoundShares: function() {
    return db.query(`SELECT workerName, roundShares FROM WorkerShare`)
      .then(result => result.rows);
  },
  update: function(data, callback) {
    callback = callback || function() {};
    db.query(
      `UPDATE PoolStats SET blocks = $1 WHERE id = $2`,
      [data.blocks || 0, data.id]
    )
      .then(() => callback(null, data))
      .catch(err => callback(err));
  }
};

const NetHashHistory = {
  findAll: function() {
    return db.query(`SELECT * FROM netHashHistory`)
      .then(result => result.rows);
  },
  update: function(hashrate, timestamp) {
    db.query(
      `INSERT INTO netHashHistory (hashrate, timestamp) VALUES ($1, $2)`,
      [hashrate, timestamp]
    );
  },
  getRange: function(start, end) {
    return db.query(`SELECT * FROM netHashHistory WHERE timestamp >= $1 AND timestamp <= $2`, [start, end])
      .then(result => result.rows);
  },
  getAggregatedTickers: function(intervalInMilliseconds, maxHistory=25) {
    return db.query(`
      SELECT 
        (timestamp / $1) * $1 AS interval_start,
        AVG(hashrate) AS avg_hashrate
      FROM netHashHistory
      GROUP BY interval_start
      ORDER BY interval_start DESC
      LIMIT $2
    `, [intervalInMilliseconds, maxHistory])
      .then(result => result.rows.map(row => ({
        interval_start: row.interval_start,
        avg_hashrate: row.avg_hashrate
      })));
  }
}

const NetDifficultyHistory = {
  update: function(difficulty, timestamp) {
    db.query(`INSERT INTO netDifficultyHistory (difficulty, timestamp) VALUES ($1, $2)`, [difficulty, timestamp]);
  },
  getAggregatedTickers: function(intervalInSeconds, maxHistory=25) {
    return db.query(`
      SELECT 
        (timestamp / $1) * $1 AS interval_start,
        AVG(difficulty) AS avg_difficulty
      FROM netDifficultyHistory
      GROUP BY interval_start
      ORDER BY interval_start DESC
      LIMIT $2
    `, [intervalInSeconds, maxHistory])
      .then(result => result.rows);
  }
}

const NetAssetHistory = {
  update: function(asset, timestamp) {
    db.query(`INSERT INTO netAssetHistory (asset, timestamp) VALUES ($1, $2)`, [asset, timestamp]);
  },
  getAggregatedTickers: function(intervalInSeconds, maxHistory=25) {
    return db.query(`
      SELECT 
        (timestamp / $1) * $1 AS interval_start,
        AVG(asset) AS asset_count
      FROM netAssetHistory
      GROUP BY interval_start
      ORDER BY interval_start DESC
      LIMIT $2
    `, [intervalInSeconds, maxHistory])
      .then(result => result.rows);
  }
}


const NetBlockSizeHistory = {
  update: function(blockSize, height) {
    return db.query(`
      UPSERT INTO netBlockSizeHistory (height, blockSize) 
      VALUES ($1, $2)
    `, [height, blockSize])
      .catch(function(err) {
        console.error('Error updating block size history:', err);
      });
  },
  getAggregatedTickers: function(maxHistory=25) {
    return db.query(`
      SELECT 
        height as start_height,
        blockSize as avg_blockSize
      FROM netBlockSizeHistory
      ORDER BY height DESC
      LIMIT $1
    `, [maxHistory])
      .then(result => result.rows);
  }
}

console.log('Database initialized successfully!');

module.exports = { 
  WorkerShare, 
  PoolStats, 
  NetHashHistory, 
  NetDifficultyHistory, 
  NetAssetHistory,
  NetBlockSizeHistory,
  getConnected,
  getWorker,
  getPool,
  getPoolRoundShares,
  setPoolRoundShares,
  getAllWorkerShares,
  getActiveWorkersHashrate,
  getActiveWorkersCount
}; 