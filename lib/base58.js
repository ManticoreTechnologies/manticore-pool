const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(58);
const ALPHABET_MAP = ALPHABET.split('').reduce((map, char, index) => {
    map[char] = BigInt(index);
    return map;
}, {});

exports.encode = function(buffer) {
    const source = Buffer.from(buffer || []);
    if (source.length === 0) {
        return '';
    }

    let value = BigInt('0x' + (source.toString('hex') || '0'));
    let encoded = '';
    while (value > 0) {
        const mod = value % BASE;
        encoded = ALPHABET[Number(mod)] + encoded;
        value = value / BASE;
    }

    for (let i = 0; i < source.length && source[i] === 0; i += 1) {
        encoded = '1' + encoded;
    }

    return encoded || '1';
};

exports.decode = function(value) {
    const source = String(value || '');
    if (!source) {
        return Buffer.alloc(0);
    }

    let decoded = BigInt(0);
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (!Object.prototype.hasOwnProperty.call(ALPHABET_MAP, char)) {
            throw new Error('Invalid base58 character');
        }
        decoded = decoded * BASE + ALPHABET_MAP[char];
    }

    let hex = decoded.toString(16);
    if (hex.length % 2) {
        hex = '0' + hex;
    }

    let buffer = decoded === BigInt(0) ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
    let leadingZeros = 0;
    while (leadingZeros < source.length && source[leadingZeros] === '1') {
        leadingZeros += 1;
    }

    if (leadingZeros > 0) {
        buffer = Buffer.concat([Buffer.alloc(leadingZeros), buffer]);
    }

    return buffer;
};
