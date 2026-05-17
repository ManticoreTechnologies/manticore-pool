const { getRpcConfig, parseConfigFile } = require('./utility/utils.js');

const DEFAULT_CONF_PATHS = [
    process.env.EVRMORE_CONF,
    process.env.EVR_CONF,
    '/mnt/evrmore/evrmore.conf',
    `${process.env.HOME || ''}/.evrmore/evrmore.conf`,
    `${process.env.HOME || ''}/.evrmore/evrmore-testnet/evrmore.conf`
].filter(Boolean);

function firstExistingPath(paths) {
    const fs = require('fs');
    for (const filePath of paths) {
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return paths[0];
}

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const evrmore_config_path = firstExistingPath(DEFAULT_CONF_PATHS);
const fileConfig = parseConfigFile(evrmore_config_path);
const rpcConfig = getRpcConfig(evrmore_config_path, 8819);

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
    bindAddress: process.env.STRATUM_HOST || process.env.POOL_BIND_ADDRESS || "0.0.0.0",
    remoteAddress: process.env.STRATUM_HOST || process.env.POOL_BIND_ADDRESS || "0.0.0.0",
    coin: evrmore,
    poolFee: parseNumber(process.env.POOL_FEE, 0.01),
    address: process.env.POOL_ADDRESS || fileConfig.miningaddress || "EcmFc6abS8xPkMpzWrZSo9yEU2jgcDhkzd",
    feeAddress: process.env.POOL_FEE_ADDRESS || "EWop2wCsufxboP19De9tY3hMaPKNUiUupL",
    payoutThreshold: parseNumber(process.env.PAYOUT_THRESHOLD, 100000),
    payoutsEnabled: process.env.PAYOUTS_ENABLED === 'true',
    payoutInterval: parseNumber(process.env.PAYOUT_INTERVAL_MS, 300000),
    payoutMaturityConfirmations: parseNumber(process.env.PAYOUT_MATURITY_CONFIRMATIONS, 100),
    payoutMinConfirmations: parseNumber(process.env.PAYOUT_MIN_CONFIRMATIONS, 100),
    walletPassphrase: process.env.WALLET_PASSPHRASE || '',
    walletUnlockSeconds: parseNumber(process.env.WALLET_UNLOCK_SECONDS, 60),
    payoutAdminToken: process.env.PAYOUT_ADMIN_TOKEN || '',

    // Reward recipients configuration
    rewardRecipients: {
        "eHNUGzw8ZG9PGC8gKtnneyMaQXQTtAUm98": 10 // 10% to Miner dev fund
    },

    blockRefreshInterval: parseNumber(process.env.BLOCK_REFRESH_INTERVAL, 10000),
    getNewBlockAfterFound: true, // Automatically get new block after finding one
    jobRebroadcastTimeout: parseNumber(process.env.JOB_REBROADCAST_TIMEOUT, 90),
    maxShareValidationConcurrency: parseNumber(process.env.SHARE_VALIDATION_CONCURRENCY, 1),
    maxShareValidationQueue: parseNumber(process.env.SHARE_VALIDATION_QUEUE_SIZE, 256),
    enforceNoncePrefix: process.env.ENFORCE_NONCE_PREFIX === 'true',

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
            diff: parseNumber(process.env.STRATUM_DIFF, 0.003),
            varDiff: {
                minDiff: parseNumber(process.env.STRATUM_MIN_DIFF, 0.003),
                maxDiff: parseNumber(process.env.STRATUM_MAX_DIFF, 512),
                targetTime: parseNumber(process.env.STRATUM_TARGET_TIME, 5),
                retargetTime: parseNumber(process.env.STRATUM_RETARGET_TIME, 30),
                variancePercent: parseNumber(process.env.STRATUM_VARIANCE_PERCENT, 15)
            }
        },
        "3334": {
            diff: parseNumber(process.env.STRATUM_DIFF, 0.003),
            varDiff: {
                minDiff: parseNumber(process.env.STRATUM_MIN_DIFF, 0.003),
                maxDiff: parseNumber(process.env.STRATUM_MAX_DIFF, 512),
                targetTime: parseNumber(process.env.STRATUM_TARGET_TIME, 5),
                retargetTime: parseNumber(process.env.STRATUM_RETARGET_TIME, 60),
                variancePercent: parseNumber(process.env.STRATUM_VARIANCE_PERCENT, 15)
            }
        }
    },

    // Daemon configuration
    daemons: [
        {
            host: rpcConfig.host,
            port: rpcConfig.port,
            user: rpcConfig.user,
            password: rpcConfig.password
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

module.exports = { options, evrmore_config_path };