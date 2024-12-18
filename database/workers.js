const db = require('./db.js');

class Worker {

    constructor(workerData) {
  
      // Assign the worker data to the worker object
      Object.assign(this, workerData);
  
    }
  
    /* Increment Mutators */ /* Tested: Working!  */
    incrementValidShares(shares=1) {
      this.valid = parseInt(this.valid) + parseInt(shares);
      console.log('incrementValidShares: '+this.valid);
      this.save();
    }
    incrementInvalidShares(shares=1) {
      this.invalid = parseInt(this.invalid) + parseInt(shares);
      console.log('incrementInvalidShares: '+this.invalid);
      this.save();
    }
    incrementRoundShares(shares=1) {
      this.roundshares = parseInt(this.roundshares) + parseInt(shares);
      console.log('incrementRoundShares: '+this.roundshares);
      this.save();
    } 
    incrementTotalShares(shares=1) {
      this.totalshares = parseInt(this.totalshares) + parseInt(shares);
      console.log('incrementTotalShares: '+this.totalshares);
      this.save();
    }
    incrementPaid(paid=1) {
      this.paid = parseInt(this.paid) + parseInt(paid);
      this.save();
    }
    incrementUnpaid(unpaid=1) {
      this.unpaid = parseInt(this.unpaid) + parseInt(unpaid);
      this.save();
    }
    incrementBlocks(blocks=1) {
      this.blocks = parseInt(this.blocks) + parseInt(blocks);
      this.save();
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
        `UPDATE WorkerShare SET valid = $1, invalid = $2, blocks = $3, hashrate = $4, roundshares = $5, totalshares = $6, lastsharetime = $7, paid = $8, unpaid = $9 WHERE workername = $10`,
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
    
    static async initWorker(workerName) {
        try {
            await db.query(`INSERT INTO WorkerShare (workername) VALUES ($1) ON CONFLICT (workername) DO NOTHING`, [workerName]);
            return new Worker({workername: workerName});
        } catch (error) {
            console.error('Error initializing worker:', error);
            throw error;
        }
    }
    
    static getWorker(workerName) {
        return db.query(`SELECT * FROM WorkerShare WHERE workername = $1`, [workerName])
        .then(result => result.rows.length > 0 ? new Worker(result.rows[0]) : new Worker({workername: workerName}));
    }

    static getActiveWorkers() {
        return db.query(`SELECT * FROM WorkerShare WHERE lastsharetime >= $1`, [Date.now() - 5 * 60 * 1000])
        .then(result => result.rows);
    }
  
    static getActiveWorkersHashrate() {
      return new Promise((resolve, reject) => {
        db.query(`SELECT SUM(hashrate) as total FROM WorkerShare WHERE lastShareTime >= $1`, [Date.now() - 5 * 60 * 1000], (err, result) => {
          if (err) reject(err);
          resolve(parseInt(result.rows[0].total || 0));
        });
      });
    }   

    static getActiveWorkersCount() {
      return db.query(`SELECT COUNT(*) FROM WorkerShare WHERE lastsharetime >= $1`, [Date.now() - 5 * 60 * 1000])
        .then(result => parseInt(result.rows[0].count || 0));
    }
  

    static getAllWorkerShares() {
      return db.query(`SELECT * FROM WorkerShare`)
        .then(result => result.rows);
    }

    static getAllWorkers() {
      return db.query(`SELECT * FROM WorkerShare`)
        .then(result => result.rows.map(row => new Worker(row)));
    }

    static getTotalRoundShares() {
      return db.query(`SELECT SUM(roundshares) FROM WorkerShare`)
        .then(result => parseInt(result.rows[0].sum || 0));
    }

    static resetRoundShares() {
      return db.query(`UPDATE WorkerShare SET roundshares = 0`);
    }

    // Resets all the worker data to 0
    static resetAllWorkerData() {
      return db.query(`UPDATE WorkerShare SET valid = 0, invalid = 0, blocks = 0, hashrate = 0, roundshares = 0, totalshares = 0, lastsharetime = 0, paid = 0, unpaid = 0`);
    }

    static getTotalBlocks() {
      return db.query(`SELECT SUM(blocks) FROM WorkerShare`)
        .then(result => parseInt(result.rows[0].sum || 0));
    }

    static getWorkersByAddress(address) {
      return db.query(`SELECT * FROM WorkerShare WHERE workername LIKE $1 || '%'`, [address])
        .then(result => result.rows);
    }
}

module.exports = {Worker, Workers};
