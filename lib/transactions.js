var util = require('./util.js');
var base58 = require('./base58.js');

// public members
var txHash;

exports.txHash = function(){
  return txHash;
};

function scriptCompile(addrHash, version){
    if (version === 0x5C) {  // P2SH
        return Buffer.concat([Buffer.from([0xa9, 0x14]), addrHash, Buffer.from([0x87])]);
    } else {  // P2PKH
        return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), addrHash, Buffer.from([0x88, 0xac])]);
    }
}
exports.scriptCompile = scriptCompile;

function fromBase58Check(address) {
    var decoded = base58.decode(address);
    if (decoded.length < 5) {
        throw new Error('Invalid address length');
    }

    var payload = decoded.slice(0, -4);
    var checksum = decoded.slice(-4);
    var expected = util.sha256d(payload).slice(0, 4);
    if (!checksum.equals(expected)) {
        throw new Error('Invalid address checksum');
    }

    return {
        version: payload[0],
        hash: payload.slice(1)
    };
}

exports.fromBase58Check = fromBase58Check;

function scriptForAddress(address) {
    var decoded = fromBase58Check(address);
    return scriptCompile(decoded.hash, decoded.version);
}

exports.scriptForAddress = scriptForAddress;

function writeOutput(value, script) {
    return Buffer.concat([
        util.packInt64LE(value),
        util.varIntBuffer(script.length),
        script
    ]);
}

function serializeTransaction(inputs, outputs) {
    return Buffer.concat([
        util.packUInt32LE(1),
        util.varIntBuffer(inputs.length),
        Buffer.concat(inputs),
        util.varIntBuffer(outputs.length),
        Buffer.concat(outputs),
        util.packUInt32LE(0)
    ]);
}

exports.createGeneration = function(rpcData, blockReward, feeReward, recipients, poolAddress){
    
    var _this = this;
    var blockPollingIntervalId;

    var emitLog = function (text) {
        _this.emit('log', 'debug', text);
    };
    var emitWarningLog = function (text) {
        _this.emit('log', 'warning', text);
    };
    var emitErrorLog = function (text) {
        _this.emit('log', 'error', text);
    };
    var emitSpecialLog = function (text) {
        _this.emit('log', 'special', text);
    };

    var txOutputs = [];
    var blockHeight = rpcData.height;
    // input for coinbase tx
    if (blockHeight.toString(16).length % 2 === 0) {
        var blockHeightSerial = blockHeight.toString(16);
    } else {
        var blockHeightSerial = '0' + blockHeight.toString(16);
    }
    var height = Math.ceil((blockHeight << 1).toString(2).length / 8);
    var lengthDiff = blockHeightSerial.length/2 - height;
    for (var i = 0; i < lengthDiff; i++) {
        blockHeightSerial = blockHeightSerial + '00';
    }
    var length = '0' + height;
    var serializedBlockHeight = new Buffer.concat([
        new Buffer(length, 'hex'),
        util.reverseBuffer(new Buffer(blockHeightSerial, 'hex')),
        new Buffer('00', 'hex') // OP_0
    ]);

    var coinbaseScript = new Buffer.concat([serializedBlockHeight, Buffer('6b6177706f77', 'hex')]);
    var txInputs = [
        Buffer.concat([
            new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            util.packUInt32LE(0xFFFFFFFF),
            util.varIntBuffer(coinbaseScript.length),
            coinbaseScript,
            util.packUInt32LE(0xFFFFFFFF)
        ])
    ];

    // calculate total fees
    var feePercent = 0;
    for (var i = 0; i < recipients.length; i++) {
        feePercent = feePercent + recipients[i].percent;
    }

    txOutputs.push(writeOutput(
        Math.floor(blockReward * (1 - (feePercent / 100))),
        scriptForAddress(poolAddress)
    ));

    for (var i = 0; i < recipients.length; i++) {
        var recipient = recipients[i];
        //console.log('Processing recipient:', recipient.address);
        
        try {
            var decoded = fromBase58Check(recipient.address);
            //console.log('Decoded address:', {
            //    version: decoded.version,
            //    hash: decoded.hash.toString('hex')
            //});
            
            txOutputs.push(writeOutput(
                Math.round((blockReward) * (recipient.percent / 100)),
                scriptCompile(decoded.hash, decoded.version)
            ));
        } catch (e) {
            console.error('Error processing address:', e);
        }
    }


    if (rpcData.default_witness_commitment !== undefined) {
        txOutputs.push(writeOutput(0, new Buffer(rpcData.default_witness_commitment, 'hex')));
    }

    var tx = serializeTransaction(txInputs, txOutputs);
    var txHex = tx.toString('hex');

    // this txHash is used elsewhere. Don't remove it.
    txHash = util.sha256d(tx).toString('hex');

    return txHex;
};

module.exports.getFees = function(feeArray){
    var fee = Number();
    feeArray.forEach(function(value) {
        fee = fee + Number(value.fee);
    });
    return fee;
};
