const { getPoolDatabase } = require('../database/db.js');
const { options } = require('../config.dev.js');
const Daemon = require('../lib/daemon.js');
const { Network } = require('../database/network.js');
const daemon = new Daemon.interface([options.daemons[0]], function (severity, message) {
    console.log(severity + ': ' + message);
});

async function calculateBlockReward() {
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

async function fetchNetworkStats() {
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

async function parseNetworkStats() {
    const network_data = await fetchNetworkStats();

    const mining_info = network_data.mining_info;
    const mempool_info = network_data.mempool_info;
    const assets_list = network_data.assets_list;

    const network_height = mining_info.blocks;
    const network_hashrate = mining_info.networkhashps;
    const network_difficulty = mining_info.difficulty;
    const network_assets_count = assets_list.length;
    const network_mempool_count = mempool_info.size;
    const network_mempool_size = mempool_info.bytes;
    const network_block_reward = await calculateBlockReward();

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

async function updateNetworkStats(db) {
    const network_stats = await parseNetworkStats();
    const pool_stats = {
        name: 'pool',
        total_workers: 0, // Placeholder, update with actual logic if needed
        total_shares: 0, // Placeholder, update with actual logic if needed
        total_accepted: 0, // Placeholder, update with actual logic if needed
        total_rejected: 0, // Placeholder, update with actual logic if needed
        total_difficulty: network_stats.difficulty,
        total_hashrate: network_stats.hashrate,
        total_blocks: network_stats.height,
        total_rewards: network_stats.block_reward,
        total_workers_online: 0, // Placeholder, update with actual logic if needed
        total_workers_offline: 0, // Placeholder, update with actual logic if needed
        total_network_share: 0, // Placeholder, update with actual logic if needed
        last_updated: new Date().toISOString()
    };
    await Network.updateNetStats(pool_stats, db);
}

async function engage(interval = 10000, db) {
    console.log('Engaging autostats');
    setInterval(updateNetworkStats, interval, db);
}

module.exports = { engage };