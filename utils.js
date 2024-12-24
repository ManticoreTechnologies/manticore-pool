// Get the user and password from the evrmore.conf file

function getUserAndPassword(path) { 
    const fs = require('fs');
    const configFile = path;
    const config = fs.readFileSync(configFile, 'utf8');
    const configLines = config.split('\n');
    const user = configLines.find(line => line.startsWith('rpcuser')).split('=')[1].trim();
    const password = configLines.find(line => line.startsWith('rpcpassword')).split('=')[1].trim();
    return {
        user,
        password
    }
}

module.exports = {
    getUserAndPassword
}