const { Workers } = require('../database/workers.js');
const { getPoolDatabase } = require('../database/db.js');
const autoflush = {
  engage: async (delay) => {

    const db = await getPoolDatabase();
    console.log('Engaging auto flush');
    setInterval(async () => {
      try {
        console.log('Flushing workers');
        await Workers.flushAllUpdates(db);
      } catch (error) {
        console.error('Error during auto flush:', error);
      }
    }, delay); // 10 seconds
    return db;
  },
  terminate: () => {
    console.log('Terminating auto flush');
    // Clear the interval
  }
};

module.exports = autoflush; 


