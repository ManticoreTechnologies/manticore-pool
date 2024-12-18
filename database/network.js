const db = require('./db.js');

class Network {
    // Update network hashrate history
    static updateHashrateHistory(hashrate) {
        db.query(`INSERT INTO netHashHistory (hashrate) VALUES ($1)`, [hashrate]);
    }
    // Get network hashrate history
    static async getHashrateHistory() {
        const result = await db.query(`SELECT * FROM netHashHistory ORDER BY timestamp DESC LIMIT 100`);
        return result.rows;
    }
    // Update network difficulty history
    static updateDifficultyHistory(difficulty) {
        db.query(`INSERT INTO netDifficultyHistory (difficulty) VALUES ($1)`, [difficulty]);
    }
    // Get network difficulty history
    static async getDifficultyHistory() {
        const result = await db.query(`SELECT * FROM netDifficultyHistory ORDER BY timestamp DESC LIMIT 100`);
        return result.rows;
    }
    // Update network asset history
    static updateAssetHistory(assetCount) {
        db.query(`INSERT INTO netAssetHistory (asset) VALUES ($1)`, [assetCount]);
    }
    // Get network asset history
    static async getAssetHistory() {
        const result = await db.query(`SELECT * FROM netAssetHistory ORDER BY timestamp DESC LIMIT 100`);
        return result.rows;
    }
    static updateBlockSizeHistory(blockSize, height) {
        db.query(`INSERT INTO netBlockSizeHistory (blockSize, height) VALUES ($1, $2) ON CONFLICT (height) DO UPDATE SET blockSize = EXCLUDED.blockSize`, [blockSize, height]);
    }
    static async getBlockSizeHistory() {
        const result = await db.query(`SELECT * FROM netBlockSizeHistory ORDER BY height DESC LIMIT 100`);
        return result.rows;
    }

    static async getHistory(type) {
        if (type === 'hashrate') {
            return await this.getHashrateHistory();
        } else if (type === 'difficulty') {
            return await this.getDifficultyHistory();
        } else if (type === 'asset') {
            return await this.getAssetHistory();
        } else if (type === 'blocksize') {
            return await this.getBlockSizeHistory();
        } else {
            return [];
        }
    }
}

module.exports = {Network};