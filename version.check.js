// Check node version
const requiredVersion = '8.1.4'; // Example required version
const currentVersion = process.version;

function compareVersions(v1, v2) {
    const v1Parts = v1.replace('v', '').split('.').map(Number);
    const v2Parts = v2.replace('v', '').split('.').map(Number);

    for (let i = 0; i < v1Parts.length; i++) {
        if (v1Parts[i] > v2Parts[i]) return 1;
        if (v1Parts[i] < v2Parts[i]) return -1;
    }
    return 0;
}

if (compareVersions(currentVersion, requiredVersion) !== 0) {
    console.error(`Node.js version must be exactly ${requiredVersion}. Current version: ${currentVersion}`);
    process.exit(1);
} else {
    //console.log(`Node.js version is correct: ${currentVersion}`);
}