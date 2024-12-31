// Import the default options
const {default_options} = require('./Utility/args.js');

// Import the sql utility
const sql = require('./Utility/sql.js');

// Import the error utility
const cockroach_error = require('./Utility/err.js');


class CockroachDB {

    // Options must include the database host, port, database, user, password, and ssl
    constructor(verbose = false, options = default_options){

        // Whether the database is verbose
        this.verbose = verbose;

        // Save the options
        this.options = options;

        // Import the pg client
        const Client = require('pg').Client;

        // Create the database client
        this.db = new Client(options);

        // Logging
        this.log = (message) => {
            this.verbose?console.log(`CockroachDB: ${message}`):null;
        }

        // Connect to the database
        this.log('Connecting to database');

        this.connect = async () => {
            try {
                await this.db.connect();
                this.connected = true;
                this.log(`Connected to database "${this.options.database}"`);
            } catch (err) {
                this.connected = false;
                this.log(`Error connecting to database "${this.options.database}": ${cockroach_error(err, [this.options.database, this.options.user])}`);
                throw err;
            }
        }



        // Promise wrapper
        this.promise = (promise) => {
            return new Promise((resolve, reject) => {
                promise.then((result)=>{
                    resolve(result);
                }).catch((err)=>{
                    this.log(`Error executing promise: ${err}`);
                    reject(err);
                });
            });
        }

        // List all databases
        this.databases = async () => {
            return this.promise(this.db.query(sql.get_all_databases()).then((result)=>{
                return result.rows.map((row)=>row.database_name);
            }));
        }
     
        // Database operations
        this.database = (database_name) =>{

            // Set the database name
            this._database_name = database_name;

            // Return the database operations
            return {

                // Connect to a database
                connect: async () => {
                    return new Promise((resolve, reject) => {
                        this.log(`Connecting to database "${this._database_name}"`);
                        this.db.connect().then(()=>{
                            this.connected = true;
                            this.log(`Connected to database "${this._database_name}"`);
                            resolve();
                        }).catch((err)=>{
                            this.log(`Error connecting to database "${this._database_name}": ${cockroach_error(err, [this.options.database, this._database_name, this.options.user])}`);
                            this.connected = false;
                            reject(cockroach_error(err, [this.options.database, this._database_name, this.options.user]));
                        });
                    });
                },

                // List all tables in a database
                listTables: async () => {
                    return this.promise(this.db.query(sql.get_all_tables(this._database_name)).then((result)=>{
                        return result.rows.map((row)=>row.table_name);
                    }));
                },

                // Execute Schema creation
                create: () => {
                    return {
                        execute: async () => {
                            this.log(`Creating database "${this._database_name}"`);
                            return this.promise(this.db.query(sql.create_database(this._database_name))).then(()=>{
                                this.log(`Database "${this._database_name}" created`);
                            });
                        },
                        table: (table_name) => {
                            this._table_name = table_name;
                            return {
                                columns: (columns) => {
                                    this._columns = columns;
                                    return {
                                        execute: async () => {
                                            this.log(`Creating table "${this._table_name}" in database "${this._database_name}"`);
                                            return this.promise(this.db.query(sql.create_table(this._database_name, this._table_name, this._columns)).then(()=>{
                                                this.log(`Table "${this._table_name}" created in database "${this._database_name}"`);
                                            }));
                                        }
                                    }
                                }
                            }
                        },
                        function: (function_name, function_body) => {
                            this._function_name = function_name;
                            this._function_body = function_body;
                            return {
                                execute: async () => {
                                    this.log(`Creating function "${this._function_name}" in database "${this._database_name}"`);
                                    return this.promise(this.db.query(sql.create_function(this._database_name, this._function_name, this._function_body))).then(()=>{
                                        this.log(`Function "${this._function_name}" created in database "${this._database_name}"`);
                                    });
                                }
                            }
                        }
                    }
                },



                // Delete a database
                delete: () => {
                    return {
                        execute: async () => {
                            this.log(`Deleting database "${this._database_name}"`);
                            return this.promise(this.db.query(sql.delete_database(this._database_name))).then(()=>{
                                this.log(`Database "${this._database_name}" deleted`);
                            });
                        }
                    }
                },
                function: (function_name) => {
                    this._function_name = function_name;
                    return {
                        execute: async () => {
                            this.log(`Executing function "${this._function_name}" in database "${this._database_name}"`);
                            return this.promise(this.db.query(sql.call_function_on_database(this._database_name, this._function_name)).then((result)=>{
                                this.log(`Function "${this._function_name}" executed in database "${this._database_name}"`);
                                return result[1].rows[0].test_function;
                            }));
                        }
                    }
                },
                // Table operations
                table: (table_name) => {
                    this._table_name = table_name;
                    return {
                        insert: (data) => {
                            this._data = data;
                            return {
                                execute: async () => {
                                    this.log(`Inserting data into table "${this._table_name}" in database "${this._database_name}"`);
                                    return this.promise(this.db.query(sql.insert(this._database_name, this._table_name, Object.keys(this._data), Object.values(this._data))).then(()=>{
                                        this.log(`Data inserted into table "${this._table_name}" in database "${this._database_name}"`);
                                    }));
                                }
                            }
                        },
                        upsert: (data) => {
                            this._data = data;
                            return {
                                execute: async () => {
                                    this.log(`Upserting data into table "${this._table_name}" in database "${this._database_name}"`);
                                    return this.promise(this.db.query(sql.upsert(this._database_name, this._table_name, Object.keys(this._data), Object.values(this._data), Object.keys(this._data)[0])).then(()=>{
                                        this.log(`Data upserted into table "${this._table_name}" in database "${this._database_name}"`);
                                    }));
                                },
                                where: (conditions) => {
                                    this._conditions = conditions;
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.upsert_where(this._database_name, this._table_name, Object.keys(this._data), Object.values(this._data), Object.keys(this._data)[0], this._conditions)).then(()=>{
                                                this.log(`Data upserted into table "${this._table_name}" in database "${this._database_name}"`);
                                            }));
                                        }
                                    }
                                }
                            }
                        },
                        select: (columns) => {
                            this._columns = columns;
                            return {
                                where: (conditions) => {
                                    this._conditions = conditions;
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.select_where(this._database_name, this._columns, this._table_name, this._conditions)).then((result)=>{
                                                return result[1].rows[0] || undefined;
                                            }));
                                        },
                                        orderBy: (column, direction) => {
                                            this._column = column;
                                            this._direction = direction;
                                            return {
                                                execute: async () => {
                                                    return this.promise(this.db.query(sql.select_orderBy(this._database_name, this._columns, this._table_name, this._conditions, this._column, this._direction)).then((result)=>{
                                                        return result[1].rows || undefined;
                                                    }));
                                                },
                                                limit: (limit) => {
                                                    this._limit = limit;
                                                    return {
                                                        execute: async () => {
                                                            return this.promise(this.db.query(sql.select_orderBy_limit(this._database_name, this._columns, this._table_name, this._conditions, this._column, this._direction, this._limit)).then((result)=>{
                                                                return result[1].rows || undefined;
                                                            }));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                limit: (limit) => {
                                    this._limit = limit;
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.select_limit(this._database_name, this._columns, this._table_name, this._limit)).then((result)=>{
                                                return result[1].rows || undefined;
                                            }));
                                        },
                                        orderBy: (column, direction) => {
                                            this._column = column;
                                            this._direction = direction;
                                            return {
                                                execute: async () => {
                                                    return this.promise(this.db.query(sql.select_limit_orderBy(this._database_name, this._columns, this._table_name, this._column, this._direction, this._limit)).then((result)=>{
                                                        return result[1].rows || undefined;
                                                    }));
                                                }
                                            }
                                        }
                                    }
                                },
                                execute: async () => {
                                    return this.promise(this.db.query(sql.select_limit(this._database_name, this._columns, this._table_name, this._limit)).then((result)=>{
                                        return result[1].rows || undefined;
                                    }));
                                }
                            }
                        },
                        column: (column_name) => {
                            this._column_name = column_name;
                            return {
                                update: (data) => {
                                    this._data = data;
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.update_column(this._database_name, this._table_name, this._column_name, this._data, this._conditions)).then(()=>{
                                                this.log(`Data updated in table "${this._table_name}" in database "${this._database_name}"`);
                                            }));
                                        },
                                        where: (conditions) => {
                                            this._conditions = conditions;
                                            return {
                                                execute: async () => {
                                                    return this.promise(this.db.query(sql.update_column_where(this._database_name, this._table_name, this._column_name, this._data, this._conditions)).then(()=>{
                                                        this.log(`Data updated in table "${this._table_name}" in database "${this._database_name}"`);
                                                    }));
                                                }
                                            }
                                        }
                                    }
                                },
                                increment: (value) => {
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.increment_column(this._database_name, this._table_name, this._column_name, value)).then(()=>{
                                                this.log(`Data incremented in table "${this._table_name}" in database "${this._database_name}"`);
                                            }));
                                        }
                                    }
                                }
                            }
                        },
                        columns: (columns) => {
                            this._columns = columns;
                            return {
                                execute: async () => {
                                    return this.promise(this.db.query(sql.select_columns(this._database_name, this._table_name, this._columns)).then((result)=>{
                                        return result[1].rows || undefined;
                                    }));
                                },
                                increment: (values) => {
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.increment_columns(this._database_name, this._table_name, this._columns, values)).then(()=>{
                                                this.log(`Data incremented in table "${this._table_name}" in database "${this._database_name}"`);
                                            }));
                                        },
                                        where: (conditions) => {
                                            this._conditions = conditions;
                                            return {
                                                execute: async () => {
                                                    return this.promise(this.db.query(sql.increment_columns_where(this._database_name, this._table_name, this._columns, values, this._conditions)).then(()=>{
                                                        this.log(`Data incremented in table "${this._table_name}" in database "${this._database_name}"`);
                                                    }));
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        count: () => {
                            return {
                                where: (conditions) => {
                                    this._conditions = conditions;
                                    return {
                                        execute: async () => {
                                            return this.promise(this.db.query(sql.count_where(this._database_name, this._table_name, this._conditions)).then((result)=>{
                                                return result[1].rows[0].count;
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                },


            }
        }

        // Table
        this.table = (table_name) => {

            // Set the table to be operated on
            this._table_name = table_name; 

            return {

                // Insert a row into a table
                insert: (data) => {

                    // Set the data to be inserted 
                    this._data = data;

                    return {
                        execute: async () => {
                            this.log(`Inserting data into table "${this._table_name}"`);
                            return this.promise(this.db.query(sql.insert(this._database_name, this._table_name, Object.keys(this._data), Object.values(this._data))).then(()=>{
                                this.log(`Data inserted into table "${this._table_name}"`);
                            }));
                        }
                    }
                },

                // Delete a row(s) from a table
                delete: async (conditions) => {
                    const deleteSQL = sql.delete(this._table_name, conditions);
                    await this.db.query(deleteSQL);
                }
            }
        }
    }

    // Get the connection parameters
    getConnectionParameters(){
        /*  ConnectionParameters {
            user: 'root',
            database: 'system',
            port: 26257,
            host: 'ca.pool.manticore.exchange',
            password: null,
            binary: false,
            ssl: false,
            client_encoding: '',
            replication: undefined,
            isDomainSocket: false,
            application_name: undefined,
            fallback_application_name: undefined,
            statement_timeout: false,
            idle_in_transaction_session_timeout: false,
            query_timeout: false,
            connect_timeout: 0 }
        */
        return this.db.connectionParameters;
    }

    // Purge all NON SYSTEM databases
    async purgeDatabases(){
        return new Promise(async (resolve, reject) => {
            this.log('Purging all NON SYSTEM databases');
            const databases = await this.databases();
            for (const database of databases){
                if (database !== 'system' && database !== 'defaultdb' && database !== 'postgres'){
                    await this.database(database).delete().execute();
                }
            }
            resolve();
        });
    }
}

module.exports = CockroachDB;