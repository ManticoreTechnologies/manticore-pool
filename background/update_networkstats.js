async function fetchNetworkStats(daemon) {
    return new Promise((resolve, reject) => {
        daemon.cmd('getmininginfo', [], function (results) {
            const mining_info = results[0].response;

            daemon.cmd('getmempoolinfo', [], function (results) {
                const mempool_info = results[0].response;

                daemon.cmd('listassets', [], function (results) {
                    const assets_list = results[0].response;

                    resolve({ mining_info, mempool_info, assets_list });
                });
            });
        });
    });
}
async function calculateBlockReward(daemon) {
    return new Promise((resolve, reject) => {
        daemon.cmd('getblockcount', [], async function (results) {
            var subsidyHalvingInterval = 1648776;
            var genesisReward = 2778;
            var blockCount = results[0].response;
            var reward = genesisReward / (2 ** (Math.floor(blockCount / subsidyHalvingInterval)));
            resolve(reward);
        });
    });
}
async function parseNetworkStats(daemon) {
    const network_data = await fetchNetworkStats(daemon);

    const mining_info = network_data.mining_info;
    const mempool_info = network_data.mempool_info;
    const assets_list = network_data.assets_list;

    const network_height = mining_info.blocks;
    const network_hashrate = mining_info.networkhashps;
    const network_difficulty = mining_info.difficulty;
    const network_assets_count = assets_list.length;
    const network_mempool_count = mempool_info.size;
    const network_mempool_size = mempool_info.bytes;
    const network_block_reward = await calculateBlockReward(daemon);

    const network_stats = {
        height: network_height,
        hashrate: network_hashrate,
        difficulty: network_difficulty,
        assets_count: network_assets_count,
        mempool_count: network_mempool_count,
        mempool_size: network_mempool_size,
        block_reward: network_block_reward
    };

    return network_stats;
}

class UpdateNetworkStats {
    static async start(db, daemon, interval) {
        this.db = db;
        this.daemon = daemon;
        this.interval = interval;
      console.log('Starting network stats updater');
      setInterval(async () => {
        try {
  
          // Fetch network stats from daemon
          const network_stats = await parseNetworkStats(this.daemon);

          // Insert network stats into database
          await this.db.insert("networkstats", network_stats);
  
        } catch (error) {
          console.error('Error during network stats update:', error);
        }
      }, interval); // 10 seconds
    }
  }
  
  module.exports = UpdateNetworkStats; 
  
  