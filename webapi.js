const express = require('express');
const { Sequelize } = require('sequelize');
const { WorkerShare, NetHashHistory, NetDifficultyHistory, NetAssetHistory, NetBlockSizeHistory, getWorker, getActiveWorkers, getActiveWorkersHashrate, getActiveWorkersCount } = require('./db.js');
const app = express();
const port = 3000;
const daemon = require('./lib/daemon.js');

// cross origin fix
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// use json
app.use(express.json());

// Setup daemmon connection 
const Daemon = new daemon.interface([{
  host: '127.0.0.1',
  port: 9821,
  user: 'user',
  password: 'password'
}], function (severity, message) {
  console.log(severity + ': ' + message);
});

/* Worker Endpoints */

// Get the raw worker data
app.get('/worker/:workerName', async (req, res) => {
  const workerName = req.params.workerName;
  console.log(workerName);
  console.log(await getWorker(workerName));
  const worker = await getWorker(workerName);
  console.log(worker);
  res.json(worker);
});

/* Pool Endpoints */
app.get('/poolstats', async (req, res) => {
  const poolstats_template = {
    hashrate: await getActiveWorkersHashrate(),
    difficulty: await getDifficulty(),
    activeMiners: await getActiveWorkersCount(),
    blockFound: await getBlockHeight(),
    networkShare: await getNetworkShare(),
  }
  res.json(poolstats_template);
});





 //Update the hashrate and difficulty
async function updateHashrateAndDifficulty() {
  NetHashHistory.update(await getHashrate(), Date.now());
  NetDifficultyHistory.update(await getDifficulty(), Date.now());
  NetAssetHistory.update(await getAssetCount(), Date.now());
}
updateHashrateAndDifficulty();

// every minute update hashrate
setInterval(async () => {
  const hashrate = await getHashrate();
  const difficulty = await getDifficulty();
  NetHashHistory.update(hashrate, Date.now());
  NetDifficultyHistory.update(difficulty, Date.now());
  NetAssetHistory.update(await getAssetCount(), Date.now());
}, 60000);
setInterval(async () => {
  const {blockSize, height} = await getBlockSizeAndHeight();
  NetBlockSizeHistory.update(blockSize, height);
}, 1000);


// Endpoint to get worker shares
app.get('/worker-shares', async (req, res) => {
  try {
    const workerShares = await WorkerShare.findAll(); // Check this we changed this method
    res.json(workerShares);
  } catch (error) {
    console.error('Error fetching worker shares:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/worker-shares/dashboard/:workerAddress', async (req, res) => {
  try {
    const workerAddress = req.params.workerAddress;
    const workerShares = await WorkerShare.getAddressWorkers(workerAddress);
    if (workerShares.length === 0) {
      return res.status(404).json({ error: 'No workers found for the given address' });
    }
    res.json(workerShares);
  } catch (error) {
    console.error('Error fetching worker shares:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/worker-shares/total-blocks', async (req, res) => {
  const totalBlocks = await getBlockHeight();
  res.json({ totalBlocks });
});

// get pool hashrate
async function getPoolHashrate() {
  return await WorkerShare.getTotalHashrate();
}
app.get('/poolstats/hashrate', async (req, res) => {
  console.log('Fetching pool hashrate...');
  const hashrate = await getPoolHashrate();
  console.log('Pool hashrate: '+hashrate);
  res.json({ hashrate });
});

async function getNetworkShare() {
  hashrate = await getHashrate();
  poolHashrate = (await getPoolHashrate());
  return poolHashrate / hashrate;
}

app.get('/poolstats/network-share', async (req, res) => {
  const networkShare = await getNetworkShare();
  console.log('networkShare: '+networkShare);
  res.json({ networkShare });
});

app.get('/worker-shares/active-workers', async (req, res) => {
  console.log('Fetching active workers...');
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000; // 5 minutes in milliseconds
console.log(Date.now());
console.log(fiveMinutesAgo);
  try {
    const activeWorkers = await WorkerShare.findAllActive(); // Check this we changed this method
  
    console.log(`Active workers found: ${activeWorkers}`);
    res.json({ activeWorkers: activeWorkers.length });
  } catch (error) {
    console.error('Error fetching active workers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





// Netstats
function getHashrate() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getmininginfo', [], function (results) {
      console.log(results);
      var hashrate = results[0].response.networkhashps;
      resolve(hashrate);
    });
  });
}
app.get('/netstats/hashrate', async (req, res) => {
  res.json({ hashrate: await getHashrate() });
});

function getDifficulty() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getmininginfo', [], function (results) {
      var difficulty = results[0].response.difficulty;
      resolve(difficulty);
    });
  });
}
app.get('/netstats/difficulty', (req, res) => {
  res.json({ difficulty: getDifficulty() });
});

function getBlockHeight() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getblockcount', [], function (results) {
      var blockCount = results[0].response;
      resolve(blockCount);
    });
  });
}

app.get('/netstats/blockheight', (req, res) => {
  res.json({ blockHeight: getBlockHeight() });
});

function getLastBlockTime() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getblockcount', [], function (results) {
      var blockCount = results[0].response;
      Daemon.cmd('getblockhash', [blockCount - 1], function (results) {
        Daemon.cmd('getblock', [results[0].response], function (results) {
            var blockTime = results[0].response.time;
            resolve(blockTime);
        });
      });
    });
  });
}

app.get('/netstats/lastblocktime', (req, res) => {
    res.json({ blockTime: getLastBlockTime() });
});

function getBlockReward() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getblockcount', [], async function (results) {
      var subsidyHalvingInterval = 1648776;
      var genesisReward = 2778;
      var blockCount = results[0].response;
      var reward = genesisReward / (2 ** (Math.floor(blockCount / subsidyHalvingInterval)));
      resolve(reward);
    });
  });
}

app.get('/netstats/blockreward', async (req, res) => {
    res.json({ reward: await getBlockReward() });
});

function getAssetCount() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('listassets', [], function (results) {
      var assetCount = results[0].response.length;
      resolve(assetCount);
    });
  });
}

app.get('/netstats/assetcount', async (req, res) => {
  res.json({ assetCount: await getAssetCount() });
});

function getBlockSizeAndHeight() {
  return new Promise((resolve, reject) => {
    Daemon.cmd('getbestblockhash', [], function (results) {
      var blockHash = results[0].response;
      Daemon.cmd('getblock', [blockHash], function (results) {
        var blockSize = results[0].response.size;
        var height = results[0].response.height;
        resolve({blockSize, height});
      });
    });
  });
} 

app.get('/netstats/blockSize', async (req, res) => {
  res.json(await getBlockSizeAndHeight());
});

async function getPoolHashrate() {
  return await WorkerShare.getTotalHashrate();
}

async function getNetworkShare() {
  hashrate = await getHashrate();
  poolHashrate = await getPoolHashrate();
  console.log('hashrate: '+hashrate);
  console.log('poolHashrate: '+poolHashrate);
  return poolHashrate / hashrate;
}

app.get('/netstats', async (req, res) => {
  netstats = {    hashrate: await getHashrate(),
    difficulty: await getDifficulty(),
    blockHeight: await getBlockHeight(),
    blockTime: await getLastBlockTime(),
    blockReward: await getBlockReward(),
    poolHashrate: await getPoolHashrate(),
    networkShare: await getNetworkShare()}
  res.json(netstats);
});

// Tickers
app.get('/netstats/hashrate/tickers', async (req, res) => {
  const tickers = await NetHashHistory.getAggregatedTickers(req.query.interval, req.query.maxHistory);
  res.json(tickers);
});

app.get('/netstats/difficulty/tickers', async (req, res) => {
  const tickers = await NetDifficultyHistory.getAggregatedTickers(req.query.interval, req.query.maxHistory);
  res.json(tickers);
});

app.get('/netstats/assetcount/tickers', async (req, res) => {
  const tickers = await NetAssetHistory.getAggregatedTickers(req.query.interval, req.query.maxHistory);
  res.json(tickers);
});

app.get('/netstats/blocksize/tickers', async (req, res) => {
  const tickers = await NetBlockSizeHistory.getAggregatedTickers(req.query.maxHistory);
  res.json(tickers);
});

app.listen(port, '192.168.1.211', () => {
  console.log(`Web server running at http://192.168.1.211:${port}`);
});

