function normalizeBuffer(buffer, options) {
    let source = Buffer.from(buffer || []);
    if (options && options.endian === 'little') {
        source = Buffer.from(source).reverse();
    }
    return source;
}

function parseValue(value, base) {
    if (value instanceof BigNumCompat) {
        return value.value;
    }
    if (Buffer.isBuffer(value)) {
        const hex = value.toString('hex') || '0';
        return BigInt('0x' + hex);
    }
    if (typeof value === 'bigint') {
        return value;
    }
    if (typeof value === 'number') {
        return BigInt(Math.trunc(value));
    }
    if (typeof value === 'string') {
        const clean = value.trim() || '0';
        if (base === 16) {
            return BigInt('0x' + clean.replace(/^0x/i, ''));
        }
        return BigInt(clean);
    }
    return BigInt(0);
}

function BigNumCompat(value, base) {
    if (!(this instanceof BigNumCompat)) {
        return new BigNumCompat(value, base);
    }
    this.value = parseValue(value, base);
}

BigNumCompat.fromBuffer = function(buffer, options) {
    return new BigNumCompat(normalizeBuffer(buffer, options));
};

BigNumCompat.prototype.toNumber = function() {
    return Number(this.value);
};

BigNumCompat.prototype.toString = function(base) {
    return this.value.toString(base || 10);
};

BigNumCompat.prototype.toBuffer = function() {
    let hex = this.value.toString(16);
    if (hex.length % 2) {
        hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
};

BigNumCompat.prototype.mul = function(other) {
    return new BigNumCompat(this.value * parseValue(other));
};

BigNumCompat.prototype.div = function(other) {
    return new BigNumCompat(this.value / parseValue(other));
};

BigNumCompat.prototype.pow = function(other) {
    return new BigNumCompat(this.value ** parseValue(other));
};

BigNumCompat.prototype.ge = function(other) {
    return this.value >= parseValue(other);
};

module.exports = BigNumCompat;
