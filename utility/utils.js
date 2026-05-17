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

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRpcEndpoint(endpoint) {
    if (!endpoint) {
        return {};
    }

    const raw = String(endpoint).trim();
    if (!raw) {
        return {};
    }

    try {
        const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`);
        return {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : undefined,
            user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined
        };
    } catch (error) {
        return { host: raw };
    }
}

function getRpcConfig(configPath, defaultPort) {
    const fileConfig = parseConfigFile(configPath);
    const endpoint = parseRpcEndpoint(process.env.EVR_RPC_URL || process.env.EVRMORE_RPC_URL);
    const hostEndpoint = parseRpcEndpoint(process.env.EVR_RPC_HOST || process.env.EVRMORE_RPC_HOST);
    const credentials = getUserAndPassword(configPath);

    const host = endpoint.host || hostEndpoint.host || fileConfig.rpchost || '127.0.0.1';
    const port = parseNumber(
        process.env.EVR_RPC_PORT || process.env.EVRMORE_RPC_PORT || endpoint.port || hostEndpoint.port || fileConfig.rpcport,
        defaultPort
    );

    return {
        host,
        port,
        user: endpoint.user || credentials.user,
        password: endpoint.password || credentials.password
    };
}

module.exports = {
    getUserAndPassword,
    parseConfigFile,
    getRpcConfig,
    parseRpcEndpoint
};