
// Purpose: This class is used to create and manage workers in the database
class Worker {

    constructor(worker_id=null, cockroachdb=null) {

        this.cockroachdb = cockroachdb;

        this.worker_id = worker_id;

        this.log = (message) => {
            console.log(`[Worker ${this.worker_id}] ${message}`);
        }
    }

    async sync(){
        this.log('Syncing worker data...');
        const worker_row = await this.cockroachdb.database('pool').table('workers').select('*').where(`worker_id='${this.worker_id}'`).execute();
        if (worker_row === undefined){
            this.log('Worker row not found, initializing...');
            const data = {
                worker_id: this.worker_id,
                name: "Worker",
                status: "active"
            };
            await this.cockroachdb.database('pool').table('workers').insert(data).execute();
        }else{
            this.log('Worker row found, updating...');
            Object.assign(this, worker_row);
        }
    }

    


}

module.exports = Worker;