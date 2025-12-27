// ZenuxOAuth 2.3.0 - Universal OAuth 2.0 PKCE Client Library
// Supports: Browser, Node.js, React, Next.js, React Native, Web Workers
// Single-file implementation - No dependencies

(function (global, factory) {
    // UMD Pattern - Universal Module Definition
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof module !== 'undefined' && module.exports) {
        // CommonJS/Node
        module.exports = factory();
    } else {
        // Browser global
        global.ZenuxOAuth = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ==================== ENVIRONMENT DETECTION ====================
    const Environment = {
        isBrowser: typeof window !== 'undefined' && typeof document !== 'undefined',
        isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative',
        isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
        isWebWorker: typeof importScripts !== 'undefined',
        isNextJs: typeof process !== 'undefined' && process.env && 
                  (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_PHASE),
        getEnvironment() {
            if (this.isReactNative) return 'react-native';
            if (this.isNode) return 'node';
            if (this.isWebWorker) return 'web-worker';
            if (this.isNextJs) return 'nextjs';
            if (this.isBrowser) return 'browser';
            return 'unknown';
        }
    };

    // ==================== ERROR CLASS ====================
    class ZenuxOAuthError extends Error {
        constructor(message, code, details = {}) {
            super(message);
            this.name = 'ZenuxOAuthError';
            this.code = code;
            this.details = details;
            this.timestamp = new Date().toISOString();
            this.environment = Environment.getEnvironment();
        }

        toJSON() {
            return {
                name: this.name,
                code: this.code,
                message: this.message,
                details: this.details,
                timestamp: this.timestamp,
                environment: this.environment
            };
        }
    }

    // ==================== CRYPTO UTILITIES ====================
    const CryptoUtils = {
        // Generate random string for PKCE
        generateRandomString(length = 128) {
            const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
            
            if (Environment.isNode && typeof crypto !== 'undefined') {
                // Node.js with Web Crypto API
                const randomBytes = crypto.randomBytes(length);
                return Array.from(randomBytes, byte => 
                    charset[byte % charset.length]
                ).join('');
            }
            
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                // Browser/Web Worker
                const randomValues = new Uint8Array(length);
                crypto.getRandomValues(randomValues);
                return Array.from(randomValues, byte => 
                    charset[byte % charset.length]
                ).join('');
            }
            
            // Fallback for older environments
            let result = '';
            for (let i = 0; i < length; i++) {
                result += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            return result;
        },

        // SHA-256 hash for PKCE
        async sha256(plain) {
            const encoder = new TextEncoder();
            const data = encoder.encode(plain);
            
            if (Environment.isNode) {
                // Node.js crypto module
                if (typeof require !== 'undefined') {
                    const nodeCrypto = require('crypto');
                    const hash = nodeCrypto.createHash('sha256').update(data).digest();
                    return this.base64UrlEncode(hash);
                } else if (typeof crypto !== 'undefined' && crypto.subtle) {
                    // Node.js with Web Crypto API
                    const hash = await crypto.subtle.digest('SHA-256', data);
                    return this.base64UrlEncode(new Uint8Array(hash));
                }
            }
            
            if (typeof crypto !== 'undefined' && crypto.subtle) {
                // Browser/Web Worker
                const hash = await crypto.subtle.digest('SHA-256', data);
                return this.base64UrlEncode(new Uint8Array(hash));
            }
            
            throw new ZenuxOAuthError(
                'SHA-256 not supported. Requires Web Crypto API.',
                'CRYPTO_NOT_SUPPORTED'
            );
        },

        base64UrlEncode(buffer) {
            let base64 = '';
            
            if (Environment.isNode && Buffer.isBuffer(buffer)) {
                base64 = buffer.toString('base64');
            } else if (buffer instanceof Uint8Array) {
                if (typeof btoa !== 'undefined') {
                    base64 = btoa(String.fromCharCode(...buffer));
                } else if (Environment.isNode) {
                    base64 = Buffer.from(buffer).toString('base64');
                }
            }
            
            return base64
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        }
    };

    // ==================== STORAGE MANAGER ====================
    class StorageManager {
        constructor(config = {}) {
            this.prefix = config.storagePrefix || 'zenux_oauth_';
            this.type = config.storage || this.detectStorageType();
            this.memory = new Map();
        }

        detectStorageType() {
            if (!Environment.isBrowser) return 'memory';
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
            
            if (!Environment.isBrowser) return null;
            
            try {
                const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
                return storage.getItem(fullKey);
            } catch (e) {
                return this.memory.get(fullKey);
            }
        }

        set(key, value) {
            const fullKey = this.prefix + key;
            
            if (this.type === 'memory') {
                this.memory.set(fullKey, value);
                return;
            }
            
            if (!Environment.isBrowser) {
                this.memory.set(fullKey, value);
                return;
            }
            
            try {
                const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
                storage.setItem(fullKey, value);
            } catch (e) {
                this.memory.set(fullKey, value);
            }
        }

        remove(key) {
            const fullKey = this.prefix + key;
            
            this.memory.delete(fullKey);
            
            if (!Environment.isBrowser) return;
            
            try {
                const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
                storage.removeItem(fullKey);
            } catch (e) {
                // Ignore storage errors
            }
        }

        clear() {
            this.memory.clear();
            
            if (!Environment.isBrowser) return;
            
            try {
                const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
                const keysToRemove = [];
                
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key.startsWith(this.prefix)) {
                        keysToRemove.push(key);
                    }
                }
                
                keysToRemove.forEach(key => storage.removeItem(key));
            } catch (e) {
                // Ignore storage errors
            }
        }
    }

    // ==================== HTTP CLIENT ====================
    class HttpClient {
        constructor(config = {}) {
            this.config = config;
            this.fetch = this.getFetchFunction();
        }

        getFetchFunction() {
            // Use provided fetch function
            if (this.config.fetchFunction) return this.config.fetchFunction;
            
            // Next.js server components
            if (typeof globalThis !== 'undefined' && globalThis.fetch) {
                return globalThis.fetch.bind(globalThis);
            }
            
            // Node.js 18+ or with node-fetch
            if (typeof fetch !== 'undefined') {
                return fetch;
            }
            
            // React Native
            if (Environment.isReactNative) {
                try {
                    return global.fetch || require('react-native').fetch;
                } catch {
                    // Fall through
                }
            }
            
            throw new ZenuxOAuthError(
                'Fetch is not available. Please provide a fetchFunction.',
                'FETCH_UNAVAILABLE'
            );
        }

        async request(url, options = {}) {
            try {
                const response = await this.fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        ...options.headers
                    },
                    ...options
                });

                if (!response.ok) {
                    let errorDetails;
                    try {
                        errorDetails = await response.json();
                    } catch {
                        errorDetails = await response.text();
                    }

                    throw new ZenuxOAuthError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        'HTTP_ERROR',
                        {
                            status: response.status,
                            statusText: response.statusText,
                            url,
                            details: errorDetails
                        }
                    );
                }

                return response;
            } catch (error) {
                if (error instanceof ZenuxOAuthError) throw error;
                
                throw new ZenuxOAuthError(
                    `Network error: ${error.message}`,
                    'NETWORK_ERROR',
                    { originalError: error.message, url }
                );
            }
        }

        async getJSON(url, options = {}) {
            const response = await this.request(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            return response.json();
        }

        async postForm(url, data, options = {}) {
            const formData = new URLSearchParams();
            Object.entries(data).forEach(([key, value]) => {
                formData.append(key, value);
            });

            const response = await this.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...options.headers
                },
                body: formData.toString(),
                ...options
            });
            return response.json();
        }
    }

    // ==================== MAIN OAUTH CLASS ====================
    class ZenuxOAuth {
        constructor(config = {}) {
            this.validateConfig(config);
            
            this.config = {
                // Required
                clientId: config.clientId,
                
                // Server configuration
                authServer: config.authServer || 'https://api.auth.zenuxs.in',
                authorizeEndpoint: config.authorizeEndpoint || '/oauth/authorize',
                tokenEndpoint: config.tokenEndpoint || '/oauth/token',
                userinfoEndpoint: config.userinfoEndpoint || '/oauth/userinfo',
                revokeEndpoint: config.revokeEndpoint || '/oauth/revoke',
                
                // Client configuration
                redirectUri: config.redirectUri || this.getDefaultRedirectUri(),
                scopes: config.scopes || 'openid profile email',
                usePKCE: config.usePKCE !== false,
                useCSRF: config.useCSRF !== false && Environment.isBrowser,
                validateState: config.validateState !== false,
                
                // Storage
                storage: config.storage,
                storagePrefix: config.storagePrefix || 'zenux_oauth_',
                
                // Auto refresh
                autoRefresh: config.autoRefresh !== false,
                refreshThreshold: config.refreshThreshold || 300, // 5 minutes
                
                // UI
                popupWidth: config.popupWidth || 600,
                popupHeight: config.popupHeight || 700,
                
                // Extras
                extraAuthParams: config.extraAuthParams || {},
                extraTokenParams: config.extraTokenParams || {},
                
                // Hooks
                onBeforeLogin: config.onBeforeLogin || null,
                onAfterLogin: config.onAfterLogin || null,
                onBeforeLogout: config.onBeforeLogout || null,
                onAfterLogout: config.onAfterLogout || null,
                
                // Debug
                debug: config.debug || false,
                
                // Platform-specific
                fetchFunction: config.fetchFunction || null,
                crypto: config.crypto || null,
                
                environment: Environment.getEnvironment()
            };

            // Initialize components
            this.storage = new StorageManager(this.config);
            this.http = new HttpClient(this.config);
            this.session = this.loadSession();
            
            // Event system
            this.events = {
                login: [],
                logout: [],
                tokenRefresh: [],
                error: [],
                tokenExpired: []
            };
            
            // Auto-refresh setup
            this.refreshInterval = null;
            this.setupAutoRefresh();
            
            // Debug log
            this.debugLog('ZenuxOAuth initialized', {
                environment: this.config.environment,
                clientId: this.config.clientId,
                redirectUri: this.config.redirectUri
            });
        }

        validateConfig(config) {
            const errors = [];
            
            if (!config.clientId) {
                errors.push('clientId is required');
            }
            
            if (config.redirectUri && !this.isValidUrl(config.redirectUri)) {
                errors.push('redirectUri must be a valid URL');
            }
            
            if (config.authServer && !this.isValidUrl(config.authServer)) {
                errors.push('authServer must be a valid URL');
            }
            
            if (errors.length > 0) {
                throw new ZenuxOAuthError(
                    `Invalid configuration: ${errors.join(', ')}`,
                    'INVALID_CONFIG'
                );
            }
        }

        isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch {
                return false;
            }
        }

        getDefaultRedirectUri() {
            if (Environment.isBrowser && window.location) {
                // Remove query parameters and hash
                const baseUrl = window.location.origin + window.location.pathname;
                // Check if we're already on a callback page
                if (baseUrl.includes('callback')) {
                    return baseUrl;
                }
                return baseUrl.replace(/\/$/, '') + '/callback';
            }
            return 'http://localhost:3000/callback';
        }

        loadSession() {
            const session = {
                codeVerifier: null,
                state: null,
                tokens: null,
                csrfToken: null,
                nonce: null
            };
            
            // Load tokens from storage
            const tokensStr = this.storage.get('tokens');
            if (tokensStr) {
                try {
                    session.tokens = JSON.parse(tokensStr);
                } catch (e) {
                    this.storage.remove('tokens');
                }
            }
            
            return session;
        }

        // ==================== OAUTH FLOW ====================
        async login(options = {}) {
            try {
                // Call before login hook
                if (this.config.onBeforeLogin) {
                    await this.config.onBeforeLogin();
                }

                this.debugLog('Starting OAuth login', options);

                // Generate PKCE code verifier if enabled
                if (this.config.usePKCE) {
                    this.session.codeVerifier = CryptoUtils.generateRandomString(128);
                    this.session.codeChallenge = await CryptoUtils.sha256(this.session.codeVerifier);
                    this.storage.set('code_verifier', this.session.codeVerifier);
                }

                // Generate state and nonce
                this.session.state = CryptoUtils.generateRandomString(32);
                this.session.nonce = CryptoUtils.generateRandomString(32);
                
                this.storage.set('state', this.session.state);
                this.storage.set('nonce', this.session.nonce);

                if (this.config.useCSRF) {
                    this.session.csrfToken = CryptoUtils.generateRandomString(32);
                    this.storage.set('csrf_token', this.session.csrfToken);
                }

                // Build authorization URL
                const authUrl = this.buildAuthUrl(options);

                this.debugLog('Authorization URL', authUrl);

                // Handle different login methods
                if (Environment.isBrowser) {
                    if (options.popup) {
                        return this.loginWithPopup(authUrl, options);
                    } else if (options.silent) {
                        return this.loginSilent(authUrl, options);
                    } else {
                        window.location.href = authUrl;
                        return null;
                    }
                } else {
                    // Non-browser environments return URL for manual redirect
                    return {
                        type: 'authorization_url',
                        url: authUrl,
                        state: this.session.state,
                        codeVerifier: this.session.codeVerifier,
                        nonce: this.session.nonce
                    };
                }
            } catch (error) {
                this.handleError(error, 'login');
                throw error;
            }
        }

        buildAuthUrl(options = {}) {
            const params = new URLSearchParams({
                client_id: this.config.clientId,
                redirect_uri: options.redirectUri || this.config.redirectUri,
                response_type: 'code',
                scope: options.scopes || this.config.scopes,
                state: this.session.state,
                nonce: this.session.nonce,
                ...this.config.extraAuthParams,
                ...(options.extraParams || {})
            });

            if (this.config.usePKCE && this.session.codeChallenge) {
                params.append('code_challenge', this.session.codeChallenge);
                params.append('code_challenge_method', 'S256');
            }

            return `${this.config.authServer}${this.config.authorizeEndpoint}?${params.toString()}`;
        }

        loginWithPopup(authUrl, options = {}) {
            return new Promise((resolve, reject) => {
                if (!Environment.isBrowser) {
                    reject(new ZenuxOAuthError('Popup login requires browser', 'POPUP_NOT_SUPPORTED'));
                    return;
                }

                const width = options.popupWidth || this.config.popupWidth;
                const height = options.popupHeight || this.config.popupHeight;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;

                const popup = window.open(
                    authUrl,
                    options.popupName || 'zenux_auth',
                    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                );

                if (!popup) {
                    reject(new ZenuxOAuthError('Popup blocked by browser', 'POPUP_BLOCKED'));
                    return;
                }

                const pollTimer = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(pollTimer);
                        clearTimeout(timeout);
                        window.removeEventListener('message', messageHandler);
                        
                        const tokens = this.getTokens();
                        if (tokens) {
                            resolve(tokens);
                        } else {
                            reject(new ZenuxOAuthError('Authentication cancelled', 'AUTH_CANCELLED'));
                        }
                    }
                }, 1000);

                const timeout = setTimeout(() => {
                    clearInterval(pollTimer);
                    popup.close();
                    window.removeEventListener('message', messageHandler);
                    reject(new ZenuxOAuthError('Login timeout', 'LOGIN_TIMEOUT'));
                }, options.timeout || 300000); // 5 minutes

                const messageHandler = (event) => {
                    if (event.data?.type === 'zenux_oauth_callback') {
                        clearInterval(pollTimer);
                        clearTimeout(timeout);
                        popup.close();
                        window.removeEventListener('message', messageHandler);
                        
                        if (event.data.success) {
                            this.handleTokens(event.data.tokens);
                            resolve(event.data.tokens);
                        } else {
                            reject(new ZenuxOAuthError(
                                event.data.error || 'Authentication failed',
                                event.data.code || 'AUTH_FAILED'
                            ));
                        }
                    }
                };

                window.addEventListener('message', messageHandler);
            });
        }

        loginSilent(authUrl, options = {}) {
            return new Promise((resolve, reject) => {
                if (!Environment.isBrowser) {
                    reject(new ZenuxOAuthError('Silent login requires browser', 'SILENT_NOT_SUPPORTED'));
                    return;
                }

                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = authUrl;

                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new ZenuxOAuthError('Silent login timeout', 'SILENT_TIMEOUT'));
                }, options.timeout || 30000);

                const messageHandler = (event) => {
                    if (event.data?.type === 'zenux_oauth_callback') {
                        cleanup();
                        if (event.data.success) {
                            this.handleTokens(event.data.tokens);
                            resolve(event.data.tokens);
                        } else {
                            reject(new ZenuxOAuthError(event.data.error, 'SILENT_AUTH_FAILED'));
                        }
                    }
                };

                const cleanup = () => {
                    clearTimeout(timeout);
                    window.removeEventListener('message', messageHandler);
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                    }
                };

                window.addEventListener('message', messageHandler);
                document.body.appendChild(iframe);
            });
        }

        async handleCallback(callbackUrl = null) {
            try {
                this.debugLog('Handling OAuth callback');

                let url;
                if (callbackUrl) {
                    url = callbackUrl;
                } else if (Environment.isBrowser) {
                    url = window.location.href;
                } else {
                    throw new ZenuxOAuthError(
                        'Callback URL required in non-browser environment',
                        'CALLBACK_URL_REQUIRED'
                    );
                }

                const urlObj = new URL(url);
                const params = new URLSearchParams(urlObj.search);

                const code = params.get('code');
                const state = params.get('state');
                const error = params.get('error');
                const errorDescription = params.get('error_description');

                if (error) {
                    throw new ZenuxOAuthError(
                        errorDescription || error,
                        'OAUTH_ERROR',
                        { error, errorDescription }
                    );
                }

                if (!code) {
                    throw new ZenuxOAuthError('No authorization code received', 'NO_CODE');
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
                
                // Handle the tokens
                this.handleTokens(tokens);
                
                // Clean up URL in browser
                if (Environment.isBrowser && history.replaceState) {
                    const cleanUrl = window.location.origin + window.location.pathname;
                    history.replaceState({}, document.title, cleanUrl);
                }

                // Notify parent window if in popup
                if (Environment.isBrowser && window.opener) {
                    window.opener.postMessage({
                        type: 'zenux_oauth_callback',
                        success: true,
                        tokens: tokens
                    }, '*');
                }

                return tokens;
            } catch (error) {
                this.handleError(error, 'callback');
                
                // Notify parent window of error
                if (Environment.isBrowser && window.opener) {
                    window.opener.postMessage({
                        type: 'zenux_oauth_callback',
                        success: false,
                        error: error.message,
                        code: error.code
                    }, '*');
                }
                
                throw error;
            }
        }

        async exchangeCodeForTokens(code) {
            const tokenData = {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                ...this.config.extraTokenParams
            };

            if (this.config.usePKCE) {
                const codeVerifier = this.storage.get('code_verifier');
                if (!codeVerifier) {
                    throw new ZenuxOAuthError('No code verifier found', 'NO_CODE_VERIFIER');
                }
                tokenData.code_verifier = codeVerifier;
            }

            const response = await this.http.postForm(
                `${this.config.authServer}${this.config.tokenEndpoint}`,
                tokenData
            );

            if (response.expires_in) {
                response.expires_at = Date.now() + (response.expires_in * 1000);
            }

            return response;
        }

        handleTokens(tokens) {
            this.session.tokens = tokens;
            this.storage.set('tokens', JSON.stringify(tokens));
            
            // Clean up temporary storage
            this.storage.remove('code_verifier');
            this.storage.remove('state');
            this.storage.remove('nonce');
            this.storage.remove('csrf_token');
            
            // Call after login hook
            if (this.config.onAfterLogin) {
                this.config.onAfterLogin(tokens);
            }
            
            // Emit login event
            this.emit('login', tokens);
            
            this.debugLog('Tokens received and stored', {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                expiresAt: tokens.expires_at
            });
        }

        // ==================== TOKEN MANAGEMENT ====================
        getTokens() {
            if (this.session.tokens) return this.session.tokens;
            
            const tokensStr = this.storage.get('tokens');
            if (tokensStr) {
                try {
                    this.session.tokens = JSON.parse(tokensStr);
                    return this.session.tokens;
                } catch (e) {
                    this.storage.remove('tokens');
                }
            }
            
            return null;
        }

        getAccessToken() {
            const tokens = this.getTokens();
            return tokens?.access_token || null;
        }

        isAuthenticated() {
            const tokens = this.getTokens();
            return !!(tokens?.access_token && !this.isTokenExpired());
        }

        isTokenExpired() {
            const tokens = this.getTokens();
            if (!tokens?.expires_at) return false;
            
            const isExpired = Date.now() >= tokens.expires_at;
            if (isExpired) {
                this.emit('tokenExpired', tokens);
            }
            return isExpired;
        }

        async refreshTokens() {
            try {
                const tokens = this.getTokens();
                if (!tokens?.refresh_token) {
                    throw new ZenuxOAuthError('No refresh token available', 'NO_REFRESH_TOKEN');
                }

                this.debugLog('Refreshing tokens');

                const response = await this.http.postForm(
                    `${this.config.authServer}${this.config.tokenEndpoint}`,
                    {
                        grant_type: 'refresh_token',
                        refresh_token: tokens.refresh_token,
                        client_id: this.config.clientId,
                        ...this.config.extraTokenParams
                    }
                );

                if (response.expires_in) {
                    response.expires_at = Date.now() + (response.expires_in * 1000);
                }

                // Preserve refresh token if not returned
                if (!response.refresh_token && tokens.refresh_token) {
                    response.refresh_token = tokens.refresh_token;
                }

                this.session.tokens = response;
                this.storage.set('tokens', JSON.stringify(response));
                
                this.emit('tokenRefresh', response);
                return response;
            } catch (error) {
                this.handleError(error, 'refresh');
                
                // If refresh fails, clear tokens
                if (error.code === 'TOKEN_REFRESH_FAILED') {
                    this.clearSession();
                }
                
                throw error;
            }
        }

        async revokeToken(token = null, tokenType = 'access_token') {
            try {
                const tokens = this.getTokens();
                const tokenToRevoke = token || tokens?.[tokenType];
                
                if (!tokenToRevoke) {
                    throw new ZenuxOAuthError(`No ${tokenType} to revoke`, 'NO_TOKEN');
                }

                await this.http.postForm(
                    `${this.config.authServer}${this.config.revokeEndpoint}`,
                    {
                        token: tokenToRevoke,
                        token_type_hint: tokenType,
                        client_id: this.config.clientId
                    }
                );

                return true;
            } catch (error) {
                this.handleError(error, 'revoke');
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

                const response = await this.http.request(
                    `${this.config.authServer}${this.config.userinfoEndpoint}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );

                return response.json();
            } catch (error) {
                this.handleError(error, 'userinfo');
                throw error;
            }
        }

        // ==================== LOGOUT ====================
        async logout(options = {}) {
            try {
                if (this.config.onBeforeLogout) {
                    await this.config.onBeforeLogout();
                }

                const hadTokens = this.isAuthenticated();

                // Revoke tokens if requested
                if (options.revoke && this.session.tokens) {
                    try {
                        await this.revokeToken(this.session.tokens.access_token, 'access_token');
                        if (this.session.tokens.refresh_token) {
                            await this.revokeToken(this.session.tokens.refresh_token, 'refresh_token');
                        }
                    } catch (error) {
                        this.debugLog('Token revocation failed', error);
                    }
                }

                // Clear session
                this.clearSession();

                // Call after logout hook
                if (this.config.onAfterLogout) {
                    await this.config.onAfterLogout();
                }

                // Emit event if we had tokens
                if (hadTokens) {
                    this.emit('logout');
                }

                return true;
            } catch (error) {
                this.handleError(error, 'logout');
                throw error;
            }
        }

        clearSession() {
            this.session = {
                codeVerifier: null,
                state: null,
                tokens: null,
                csrfToken: null,
                nonce: null
            };
            
            this.storage.clear();
        }

        // ==================== UTILITIES ====================
        getAuthenticatedFetch() {
            return async (url, options = {}) => {
                // Refresh token if needed
                if (this.isTokenExpired() && this.getTokens()?.refresh_token) {
                    try {
                        await this.refreshTokens();
                    } catch (error) {
                        throw new ZenuxOAuthError(
                            'Failed to refresh token for request',
                            'TOKEN_REFRESH_FAILED',
                            { originalError: error }
                        );
                    }
                }

                const accessToken = this.getAccessToken();
                if (!accessToken) {
                    throw new ZenuxOAuthError('No access token', 'NO_ACCESS_TOKEN');
                }

                return this.http.request(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
            };
        }

        decodeJWT(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                
                let jsonPayload;
                if (Environment.isNode && typeof Buffer !== 'undefined') {
                    jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
                } else {
                    jsonPayload = decodeURIComponent(
                        atob(base64).split('').map(c =>
                            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                        ).join('')
                    );
                }
                
                return JSON.parse(jsonPayload);
            } catch (error) {
                this.debugLog('JWT decode failed', error);
                return null;
            }
        }

        // ==================== AUTO REFRESH ====================
        setupAutoRefresh() {
            if (!this.config.autoRefresh || !Environment.isBrowser) return;
            
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            this.refreshInterval = setInterval(() => {
                this.checkAndRefreshToken();
            }, 60000); // Check every minute
        }

        async checkAndRefreshToken() {
            if (!this.isAuthenticated()) return;
            
            const tokens = this.getTokens();
            if (tokens?.expires_at) {
                const timeUntilExpiry = (tokens.expires_at - Date.now()) / 1000;
                if (timeUntilExpiry < this.config.refreshThreshold) {
                    try {
                        await this.refreshTokens();
                    } catch (error) {
                        this.debugLog('Auto-refresh failed', error);
                    }
                }
            }
        }

        // ==================== EVENT SYSTEM ====================
        on(event, handler) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(handler);
            return this;
        }

        off(event, handler) {
            if (!this.events[event]) return this;
            
            if (handler) {
                this.events[event] = this.events[event].filter(h => h !== handler);
            } else {
                this.events[event] = [];
            }
            return this;
        }

        emit(event, data) {
            this.debugLog(`Event: ${event}`, data);
            
            if (this.events[event]) {
                this.events[event].forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error(`Error in ${event} handler:`, error);
                    }
                });
            }
        }

        handleError(error, context) {
            const oauthError = error instanceof ZenuxOAuthError 
                ? error 
                : new ZenuxOAuthError(
                    error.message || 'Unknown error',
                    error.code || 'UNKNOWN_ERROR',
                    { context, originalError: error }
                );
            
            this.debugLog(`Error in ${context}:`, oauthError);
            this.emit('error', oauthError);
        }

        debugLog(message, data = null) {
            if (!this.config.debug) return;
            
            const timestamp = new Date().toISOString();
            const env = this.config.environment;
            console.log(`[ZenuxOAuth ${timestamp} ${env}] ${message}`, data || '');
        }

        // ==================== PUBLIC API ====================
        getSessionState() {
            const tokens = this.getTokens();
            return {
                isAuthenticated: this.isAuthenticated(),
                tokens: tokens,
                hasRefreshToken: !!tokens?.refresh_token,
                isExpired: this.isTokenExpired(),
                expiresAt: tokens?.expires_at,
                timeUntilExpiry: tokens?.expires_at 
                    ? Math.max(0, (tokens.expires_at - Date.now()) / 1000)
                    : null
            };
        }

        updateConfig(newConfig) {
            Object.assign(this.config, newConfig);
            this.debugLog('Configuration updated', newConfig);
        }

        destroy() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            
            this.events = {
                login: [],
                logout: [],
                tokenRefresh: [],
                error: [],
                tokenExpired: []
            };
            
            this.debugLog('Instance destroyed');
        }
    }

    // ==================== CALLBACK HANDLER (Browser Only) ====================
    class ZenuxOAuthCallbackHandler {
        constructor(config = {}) {
            if (!Environment.isBrowser) {
                console.warn('Callback handler requires browser environment');
                return;
            }

            this.config = {
                debug: config.debug || false,
                autoClose: config.autoClose !== false,
                autoCloseDelay: config.autoCloseDelay || 2000,
                successMessage: config.successMessage || 'Authentication successful!',
                errorMessage: config.errorMessage || 'Authentication failed.',
                ...config
            };

            this.init();
        }

        init() {
            this.debugLog('Initializing callback handler');
            
            // Check if we're on a callback page
            const urlParams = new URLSearchParams(window.location.search);
            const hasCode = urlParams.has('code');
            const hasError = urlParams.has('error');
            
            if (hasCode || hasError) {
                this.setupUI();
                this.processCallback();
            } else {
                this.debugLog('Not a callback page');
            }
        }

        setupUI() {
            if (document.getElementById('zenux-callback-container')) return;
            
            const container = document.createElement('div');
            container.id = 'zenux-callback-container';
            container.innerHTML = this.getHTML();
            document.body.appendChild(container);
        }

        getHTML() {
            return `
                <style>
                    .zenux-callback {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 9999;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }
                    .zenux-callback-content {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 40px;
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                        text-align: center;
                        max-width: 500px;
                        width: 90%;
                        box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
                        border: 1px solid rgba(255, 255, 255, 0.18);
                    }
                    .zenux-spinner {
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        border-top: 4px solid white;
                        width: 50px;
                        height: 50px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .zenux-success { color: #4ade80; }
                    .zenux-error { color: #f87171; }
                    .zenux-hidden { display: none; }
                    .zenux-button {
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        margin: 10px 5px;
                        transition: transform 0.2s;
                    }
                    .zenux-button:hover {
                        transform: translateY(-2px);
                    }
                </style>
                <div class="zenux-callback">
                    <div class="zenux-callback-content">
                        <div id="zenux-loading">
                            <div class="zenux-spinner"></div>
                            <h1 style="color: white;">Processing Authentication</h1>
                            <p style="color: rgba(255, 255, 255, 0.8);">Please wait...</p>
                        </div>
                        
                        <div id="zenux-success" class="zenux-hidden">
                            <div style="font-size: 3rem; margin-bottom: 15px; color: #4ade80;">✓</div>
                            <h1 class="zenux-success">Success!</h1>
                            <p id="zenux-success-message" style="color: rgba(255, 255, 255, 0.9);"></p>
                        </div>
                        
                        <div id="zenux-error" class="zenux-hidden">
                            <div style="font-size: 3rem; margin-bottom: 15px; color: #f87171;">✗</div>
                            <h1 class="zenux-error">Error</h1>
                            <p id="zenux-error-message" style="color: rgba(255, 255, 255, 0.9);"></p>
                            <div>
                                <button class="zenux-button" onclick="window.location.href='/'">Go Home</button>
                                <button class="zenux-button" onclick="window.close()">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        async processCallback() {
            try {
                this.showLoading();
                
                // Try to use main instance if available
                if (window.ZenuxOAuthInstance) {
                    const tokens = await window.ZenuxOAuthInstance.handleCallback();
                    this.showSuccess(this.config.successMessage);
                    
                    if (this.config.autoClose && window.opener) {
                        setTimeout(() => window.close(), this.config.autoCloseDelay);
                    }
                    
                    return tokens;
                }
                
                // Manual callback handling for standalone callback pages
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const error = urlParams.get('error');
                
                if (error) {
                    throw new Error(urlParams.get('error_description') || error);
                }
                
                if (!code) {
                    throw new Error('No authorization code received');
                }
                
                // Notify parent window
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'zenux_oauth_callback',
                        success: true,
                        code: code
                    }, '*');
                    
                    this.showSuccess('Authentication complete! Closing window...');
                    setTimeout(() => window.close(), 1000);
                } else {
                    this.showSuccess('Authentication complete! You can close this window.');
                }
                
            } catch (error) {
                this.showError(error.message || this.config.errorMessage);
                
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'zenux_oauth_callback',
                        success: false,
                        error: error.message
                    }, '*');
                }
            }
        }

        showLoading() {
            this.showSection('loading');
        }

        showSuccess(message) {
            this.showSection('success');
            const element = document.getElementById('zenux-success-message');
            if (element) element.textContent = message;
        }

        showError(message) {
            this.showSection('error');
            const element = document.getElementById('zenux-error-message');
            if (element) element.textContent = message;
        }

        showSection(section) {
            ['loading', 'success', 'error'].forEach(id => {
                const element = document.getElementById(`zenux-${id}`);
                if (element) {
                    element.classList[section === id ? 'remove' : 'add']('zenux-hidden');
                }
            });
        }

        debugLog(message, data = null) {
            if (!this.config.debug) return;
            console.log('[ZenuxOAuth Callback]', message, data || '');
        }
    }

    // ==================== STATIC METHODS ====================
    ZenuxOAuth.create = function(config) {
        return new ZenuxOAuth(config);
    };

    ZenuxOAuth.createCallbackHandler = function(config) {
        if (!Environment.isBrowser) return null;
        return new ZenuxOAuthCallbackHandler(config);
    };

    ZenuxOAuth.getInstance = function(config) {
        if (!ZenuxOAuth.instance) {
            ZenuxOAuth.instance = new ZenuxOAuth(config);
        }
        return ZenuxOAuth.instance;
    };

    ZenuxOAuth.destroyInstance = function() {
        if (ZenuxOAuth.instance) {
            ZenuxOAuth.instance.destroy();
            ZenuxOAuth.instance = null;
        }
    };

    ZenuxOAuth.Error = ZenuxOAuthError;
    ZenuxOAuth.VERSION = '2.3.0';
    ZenuxOAuth.Environment = Environment;

    // ==================== AUTO INITIALIZATION ====================
    if (Environment.isBrowser) {
        // Auto-initialize callback handler on callback pages
        const url = new URL(window.location.href);
        const isCallbackPage = url.pathname.includes('callback') || 
                              url.search.includes('code=') ||
                              url.search.includes('error=');
        
        if (isCallbackPage && !window.ZenuxOAuthCallbackHandler) {
            window.ZenuxOAuthCallbackHandler = new ZenuxOAuthCallbackHandler();
        }
    }

    return ZenuxOAuth;
}));