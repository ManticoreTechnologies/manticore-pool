
async function calculateHashrate(worker, data, lastXShareTimes){
    // Get the submit time for the current share in seconds
    currentSubmitTime = data.submitTime / 1000 || 0

    // Get the last share time for the worker in seconds
    lastShareTime = worker.lastsharetime / 1000 || 0
    
    // Calculate the share time
    shareTime = (currentSubmitTime - lastShareTime)

    // Get the average share time
    averageShareTime = lastXShareTimes.reduce((a, b) => a + b, 0) / lastXShareTimes.length;

    // Get the pool difficulty
    poolDifficulty = data.difficulty

    // Calculate the hashrate based on pool difficulty and share time in Hashes per second
    hashrate = Math.floor((poolDifficulty*(Math.pow(2, 32)) / averageShareTime))
    if (hashrate == Infinity) {
      hashrate = 0;
    }
    if (isNaN(hashrate)) {
      hashrate = 0;
    }
    if (hashrate < 0) {
      hashrate = 0;
    }
    if (hashrate > 1000000000) {
      hashrate = 1000000000;
    }
    return hashrate;
    
    /*
    // Update the hashrate, in mh/s
    WorkerShare.updateHashrate(workerName, hashrate/1000000 || 0);

    // Update the last share time 
    WorkerShare.updateLastShareTime(workerName, data.submitTime);

    // Update the historical share times 
    await WorkerShare.updateHistoricalShareTimes(workerName, shareTime || 5);

    // Update the historical hashrate, only saves the last 24 hourse worth so 24*60*60 = 86400
    await WorkerShare.updateHistoricalHashrate(workerName, hashrate/1000000 || 0);
    */
}

module.exports = {
    calculateHashrate
}