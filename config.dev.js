const { getUserAndPassword } = require('./utils.js');

// Specify the path to the evrmore.conf file
const evrmore_config_path = '/home/phoenix/Documents/EvrmoreTestnetwork/evrmore.conf';

// Extract user and password from the evrmore.conf file
const { user, password } = getUserAndPassword(evrmore_config_path);

// Define coin data
const evrmore = {
    name: "EVR",
    symbol: "EVR",
    algorithm: "evrprogpow",
    peerMagic: "4556524d",
    peerMagicTestnet: "45565254"
};

// Define pool options
const options = {
    remoteAddress: "0.0.0.0",
    coin: evrmore,
    poolFee: 0.01,
    address: "EcmFc6abS8xPkMpzWrZSo9yEU2jgcDhkzd", // Pool wallet address for block rewards
    feeAddress: "EWop2wCsufxboP19De9tY3hMaPKNUiUupL", // Address for pool fees
    payoutThreshold: 100000, // Minimum payout threshold

    // Reward recipients configuration
    rewardRecipients: {
        "eHNUGzw8ZG9PGC8gKtnneyMaQXQTtAUm98": 10 // 10% to Miner dev fund
    },

    blockRefreshInterval: 1000, // Poll interval for new blocks in milliseconds
    getNewBlockAfterFound: true, // Automatically get new block after finding one
    jobRebroadcastTimeout: 55, // Timeout for rebroadcasting jobs

    // Connection management
    connectionTimeout: 1200, // Timeout for inactive workers in seconds
    emitInvalidBlockHashes: false, // Emit block hashes for invalid shares

    // TCP proxy protocol settings
    tcpProxyProtocol: false, // Enable if using a load balancer with TCP proxy

    // Banning configuration for invalid shares
    banning: {
        enabled: true,
        time: 600, // Ban duration in seconds
        invalidPercent: 50, // Invalid share percentage to trigger ban
        checkThreshold: 500, // Number of shares to check for invalid percentage
        purgeInterval: 300 // Interval to clear old bans
    },

    // Port configuration for miners
    ports: {
        "3333": {
            diff: 0.003, // Pool difficulty
            varDiff: {
                minDiff: 0.003,
                maxDiff: 512,
                targetTime: 5, // Target time for shares in seconds
                retargetTime: 1, // Retarget interval in seconds
                variancePercent: 15 // Allowed variance percentage
            }
        },
        "3334": {
            diff: 0.003,
            varDiff: {
                minDiff: 0.003,
                maxDiff: 512,
                targetTime: 5,
                retargetTime: 60,
                variancePercent: 15
            }
        }
    },

    // Daemon configuration
    daemons: [
        {
            host: '0.0.0.0',
            port: 9821,
            user: user,
            password: password
        }
    ],

    // P2P configuration
    p2p: {
        enabled: false,
        host: "127.0.0.1",
        port: 18770,
        disableTransactions: true
    }
};

module.exports = { options };