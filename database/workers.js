const { getPoolDatabase } = require('./db.js');

class Worker {

    constructor(workerData) {
  
      // Assign the worker data to the worker object
      Object.assign(this, workerData);

    }
  
    /* Increment Mutators */ /* Tested: Working!  */
    incrementValidShares(shares=1) {
      Workers.getUpdateBuffer(this.workername).valid += parseInt(shares);
      console.log('incrementValidShares: '+Workers.getUpdateBuffer(this.workername).valid);
    }
    incrementInvalidShares(shares=1) {
      Workers.getUpdateBuffer(this.workername).invalid += parseInt(shares);
      console.log('incrementInvalidShares: '+Workers.getUpdateBuffer(this.workername).invalid);
    }
    incrementRoundShares(shares=1) {
      Workers.getUpdateBuffer(this.workername).roundshares += parseInt(shares);
      console.log('incrementRoundShares: '+Workers.getUpdateBuffer(this.workername).roundshares);
    } 
    incrementTotalShares(shares=1) {
      Workers.getUpdateBuffer(this.workername).totalshares += parseInt(shares);
      console.log('incrementTotalShares: '+Workers.getUpdateBuffer(this.workername).totalshares);
    }
    incrementPaid(paid=1) {
      Workers.getUpdateBuffer(this.workername).paid += parseInt(paid);
      console.log('incrementPaid: '+Workers.getUpdateBuffer(this.workername).paid);
    }
    incrementUnpaid(unpaid=1) {
      Workers.getUpdateBuffer(this.workername).unpaid += parseInt(unpaid);
      console.log('incrementUnpaid: '+Workers.getUpdateBuffer(this.workername).unpaid);
    }
    incrementBlocks(blocks=1) {
      Workers.getUpdateBuffer(this.workername).blocks += parseInt(blocks);  
      console.log('incrementBlocks: '+Workers.getUpdateBuffer(this.workername).blocks);
    }

    setRoundShares(roundShares) {
      Workers.getUpdateBuffer(this.workername).roundshares = roundShares;
      console.log('setRoundShares: '+Workers.getUpdateBuffer(this.workername).roundshares);
    }
    // Setter Mutators
    setHashrate(hashrate) {
      this.hashrate = hashrate;
      this.save();
    }
    setLastShareTime(lastShareTime) {
      this.lastsharetime = lastShareTime;
      this.save();
    }
    setPaid(paid) {
      this.paid = paid;
      this.save();
    }
    setUnpaid(unpaid) {
      this.unpaid = unpaid;
      this.save();
    }
  
  
    // Getters
    getPaid() {
      return this.paid;
    }
    getUnpaid() {
      return this.unpaid;
    }
    getValid() {
      return this.valid;
    }
    getInvalid() {
      return this.invalid;
    }
    getBlocks() {
      return this.blocks;
    }
    getHashrate() {
      return this.hashrate;
    }
    getRoundShares() {
      return this.roundshares;
    }
    getTotalShares() {
      return this.totalshares;
    }
    getLastShareTime() {
      return this.lastsharetime;
    }
  
  
    /* Purge Mutators */
    purgeWorkerData() {
      this.valid = 0;
      this.invalid = 0;
      this.blocks = 0;
      this.hashrate = 0;
      this.roundshares = 0;
      this.totalshares = 0;
      this.lastsharetime = 0;
      this.paid = 0;
      this.unpaid = 0;
      this.save();
    }
  
    async save() {
      await db.query(
        `UPDATE Workers SET valid = $1, invalid = $2, blocks = $3, hashrate = $4, roundshares = $5, totalshares = $6, lastsharetime = $7, paid = $8, unpaid = $9 WHERE workername = $10`,
        [
          this.valid, 
          this.invalid, 
          this.blocks, 
          this.hashrate, 
          this.roundshares, 
          this.totalshares, 
          this.lastsharetime, 
          this.paid, 
          this.unpaid, 
          this.workername
        ]
      );
    }
  
}

class Workers {
    static getUpdateBuffer(workerName) {
        if (!Workers.updateBuffer) {
            Workers.updateBuffer = {}; // Initialize the updateBuffer object if it doesn't exist
        }
        if (!Workers.updateBuffer[workerName]) {
            Workers.updateBuffer[workerName] = { valid: 0, roundshares: 0, totalshares: 0, blocks: 0, unpaid: 0, paid: 0};
        }
        if (workerName === 'testWorker') console.log(Workers.updateBuffer[workerName]);
        return Workers.updateBuffer[workerName];
    }
    static resetUpdateBuffer(workerName) {
      Workers.updateBuffer[workerName] = { valid: 0, roundshares: 0, totalshares: 0, blocks: 0, unpaid: 0, paid: 0 };
    }

    static async initWorker(workerName, db=null) {
      if (db === null) db = await getPoolDatabase();
      try {
          await db.query(`INSERT INTO Workers (workername) VALUES ($1) ON CONFLICT (workername) DO NOTHING`, [workerName]);
          Workers.getUpdateBuffer(workerName); // Ensure buffer is initialized
          return new Worker({ workername: workerName });
      } catch (error) {
          console.error('Error initializing worker:', error);
          throw error;
      }
  }
    

  static async getWorker(workerName, db=null) {
    if (db === null) db = await getPoolDatabase();
    const result = await db.query(`SELECT * FROM Workers WHERE workername = $1`, [workerName]);
    if (result.rows.length > 0) {
        Workers.getUpdateBuffer(workerName); // Ensure buffer is initialized
        return new Worker(result.rows[0]);
    } else {
        return Workers.initWorker(workerName);
    }
}
static async getLocalWorkerBuffer(workerName) {
  const buffer = Workers.getUpdateBuffer(workerName);
  return new Worker({
    workername: workerName,
    valid: parseInt(buffer.valid),
    roundshares: parseInt(buffer.roundshares),
    totalshares: parseInt(buffer.totalshares),
    blocks: parseInt(buffer.blocks),
    unpaid: parseInt(buffer.unpaid)
  });
}
    // End the round when the pool finds a block
    static async endRound(db=null, totalRoundReward=25008000000) {
        if (db === null) db = await getPoolDatabase();
        // First get all the miners that roundShares > 0
        const result = await db.query(`SELECT * FROM Workers WHERE roundShares > 0`);
        const miners = result.rows;
        const totalRoundShares = miners.reduce((sum, miner) => sum + parseInt(miner.roundshares), 0);
        for (const miner of miners) {
          console.log(miner);
          const roundShares = miner.roundshares;
          // Now with totalRoundShares and roundShares, calculate the miners share of the block reward
          const share = Math.floor(roundShares / totalRoundShares * totalRoundReward); // just leave it as a decimal

          console.log(share);

          // update the miners unpaid balance with the amount we calculated
          await db.query(`UPDATE Workers SET unpaid = unpaid + $1 WHERE workername = $2`, [share, miner.workername]);
          //Workers.getUpdateBuffer(miner.workername).unpaid += share;
          // Then reset the roundShares for all miners
          await db.query(`UPDATE Workers SET roundshares = 0`);
          // try putting this in the autoflush
          //Workers.getUpdateBuffer(miner.workername).roundshares = 0;
        }
    }

    static getActiveWorkers() {
        return db.query(`SELECT * FROM Workers WHERE lastsharetime >= $1`, [Date.now() - 5 * 60 * 1000])
        .then(result => result.rows);
    }
  
    static getActiveWorkersHashrate() {
      return new Promise((resolve, reject) => {
        db.query(`SELECT SUM(hashrate) as total FROM Workers WHERE lastShareTime >= $1`, [Date.now() - 5 * 60 * 1000], (err, result) => {
          if (err) reject(err);
          resolve(parseInt(result.rows[0].total || 0));
        });
      });
    }   

    static getActiveWorkersCount() {
      return db.query(`SELECT COUNT(*) FROM Workers WHERE lastsharetime >= $1`, [Date.now() - 5 * 60 * 1000])
        .then(result => parseInt(result.rows[0].count || 0));
    }
  

    static getAllWorkerss() {
      return db.query(`SELECT * FROM Workers`)
        .then(result => result.rows);
    }

    static async getAllWorkers(db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`SELECT * FROM Workers`)
        .then(result => result.rows.map(row => new Worker(row)));
    }

    static getTotalRoundShares() {
      return db.query(`SELECT SUM(roundshares) FROM Workers`)
        .then(result => parseInt(result.rows[0].sum || 0));''
    }

    static resetRoundShares() {
      return db.query(`UPDATE Workers SET roundshares = 0`);
    }

    // Resets all the worker data to 0
    static resetAllWorkerData() {
      return db.query(`UPDATE Workers SET valid = 0, invalid = 0, blocks = 0, hashrate = 0, roundshares = 0, totalshares = 0, lastsharetime = 0, paid = 0, unpaid = 0`);
    }

    static getTotalBlocks() {
      return db.query(`SELECT SUM(blocks) FROM Workers`)
        .then(result => parseInt(result.rows[0].sum || 0));
    }

    static async getWorkersByAddress(address, db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`SELECT * FROM Workers WHERE workername LIKE $1 || '%'`, [address])
        .then(result => result.rows);
    }
    static async getWorkersByAddresses(addresses, db=null) {
      if (db === null) db = await getPoolDatabase();
      return new Promise(async (resolve, reject) => {
        const query = `SELECT * FROM Workers WHERE workername LIKE ANY ($1)`;
        const values = [addresses.map(address => `%${address}%`)];
        const result = await db.query(query, values);
        resolve(result.rows.map(row => new Worker(row)));
      });
    }

    

    static async saveBlock(roundId, blockHash, blockHeight, blockReward, miner, difficulty, db=null) {
        if (db === null) db = await getPoolDatabase();
        
        // Get current round if roundId isn't provided
        if (!roundId) {
            const roundResult = await db.query(`SELECT round_id FROM CurrentRound WHERE status = 'active'`);
            if (roundResult.rows.length === 0) {
                // Create a new round if none exists
                const newRound = await this.startNewRound(blockHeight, difficulty, db);
                roundId = newRound.rows[0].round_id;
            } else {
                roundId = roundResult.rows[0].round_id;
            }
        }

        // Insert the block with all required fields
        await db.query(`
            INSERT INTO Blocks (
                round_id, 
                block_hash, 
                block_height, 
                reward, 
                miner, 
                difficulty,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        `, [
            roundId,
            blockHash,
            blockHeight,
            blockReward,
            miner,
            difficulty
        ]);

        // Start a new round
        await this.startNewRound(blockHeight + 1, difficulty, db);
    }

    static async getRoundId(db=null) {
        return new Promise(async (resolve, reject) => {
            if (db === null) db = await getPoolDatabase();
            const result = await db.query(`SELECT MAX(round_id) FROM CurrentRound`);
            resolve(parseInt(result.rows[0].max || 0));
        });
    }

    static async getBlocks(db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`SELECT * FROM Blocks`)
        .then(result => result.rows);
    }

    static async getUnpaidBlocks(db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`SELECT * FROM Blocks WHERE status = 'confirmed' AND paid_at IS NULL and paid_txid IS NULL`)
        .then(result => result.rows);
    }

    static async resetAllBlocksToUnpaid(db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`UPDATE Blocks SET status = 'pending', paid_at = NULL, paid_txid = NULL`);
    }

    static async getBlocksByStatus(status, db=null) {
      if (db === null) db = await getPoolDatabase();
      return db.query(`SELECT * FROM Blocks WHERE status = $1`, [status])
        .then(result => result.rows);
    }

    static async flushAllUpdates(db=null) {
      console.log('Flushing all updates');
        if (db === null) db = await getPoolDatabase();
        const workers = await this.getAllWorkers(db);
        for (const worker of workers) {
            const buffer = this.getUpdateBuffer(worker.workername);
            if (Object.values(buffer).some(value => value !== 0)) {
                await db.query(
                    `UPDATE Workers SET valid = valid + $1, roundshares = roundshares + $2, totalshares = totalshares + $3, blocks = blocks + $4, unpaid = unpaid + $5, paid = paid + $6 WHERE workername = $7`,
                    [
                        buffer.valid,
                        buffer.roundshares,
                        buffer.totalshares,
                        buffer.blocks,
                        buffer.unpaid,
                        buffer.paid,
                        worker.workername
                    ]
                );
                this.resetUpdateBuffer(worker.workername);
            }
        }
    }

    static async startNewRound(blockHeight, networkDifficulty, db=null) {
        if (db === null) db = await getPoolDatabase();
        
        // End current round if exists
        await db.query(`
            UPDATE CurrentRound 
            SET status = 'completed', end_time = NOW() 
            WHERE status = 'active'
        `);

        // Start new round
        return db.query(`
            INSERT INTO CurrentRound (block_height, network_difficulty, status) 
            VALUES ($1, $2, 'active')
            RETURNING round_id
        `, [blockHeight, networkDifficulty]);
    }

    static async processBlock(blockData, db=null) {
        if (db === null) db = await getPoolDatabase();
        
        const { block_hash, block_height, reward, miner, difficulty } = blockData;
        
        // Get current round
        const roundResult = await db.query(
            `SELECT round_id FROM CurrentRound WHERE status = 'active'`
        );
        
        if (roundResult.rows.length === 0) {
            throw new Error('No active round found');
        }
        
        const roundId = roundResult.rows[0].round_id;

        // Insert block
        await db.query(`
            INSERT INTO Blocks (
                round_id, block_hash, block_height, reward, 
                miner, difficulty, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        `, [roundId, block_hash, block_height, reward, miner, difficulty]);

        // End current round and start new one
        await this.startNewRound(block_height + 1, difficulty, db);

        // Return round ID for reward distribution
        return roundId;
    }

    static async confirmBlock(blockHash, confirmations, transactionId, db=null) {
        if (db === null) db = await getPoolDatabase();
        
        if (confirmations >= 100) { // Adjust confirmation threshold as needed
            await db.query(`
                UPDATE Blocks 
                SET status = 'confirmed',
                    confirmations = $2,
                    transaction_id = $3,
                    confirmed_at = NOW()
                WHERE block_hash = $1
            `, [blockHash, confirmations, transactionId]);
            
            // Trigger reward distribution
            const blockData = await db.query(
                `SELECT round_id, reward FROM Blocks WHERE block_hash = $1`,
                [blockHash]
            );
            
            if (blockData.rows.length > 0) {
                await this.distributeRewards(
                    blockData.rows[0].round_id,
                    blockData.rows[0].reward,
                    db
                );
            }
        } else {
            await db.query(`
                UPDATE Blocks 
                SET confirmations = $2
                WHERE block_hash = $1
            `, [blockHash, confirmations]);
        }
    }

    static async distributeRewards(roundId, blockReward, db=null) {
        if (db === null) db = await getPoolDatabase();
        
        // Get all shares for the round
        const shares = await db.query(`
            SELECT workername, roundshares 
            FROM Workers 
            WHERE roundshares > 0
        `);
        
        const totalShares = shares.rows.reduce(
            (sum, row) => sum + parseInt(row.roundshares), 
            0
        );
        
        // Calculate and distribute rewards
        for (const worker of shares.rows) {
            const share = worker.roundshares / totalShares;
            const reward = blockReward * share;
            
            await db.query(`
                UPDATE Workers 
                SET unpaid = unpaid + $1,
                    roundshares = 0
                WHERE workername = $2
            `, [reward, worker.workername]);
        }
    }

    static async getCurrentNetworkDifficulty(db=null) {
        if (db === null) db = await getPoolDatabase();
        
        // This should be updated regularly from your daemon
        const result = await db.query(`
            SELECT network_difficulty 
            FROM CurrentRound 
            WHERE status = 'active' 
            ORDER BY round_id DESC 
            LIMIT 1
        `);
        
        return result.rows.length > 0 ? result.rows[0].network_difficulty : null;
    }
}

module.exports = {Worker, Workers};
