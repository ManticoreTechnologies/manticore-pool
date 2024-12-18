
// Define the coin
var myCoin = {
    "name": "Ravencoin",
    "symbol": "RVN",
    "algorithm": "kawpow",
     "peerMagic": "4556524d",
     "peerMagicTestnet": "45565254"
};

// Define the pool options 
const options = {

    "coin": myCoin,
    "poolFee": 0.01,
    "address": "EcmFc6abS8xPkMpzWrZSo9yEU2jgcDhkzd", //Address to where block rewards are given
    "feeAddress": "EWop2wCsufxboP19De9tY3hMaPKNUiUupL", //Address to where pool fees are sent
    "payoutThreshold": 100000,
    /* Block rewards go to the configured pool wallet address to later be paid out to miners,
       except for a percentage that can go to, for examples, pool operator(s) as pool fees or
       or to donations address. Addresses or hashed public keys can be used. Here is an example
       of rewards going to the main pool op, a pool co-owner, and NOMP donation. */
    "rewardRecipients": {
        "eHNUGzw8ZG9PGC8gKtnneyMaQXQTtAUm98": 10 // Miner dev fund 10%, required by evrmore network
    },

    "blockRefreshInterval": 1000, //How often to poll RPC daemons for new blocks, in milliseconds

    /* This should usually be set "true". If set "false" then  getblocktemplate will not be
       automatically called after a block solution is accepted by the chain. Unless the
       "blockRefreshInterval" is set very small, this will starve the miner of new blocks
       and force it to keep resubmitting new shares for the old block. This is wasteful, but
       can be useful for mining a testnet with a powerful miner without raising the difficulty. */
    "getNewBlockAfterFound": true, 

    /* Some miner apps will consider the pool dead/offline if it doesn't receive anything new jobs
       for around a minute, so every time we broadcast jobs, set a timeout to rebroadcast
       in this many seconds unless we find a new job. Set to zero or remove to disable this. */
    "jobRebroadcastTimeout": 55,

    /* Some attackers will create thousands of workers that use up all available socket connections,
       usually the workers are zombies and don't submit shares after connecting. This features
       detects those and disconnects them. */
    "connectionTimeout": 1200, //Remove workers that haven't been in contact for this many seconds

    /* Sometimes you want the block hashes even for shares that aren't block candidates. */
    "emitInvalidBlockHashes": false,

    /* Enable for client IP addresses to be detected when using a load balancer with TCP proxy
       protocol enabled, such as HAProxy with 'send-proxy' param:
       http://haproxy.1wt.eu/download/1.5/doc/configuration.txt */
    "tcpProxyProtocol": false,

    /* If a worker is submitting a high threshold of invalid shares we can temporarily ban their IP
       to reduce system/network load. Also useful to fight against flooding attacks. If running
       behind something like HAProxy be sure to enable 'tcpProxyProtocol', otherwise you'll end up
       banning your own IP address (and therefore all workers). */
    "banning": {
        "enabled": true,
        "time": 600, //How many seconds to ban worker for
        "invalidPercent": 50, //What percent of invalid shares triggers ban
        "checkThreshold": 500, //Check invalid percent when this many shares have been submitted
        "purgeInterval": 300 //Every this many seconds clear out the list of old bans
    },

    /* Each pool can have as many ports for your miners to connect to as you wish. Each port can
       be configured to use its own pool difficulty and variable difficulty settings. varDiff is
       optional and will only be used for the ports you configure it for. */
    "ports": {
        "3333": { //A port for your miners to connect to
            "diff": 0.003, //the pool difficulty for this port

            /* Variable difficulty is a feature that will automatically adjust difficulty for
               individual miners based on their hashrate in order to lower networking overhead */
            "varDiff": {
                "minDiff": 0.003, //Minimum difficulty
                "maxDiff": 512, //Network difficulty will be used if it is lower than this
                "targetTime": 5, //Try to get 1 share per this many seconds
                "retargetTime": 1, //Check to see if we should retarget every this many seconds
                "variancePercent": 15 //Allow time to very this % from target without retargeting
            }
        },
        "3334": {
            "diff": 0.003, //the pool difficulty for this port
            "varDiff": {
                "minDiff": 0.003, //Minimum difficulty
                "maxDiff": 512, //Network difficulty will be used if it is lower than this
                "targetTime": 5, //Try to get 1 share per this many seconds
                "retargetTime": 60, //Check to see if we should retarget every this many seconds
                "variancePercent": 15 //Allow time to very this % from target without retargeting
            }
        }
    },
    "daemons": [
        {
            host: '127.0.0.1',
            port: 9821,
            user: 'user',
            password: 'password'
         }
    ],
    "p2p": {
        "enabled": false,
        "host": "127.0.0.1",
        "port": 18770,
        "disableTransactions": true
    }
}

module.exports = { myCoin, options };