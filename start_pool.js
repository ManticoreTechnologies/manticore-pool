// Configuration options, switch to config.js for production
const { options } = require('./config.dev.js');

// The pool, this is async
const EvrmorePool = require('./Pools/Evrmore.js');

// Our database wrapper, this wraps the cockroachdb wrapper
const { getDatabase } = require('./Database/database.js');

// Our rest api, this is used to get the pool stats, also async
const RestAPI = require('./rest-api/index.js');

// Our pool stats updater, this is used to update the pool stats, also async
const PoolStatsUpdater = require('./background/update_poolstats.js');

// Our network stats updater, this is used to update the network stats, also async
const NetworkStatsUpdater = require('./background/update_networkstats.js');

// Our daemon creator, this is used to create a new daemon, also async
const {createDaemon} = require('./utility/evr_daemon.js');


/* Task List

    -------- Background Tasks --------
    - [ ] Update pool stats
    - [ ] Update network stats
    - [ ] Update worker stats
    - [ ] Update block stats
    - [ ] Update reward stats

*/


// Start the pool
async function startPool(){

    // Get the system database (verbose, purge)
    const database = await getDatabase('EVRPool', true, false);

    // Start the pool stats updater
    PoolStatsUpdater.start(database, 1000);

    // Create a new rest api
    const restApi = new RestAPI(database);

    // Start the rest api
    restApi.start();
    
    // Create a new pool
    const EVRPool = new EvrmorePool(options, database);

    // Create a new daemon
    const daemon = createDaemon(options);

    // Start the network stats updater
    NetworkStatsUpdater.start(database, daemon, 1000);

    // Start the pool
    EVRPool.start();    
}

startPool();