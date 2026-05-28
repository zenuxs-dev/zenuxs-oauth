'use strict';

const ZenuxOAuth = require('./zenux-oauth.js');

async function createOAuthClient(config) {
    return new ZenuxOAuth(config);
}

async function login(config, options = {}) {
    const client = new ZenuxOAuth(config);
    return client.login(options);
}

async function handleCallback(config, callbackUrl = null, options = {}) {
    const client = new ZenuxOAuth(config);
    return client.handleCallback(callbackUrl, options);
}

module.exports = ZenuxOAuth;
module.exports.default = ZenuxOAuth;
module.exports.ZenuxOAuth = ZenuxOAuth;
module.exports.ZenuxOAuthError = ZenuxOAuth.ZenuxOAuthError;
module.exports.createOAuthClient = createOAuthClient;
module.exports.login = login;
module.exports.handleCallback = handleCallback;
