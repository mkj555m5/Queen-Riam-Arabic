const __qrPaths = require('../lib/paths'); const __qrDataFile = __qrPaths.dataFile;
const fs = require('fs');
const path = require('path');

function _bannedFile(sessionId) {
    return sessionId
        ? __qrDataFile('banned_' + sessionId + '.json')
        : __qrDataFile('banned.json');
}

function isBanned(userId, sessionId) {
    try {
        const file = _bannedFile(sessionId);
        if (!fs.existsSync(file)) return false;
        const bannedUsers = JSON.parse(fs.readFileSync(file, 'utf8'));
        return bannedUsers.includes(userId);
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned };
