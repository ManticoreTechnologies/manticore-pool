const {getPoolDatabase} = require('./db.js');

class Network {
    // Update network stats
    static async updateNetStats(network_stats, db) {
        return new Promise(async (resolve, reject) => {
            try {
                // Convert floating-point numbers to integers if necessary
                const height = parseInt(network_stats.height, 10);
                const hashrate = parseFloat(network_stats.hashrate);
                const difficulty = parseFloat(network_stats.difficulty);
                const assetsCount = parseInt(network_stats.assetsCount, 10);
                const mempoolCount = parseInt(network_stats.mempoolCount, 10);
                const mempoolSize = parseFloat(network_stats.mempoolSize);
                const blockReward = parseFloat(network_stats.blockReward);

                await db.query(
                    `INSERT INTO NetStats (height, hashrate, difficulty, assetsCount, mempoolCount, mempoolSize, blockReward) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [height, hashrate, difficulty, assetsCount, mempoolCount, mempoolSize, blockReward]
                );
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
    // Get network stats
    static async getNetStats() {
        const db = await getPoolDatabase();
        const result = await db.query(`SELECT * FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0];
    }
    // Get network stats history
    static async getNetStatsHistory() {
        const db = await getPoolDatabase();
        const result = await db.query(`SELECT * FROM NetStats ORDER BY timestamp DESC LIMIT 100`);
        return result.rows;
    }
    // Update network height
    static updateHeight(height) {
        db.query(`INSERT INTO NetStats (height) VALUES ($1)`, [height]);
    }
    // Get network height
    static async getHeight() {
        const result = await db.query(`SELECT height FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].height;
    }
    // Update network hashrate
    static updateHashrate(hashrate) {
        db.query(`INSERT INTO NetStats (hashrate) VALUES ($1)`, [hashrate]);
    }
    // Get network hashrate
    static async getHashrate() {
        const result = await db.query(`SELECT hashrate FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].hashrate;
    }
    // Update network difficulty
    static updateDifficulty(difficulty) {
        db.query(`INSERT INTO NetStats (difficulty) VALUES ($1)`, [difficulty]);
    }
    // Get network difficulty
    static async getDifficulty() {
        const result = await db.query(`SELECT difficulty FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].difficulty;
    }
    // Update network assets count
    static updateAssetsCount(assetsCount) {
        db.query(`INSERT INTO NetStats (assetsCount) VALUES ($1)`, [assetsCount]);
    }
    // Get network assets count
    static async getAssetsCount() {
        const result = await db.query(`SELECT assetsCount FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].assetsCount;
    }
    // Update network mempool count
    static updateMempoolCount(mempoolCount) {
        db.query(`INSERT INTO NetStats (mempoolCount) VALUES ($1)`, [mempoolCount]);
    }
    // Get network mempool count
    static async getMempoolCount() {
        const result = await db.query(`SELECT mempoolCount FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].mempoolCount;
    }
    // Update network mempool size
    static updateMempoolSize(mempoolSize) {
        db.query(`INSERT INTO NetStats (mempoolSize) VALUES ($1)`, [mempoolSize]);
    }
    // Get network mempool size
    static async getMempoolSize() {
        const result = await db.query(`SELECT mempoolSize FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].mempoolSize;
    }
    // Update network block reward
    static updateBlockReward(blockReward) {
        db.query(`INSERT INTO NetStats (blockReward) VALUES ($1)`, [blockReward]);
    }
    // Get network block reward
    static async getBlockReward() {
        const result = await db.query(`SELECT blockReward FROM NetStats ORDER BY timestamp DESC LIMIT 1`);
        return result.rows[0].blockReward;
    }

    static async getHashrateHistory(start=0, end=100) {
        const result = await db.query(`SELECT hashrate FROM NetStats ORDER BY timestamp DESC LIMIT ${end} OFFSET ${start}`);
        return result.rows;
    }

    static async getDifficultyHistory(start=0, end=100) {
        const result = await db.query(`SELECT difficulty FROM NetStats ORDER BY timestamp DESC LIMIT ${end} OFFSET ${start}`);
        return result.rows;
    }

    static async getHistory(type) {
        if (type === 'height') {
            return await this.getHeight();
        } else if (type === 'hashrate') {
            return await this.getHashrate();
        } else if (type === 'difficulty') {
            return await this.getDifficulty();
        } else if (type === 'assetsCount') {
            return await this.getAssetsCount();
        } else if (type === 'mempoolCount') {
            return await this.getMempoolCount();
        } else if (type === 'mempoolSize') {
            return await this.getMempoolSize();
        } else if (type === 'blockReward') {
            return await this.getBlockReward();
        } else {
            return [];
        }
    }
}

module.exports = {Network};