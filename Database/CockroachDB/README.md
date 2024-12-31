
// Specify the database options
const options = {
    host: 'localhost',
    port: 26257,
    database: 'system', // The database to connect to by default
    user: 'root',
    password: 'password',
    ssl: false
}

// Create a new CockroachDB instance
const cockroachdb = new CockroachDB(options);

// Connect to the default(system in this case) database initially
await cockroachdb.database.connect();

// Fetch all the available databases
const databases = await cockroachdb.database.getAllDatabases(); // Returns a list of strings of database names

// Create a new database
await cockroachdb.database.create('test'); // Returns a void promise

// Delete the database
await cockroachdb.database.delete('test'); 

// Connect to the new database 
await cockroachdb.database.connect('test');

// Create a new table
await cockroachdb.table.create('test', [['id', 'INT'], ['name', 'VARCHAR(255)']]);

// Delete the table
await cockroachdb.table.delete('test');
