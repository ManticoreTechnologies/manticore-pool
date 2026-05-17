// Helpers for reading evrmore.conf-style key/value files.

const fs = require('fs');

function parseConfigFile(path) {
    if (!path || !fs.existsSync(path)) {
        return {};
    }

    return fs.readFileSync(path, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line[0] !== '#')
        .reduce((config, line) => {
            const separator = line.indexOf('=');
            if (separator === -1) {
                return config;
            }

            const key = line.slice(0, separator).trim();
            const value = line.slice(separator + 1).trim();
            config[key] = value;
            return config;
        }, {});
}

function getUserAndPassword(path) {
    const config = parseConfigFile(path);
    return {
        user: config.rpcuser || process.env.EVR_RPC_USER || process.env.EVRMORE_RPC_USER || '',
        password: config.rpcpassword || process.env.EVR_RPC_PASSWORD || process.env.EVRMORE_RPC_PASSWORD || ''
    };
}

module.exports = {
    getUserAndPassword,
    parseConfigFile
};