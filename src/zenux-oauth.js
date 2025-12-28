// zenux-oauth.js - Universal OAuth 2.0 Client
// Supports: Browser, Node.js, React, Next.js, React Native
// Single file, no dependencies

'use strict';

// ==================== ENVIRONMENT DETECTION ====================
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// ==================== ERROR CLASS ====================
class ZenuxOAuthError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ZenuxOAuthError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

// ==================== STORAGE MANAGER ====================
class StorageManager {
    constructor(prefix = 'zenux_oauth_', type = 'auto') {
        this.prefix = prefix;
        this.memory = new Map();
        
        if (type === 'auto') {
            this.type = this.detectStorageType();
        } else {
            this.type = type;
        }
    }

    detectStorageType() {
        if (!isBrowser) return 'memory';
        
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return 'localStorage';
        } catch {
            try {
                sessionStorage.setItem('test', 'test');
                sessionStorage.removeItem('test');
                return 'sessionStorage';
            } catch {
                return 'memory';
            }
        }
    }

    get(key) {
        const fullKey = this.prefix + key;
        
        if (this.type === 'memory') {
            return this.memory.get(fullKey);
        }
        
        if (!isBrowser) return null;
        
        try {
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            return storage.getItem(fullKey);
        } catch {
            return this.memory.get(fullKey);
        }
    }

    set(key, value) {
        const fullKey = this.prefix + key;
        
        if (this.type === 'memory') {
            this.memory.set(fullKey, value);
            return;
        }
        
        if (!isBrowser) {
            this.memory.set(fullKey, value);
            return;
        }
        
        try {
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            storage.setItem(fullKey, value);
        } catch {
            this.memory.set(fullKey, value);
        }
    }

    remove(key) {
        const fullKey = this.prefix + key;
        
        this.memory.delete(fullKey);
        
        if (!isBrowser) return;
        
        try {
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            storage.removeItem(fullKey);
        } catch {
            // Ignore
        }
    }

    clear() {
        this.memory.clear();
        
        if (!isBrowser) return;
        
        try {
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key.startsWith(this.prefix)) {
                    storage.removeItem(key);
                    i--;
                }
            }
        } catch {
            // Ignore
        }
    }
}

// ==================== CRYPTO UTILITIES ====================
const CryptoUtils = {
    generateRandomString(length = 128) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        
        if (isNode) {
            try {
                const crypto = require('crypto');
                const randomBytes = crypto.randomBytes(length);
                for (let i = 0; i < length; i++) {
                    result += charset[randomBytes[i] % charset.length];
                }
                return result;
            } catch {
                // Fall through
            }
        }
        
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const randomValues = new Uint8Array(length);
            crypto.getRandomValues(randomValues);
            for (let i = 0; i < length; i++) {
                result += charset[randomValues[i] % charset.length];
            }
            return result;
        }
        
        // Fallback
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    },

    async sha256(plain) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        
        if (isNode) {
            try {
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256').update(data).digest('base64');
                return hash
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
            } catch {
                // Fall through
            }
        }
        
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const hash = await crypto.subtle.digest('SHA-256', data);
            return this.base64UrlEncode(new Uint8Array(hash));
        }
        
        throw new ZenuxOAuthError('SHA-256 not supported', 'CRYPTO_NOT_SUPPORTED');
    },

    base64UrlEncode(buffer) {
        let base64 = '';
        
        if (isNode && Buffer.isBuffer(buffer)) {
            base64 = buffer.toString('base64');
        } else if (buffer instanceof Uint8Array) {
            if (typeof btoa !== 'undefined') {
                base64 = btoa(String.fromCharCode(...buffer));
            } else if (isNode) {
                base64 = Buffer.from(buffer).toString('base64');
            }
        }
        
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
};

// ==================== MAIN OAUTH CLASS ====================
class ZenuxOAuth {
    constructor(config = {}) {
        this.validateConfig(config);
        
        this.config = {
            clientId: config.clientId,
            authServer: config.authServer || 'https://api.auth.zenuxs.in',
            redirectUri: config.redirectUri || this.getDefaultRedirectUri(),
            scopes: config.scopes || 'openid profile email',
            authorizeEndpoint: config.authorizeEndpoint || '/oauth/authorize',
            tokenEndpoint: config.tokenEndpoint || '/oauth/token',
            userinfoEndpoint: config.userinfoEndpoint || '/oauth/userinfo',
            revokeEndpoint: config.revokeEndpoint || '/oauth/revoke',
            storage: config.storage || 'memory',
            storagePrefix: config.storagePrefix || 'zenux_oauth_',
            usePKCE: config.usePKCE !== false,
            validateState: config.validateState !== false,
            debug: config.debug || false,
            fetchFunction: config.fetchFunction || this.getFetchFunction(),
            ...config
        };

        this.storage = new StorageManager(this.config.storagePrefix, this.config.storage);
        this.session = {
            codeVerifier: null,
            state: null,
            tokens: null
        };
        
        this.loadSession();
        this.debugLog('Initialized', { environment: isBrowser ? 'browser' : 'node' });
    }

    validateConfig(config) {
        if (!config.clientId) {
            throw new ZenuxOAuthError('clientId is required', 'INVALID_CONFIG');
        }
    }

    getDefaultRedirectUri() {
        if (isBrowser && window.location) {
            return `${window.location.origin}/callback`;
        }
        return 'http://localhost:3000/callback';
    }

    getFetchFunction() {
        if (this.config.fetchFunction) return this.config.fetchFunction;
        
        if (typeof fetch !== 'undefined') {
            return fetch.bind(globalThis);
        }
        
        if (isNode) {
            try {
                return require('node-fetch');
            } catch {
                throw new ZenuxOAuthError(
                    'Fetch not available. Install node-fetch or provide fetchFunction',
                    'FETCH_UNAVAILABLE'
                );
            }
        }
        
        throw new ZenuxOAuthError('Fetch not available', 'FETCH_UNAVAILABLE');
    }

    loadSession() {
        const tokensStr = this.storage.get('tokens');
        if (tokensStr) {
            try {
                this.session.tokens = JSON.parse(tokensStr);
            } catch {
                this.storage.remove('tokens');
            }
        }
    }

    debugLog(message, data = null) {
        if (!this.config.debug) return;
        console.log(`[ZenuxOAuth] ${message}`, data || '');
    }

    // ==================== OAUTH FLOW ====================
    async login(options = {}) {
        try {
            // Generate PKCE code verifier
            if (this.config.usePKCE) {
                this.session.codeVerifier = CryptoUtils.generateRandomString(128);
                this.session.codeChallenge = await CryptoUtils.sha256(this.session.codeVerifier);
                this.storage.set('code_verifier', this.session.codeVerifier);
            }

            // Generate state
            this.session.state = CryptoUtils.generateRandomString(32);
            this.storage.set('state', this.session.state);

            // Build authorization URL
            const params = new URLSearchParams({
                client_id: this.config.clientId,
                redirect_uri: options.redirectUri || this.config.redirectUri,
                response_type: 'code',
                scope: options.scopes || this.config.scopes,
                state: this.session.state
            });

            if (this.config.usePKCE) {
                params.append('code_challenge', this.session.codeChallenge);
                params.append('code_challenge_method', 'S256');
            }

            const authUrl = `${this.config.authServer}${this.config.authorizeEndpoint}?${params.toString()}`;
            
            this.debugLog('Authorization URL', authUrl);

            if (isBrowser && !options.noRedirect) {
                window.location.href = authUrl;
                return null;
            }

            return {
                url: authUrl,
                state: this.session.state,
                codeVerifier: this.session.codeVerifier
            };
        } catch (error) {
            this.debugLog('Login error', error);
            throw error;
        }
    }

    async handleCallback(callbackUrl = null) {
        try {
            let url;
            if (callbackUrl) {
                url = callbackUrl;
            } else if (isBrowser) {
                url = window.location.href;
            } else {
                throw new ZenuxOAuthError('Callback URL required', 'NO_CALLBACK_URL');
            }

            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);

            const code = params.get('code');
            const state = params.get('state');
            const error = params.get('error');

            if (error) {
                throw new ZenuxOAuthError(params.get('error_description') || error, 'OAUTH_ERROR');
            }

            if (!code) {
                throw new ZenuxOAuthError('No authorization code', 'NO_CODE');
            }

            // Validate state
            if (this.config.validateState) {
                const storedState = this.storage.get('state');
                if (state !== storedState) {
                    throw new ZenuxOAuthError('State mismatch', 'STATE_MISMATCH');
                }
            }

            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(code);
            
            // Store tokens
            this.session.tokens = tokens;
            this.storage.set('tokens', JSON.stringify(tokens));
            
            // Clean up
            this.storage.remove('code_verifier');
            this.storage.remove('state');

            this.debugLog('Tokens received', { 
                access_token: tokens.access_token ? 'yes' : 'no',
                refresh_token: tokens.refresh_token ? 'yes' : 'no' 
            });

            return tokens;
        } catch (error) {
            this.debugLog('Callback error', error);
            throw error;
        }
    }

    async exchangeCodeForTokens(code) {
        const tokenData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.config.redirectUri,
            client_id: this.config.clientId
        });

        if (this.config.usePKCE) {
            const codeVerifier = this.storage.get('code_verifier');
            if (codeVerifier) {
                tokenData.append('code_verifier', codeVerifier);
            }
        }

        const response = await this.config.fetchFunction(
            `${this.config.authServer}${this.config.tokenEndpoint}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: tokenData.toString()
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Token exchange failed: ${response.status}`,
                'TOKEN_EXCHANGE_FAILED',
                { status: response.status, response: errorText }
            );
        }

        const tokens = await response.json();
        
        if (tokens.expires_in) {
            tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
        }

        return tokens;
    }

    // ==================== TOKEN MANAGEMENT ====================
    getTokens() {
        return this.session.tokens;
    }

    getAccessToken() {
        return this.session.tokens?.access_token;
    }

    isAuthenticated() {
        const tokens = this.getTokens();
        return !!(tokens?.access_token && !this.isTokenExpired());
    }

    isTokenExpired() {
        const tokens = this.getTokens();
        if (!tokens?.expires_at) return false;
        return Date.now() >= tokens.expires_at;
    }

    async refreshTokens() {
        try {
            const tokens = this.getTokens();
            if (!tokens?.refresh_token) {
                throw new ZenuxOAuthError('No refresh token', 'NO_REFRESH_TOKEN');
            }

            const response = await this.config.fetchFunction(
                `${this.config.authServer}${this.config.tokenEndpoint}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: tokens.refresh_token,
                        client_id: this.config.clientId
                    }).toString()
                }
            );

            if (!response.ok) {
                throw new ZenuxOAuthError('Token refresh failed', 'REFRESH_FAILED');
            }

            const newTokens = await response.json();
            
            if (newTokens.expires_in) {
                newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);
            }

            // Preserve refresh token if not returned
            if (!newTokens.refresh_token) {
                newTokens.refresh_token = tokens.refresh_token;
            }

            this.session.tokens = newTokens;
            this.storage.set('tokens', JSON.stringify(newTokens));

            return newTokens;
        } catch (error) {
            this.debugLog('Refresh error', error);
            throw error;
        }
    }

    // ==================== USER INFO ====================
    async getUserInfo() {
        try {
            const accessToken = this.getAccessToken();
            if (!accessToken) {
                throw new ZenuxOAuthError('No access token', 'NO_ACCESS_TOKEN');
            }

            const response = await this.config.fetchFunction(
                `${this.config.authServer}${this.config.userinfoEndpoint}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new ZenuxOAuthError('UserInfo request failed', 'USERINFO_FAILED');
            }

            return response.json();
        } catch (error) {
            this.debugLog('UserInfo error', error);
            throw error;
        }
    }

    // ==================== LOGOUT ====================
    async logout(options = {}) {
        try {
            const hadTokens = this.isAuthenticated();

            // Revoke tokens if requested
            if (options.revoke && this.session.tokens) {
                try {
                    await this.revokeToken(this.session.tokens.access_token, 'access_token');
                    if (this.session.tokens.refresh_token) {
                        await this.revokeToken(this.session.tokens.refresh_token, 'refresh_token');
                    }
                } catch (error) {
                    this.debugLog('Revoke failed', error);
                }
            }

            // Clear session
            this.session = { codeVerifier: null, state: null, tokens: null };
            this.storage.clear();

            return hadTokens;
        } catch (error) {
            this.debugLog('Logout error', error);
            throw error;
        }
    }

    async revokeToken(token, tokenType = 'access_token') {
        try {
            const response = await this.config.fetchFunction(
                `${this.config.authServer}${this.config.revokeEndpoint}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        token: token,
                        token_type_hint: tokenType,
                        client_id: this.config.clientId
                    }).toString()
                }
            );

            if (!response.ok) {
                throw new ZenuxOAuthError('Revoke failed', 'REVOKE_FAILED');
            }

            return true;
        } catch (error) {
            this.debugLog('Revoke error', error);
            throw error;
        }
    }

    // ==================== UTILITIES ====================
    getAuthenticatedFetch() {
        return async (url, options = {}) => {
            // Refresh if expired
            if (this.isTokenExpired() && this.session.tokens?.refresh_token) {
                await this.refreshTokens();
            }

            const accessToken = this.getAccessToken();
            if (!accessToken) {
                throw new ZenuxOAuthError('No access token', 'NO_ACCESS_TOKEN');
            }

            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                ...options.headers
            };

            return this.config.fetchFunction(url, { ...options, headers });
        };
    }

    decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            
            let jsonPayload;
            if (isNode) {
                jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
            } else {
                jsonPayload = decodeURIComponent(
                    atob(base64).split('').map(c =>
                        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                    ).join('')
                );
            }
            
            return JSON.parse(jsonPayload);
        } catch {
            return null;
        }
    }

    getSessionState() {
        const tokens = this.getTokens();
        return {
            isAuthenticated: this.isAuthenticated(),
            tokens: tokens,
            expiresAt: tokens?.expires_at,
            timeUntilExpiry: tokens?.expires_at ? 
                Math.max(0, (tokens.expires_at - Date.now()) / 1000) : null
        };
    }
}

// ==================== EXPORT ====================
// Simple export for all environments
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS/Node.js
    module.exports = ZenuxOAuth;
    module.exports.ZenuxOAuthError = ZenuxOAuthError;
} else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() {
        return {
            ZenuxOAuth: ZenuxOAuth,
            ZenuxOAuthError: ZenuxOAuthError
        };
    });
} else if (typeof window !== 'undefined') {
    // Browser global
    window.ZenuxOAuth = ZenuxOAuth;
    window.ZenuxOAuthError = ZenuxOAuthError;
} else if (typeof global !== 'undefined') {
    // Node.js global
    global.ZenuxOAuth = ZenuxOAuth;
    global.ZenuxOAuthError = ZenuxOAuthError;
}

// Optional: Export as ES module if supported
if (typeof exports !== 'undefined') {
    exports.ZenuxOAuth = ZenuxOAuth;
    exports.ZenuxOAuthError = ZenuxOAuthError;
}   