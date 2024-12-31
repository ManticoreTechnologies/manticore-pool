
const cors = require('cors');

class RestAPI {
    constructor(db){
        this.db = db;
        this.express = require('express');
        this.router = this.express.Router();
        
        this.router.get('/', async (req, res) => {
            res.send('Welcome to the Manticore Pool API');
        });

        // Serve the poolstats
        this.router.get('/poolstats', async (req, res) => {
            const poolstats = await this.db.select_many('poolstats', '*', 1)
            res.send(poolstats);
        });
        
        this.router.get('/poolstats/history', async (req, res) => {
            const poolstats = await this.db.select_many('poolstats', '*', 100)
            res.send(poolstats);
        });

        this.router.get('/networkstats', async (req, res) => {
            const networkstats = await this.db.select_many('networkstats', '*', 1)
            res.send(networkstats);
        });

        this.router.get('/networkstats/history', async (req, res) => {
            const networkstats = await this.db.select_many('networkstats', '*', 100)
            res.send(networkstats);
        });

        // estup crosss origin allow any origin 
        this.app = this.express();
        this.app.use(cors({
            origin: '*'
        }));
        this.app.use('/', this.router);

    }

    start(port = 3000){
        this.app.listen(port, () => {
            console.log('Server is running on port ' + port);
        });
    }
}

module.exports = RestAPI;