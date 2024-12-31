const Stratum = require('../lib/index.js');

class Pool {
    constructor(options, authorizationFunction){

        // Save the options and authorization function
        this.options = options;
        this.authorizationFunction = authorizationFunction;

        // Create the pool Authorize function args: ip, port, workerName, password, extraNonce1, version, callback
        this._pool = Stratum.createPool(options, this.authorizationFunction);

    }

    // Start the pool
    start(){
        this._pool.start();
    }
}

module.exports = Pool;