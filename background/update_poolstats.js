class UpdatePoolStats {
  static async start(db, interval) {
    console.log('Starting pool stats updater');
    setInterval(async () => {
      try {

        // TODO: Find the number of active workers
        // TODO: Find the total network share 
        // TODO: Sum up the total hashrate of all workers
        //const activeWorkers = await db.getActiveWorkersCount();
        // TODO Finish compiling pool stats using other data
        const pool_stats = {
            timestamp: new Date().toISOString(),
            total_workers: 0,
            total_shares: 0,
            total_accepted: 0,
            total_rejected: 0,
            total_difficulty: 0,
            total_hashrate: 0,
            total_blocks: 0,
            total_rewards: 0,
        }

        await db.insert('poolstats', pool_stats);


      } catch (error) {
        console.error('Error during pool stats update:', error);
      }
    }, interval); // 10 seconds
  }
}

module.exports = UpdatePoolStats; 

