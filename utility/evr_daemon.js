const daemon = require('../lib/daemon.js');

function createDaemon(options){
    const Daemon = new daemon.interface([options.daemons[0]], function (severity, message) {
        console.log(severity + ': ' + message);
    });
    return Daemon;
}

module.exports = {createDaemon};