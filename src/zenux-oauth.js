// zenux-oauth.js - Universal OAuth 2.0 Client
// Supports: Browser, Node.js, React, Next.js, React Native
// Single file, no runtime dependencies
// VERSION: Fixed mode & origin fallback (disableFallback, disableOriginFallback)

'use strict';

const DEFAULT_AUTH_SERVER = 'https://api.auth.zenuxs.in';
const DEFAULT_STORAGE_PREFIX = 'zenux_oauth_';
const DEFAULT_SCOPE = 'openid profile email';
const DEFAULT_MESSAGE_PREFIX = 'zenux_oauth';

const CALLBACK_QUERY_KEYS = ['code', 'state', 'error', 'error_description'];

// ==================== ENVIRONMENT DETECTION ====================
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && !isReactNative;
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// ==================== ERROR CLASS ====================
class ZenuxOAuthError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ZenuxOAuthError';
        this.code = code || 'OAUTH_ERROR';
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

// ==================== SUPPORTED SCOPES (Zenuxs) ====================
const SUPPORTED_SCOPES = [
    'openid',
    'profile',
    'email',
    'discord',
    'discord:profile',
    'discord:guilds',
    'discord:join_server',
    'github',
    'github:profile',
    'github:repos',
    'github:commit'
];

// ==================== STORAGE MANAGER ====================
class StorageManager {
    constructor(prefix = DEFAULT_STORAGE_PREFIX, storage = 'auto') {
        this.prefix = prefix;
        this.memory = new Map();
        this.adapter = this.createAdapter(storage);
        this.type = this.adapter.type;
    }

    createAdapter(storage) {
        const customAdapter = this.createCustomAdapter(storage);
        if (customAdapter) {
            return {
                type: 'custom',
                ...customAdapter
            };
        }

        const type = typeof storage === 'string' ? storage : 'auto';
        const resolvedType = type === 'auto' ? this.detectStorageType() : type;

        if (resolvedType === 'localStorage') {
            return this.createBrowserAdapter(() => localStorage, 'localStorage');
        }

        if (resolvedType === 'sessionStorage') {
            return this.createBrowserAdapter(() => sessionStorage, 'sessionStorage');
        }

        return {
            type: 'memory',
            getItem: key => this.memory.has(key) ? this.memory.get(key) : null,
            setItem: (key, value) => this.memory.set(key, value),
            removeItem: key => this.memory.delete(key),
            clearPrefix: prefix => {
                for (const key of Array.from(this.memory.keys())) {
                    if (String(key).startsWith(prefix)) {
                        this.memory.delete(key);
                    }
                }
            }
        };
    }

    createCustomAdapter(storage) {
        if (!storage || typeof storage !== 'object') {
            return null;
        }

        if (storage instanceof Map) {
            return {
                getItem: key => storage.has(key) ? storage.get(key) : null,
                setItem: (key, value) => storage.set(key, value),
                removeItem: key => storage.delete(key),
                clearPrefix: prefix => {
                    for (const key of Array.from(storage.keys())) {
                        if (String(key).startsWith(prefix)) {
                            storage.delete(key);
                        }
                    }
                }
            };
        }

        if (
            typeof storage.getItem === 'function' &&
            typeof storage.setItem === 'function' &&
            typeof storage.removeItem === 'function'
        ) {
            return {
                getItem: key => storage.getItem(key),
                setItem: (key, value) => storage.setItem(key, value),
                removeItem: key => storage.removeItem(key),
                clearPrefix: prefix => this.clearStructuredStorage(storage, prefix)
            };
        }

        if (
            typeof storage.get === 'function' &&
            typeof storage.set === 'function' &&
            typeof storage.remove === 'function'
        ) {
            return {
                getItem: key => storage.get(key),
                setItem: (key, value) => storage.set(key, value),
                removeItem: key => storage.remove(key),
                clearPrefix: prefix => {
                    if (typeof storage.clearPrefix === 'function') {
                        storage.clearPrefix(prefix);
                        return;
                    }
                    if (typeof storage.keys === 'function') {
                        for (const key of Array.from(storage.keys())) {
                            if (String(key).startsWith(prefix)) {
                                storage.remove(key);
                            }
                        }
                        return;
                    }
                    if (typeof storage.clear === 'function') {
                        storage.clear();
                    }
                }
            };
        }

        return null;
    }

    createBrowserAdapter(getStorage, type) {
        return {
            type,
            getItem: key => {
                try {
                    return getStorage().getItem(key);
                } catch {
                    return this.memory.has(key) ? this.memory.get(key) : null;
                }
            },
            setItem: (key, value) => {
                try {
                    getStorage().setItem(key, value);
                } catch {
                    this.memory.set(key, value);
                }
            },
            removeItem: key => {
                this.memory.delete(key);
                try {
                    getStorage().removeItem(key);
                } catch {
                    // Ignore storage failures and keep memory fallback in sync.
                }
            },
            clearPrefix: prefix => {
                try {
                    const storage = getStorage();
                    for (let index = storage.length - 1; index >= 0; index--) {
                        const key = storage.key(index);
                        if (key && key.startsWith(prefix)) {
                            storage.removeItem(key);
                        }
                    }
                } catch {
                    // Ignore storage failures and clear memory fallback below.
                }

                for (const key of Array.from(this.memory.keys())) {
                    if (String(key).startsWith(prefix)) {
                        this.memory.delete(key);
                    }
                }
            }
        };
    }

    clearStructuredStorage(storage, prefix) {
        try {
            if (typeof storage.length === 'number' && typeof storage.key === 'function') {
                for (let index = storage.length - 1; index >= 0; index--) {
                    const key = storage.key(index);
                    if (key && key.startsWith(prefix)) {
                        storage.removeItem(key);
                    }
                }
                return;
            }
        } catch {
            // Ignore and fall through.
        }

        if (typeof storage.clear === 'function') {
            storage.clear();
        }
    }

    detectStorageType() {
        if (!isBrowser) {
            return 'memory';
        }

        try {
            sessionStorage.setItem('__zenux_test__', '1');
            sessionStorage.removeItem('__zenux_test__');
            return 'sessionStorage';
        } catch {
            try {
                localStorage.setItem('__zenux_test__', '1');
                localStorage.removeItem('__zenux_test__');
                return 'localStorage';
            } catch {
                return 'memory';
            }
        }
    }

    getFullKey(key) {
        return `${this.prefix}${key}`;
    }

    get(key) {
        return this.adapter.getItem(this.getFullKey(key));
    }

    set(key, value) {
        this.adapter.setItem(this.getFullKey(key), value);
    }

    remove(key) {
        this.adapter.removeItem(this.getFullKey(key));
    }

    clear() {
        this.adapter.clearPrefix(this.prefix);
    }
}

// ==================== CRYPTO UTILITIES ====================
const CryptoUtils = {
    generateRandomString(length = 96) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';

        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(length);
            globalThis.crypto.getRandomValues(bytes);
            for (let index = 0; index < length; index++) {
                result += charset[bytes[index] % charset.length];
            }
            return result;
        }

        if (isNode) {
            try {
                const crypto = require('crypto');
                const bytes = crypto.randomBytes(length);
                for (let index = 0; index < length; index++) {
                    result += charset[bytes[index] % charset.length];
                }
                return result;
            } catch {
                // Fall through to Math.random fallback.
            }
        }

        for (let index = 0; index < length; index++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        return result;
    },

    async sha256(plain) {
        if (isNode) {
            try {
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256').update(plain).digest();
                return this.base64UrlEncode(hash);
            } catch {
                // Fall through to browser crypto.
            }
        }

        if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(plain);
            const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
            return this.base64UrlEncode(new Uint8Array(hash));
        }

        throw new ZenuxOAuthError('SHA-256 not supported in this environment', 'CRYPTO_NOT_SUPPORTED');
    },

    base64UrlEncode(buffer) {
        let base64 = '';

        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
            base64 = buffer.toString('base64');
        } else if (buffer instanceof Uint8Array) {
            if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(buffer).toString('base64');
            } else if (typeof btoa !== 'undefined') {
                const chunk = Array.from(buffer, byte => String.fromCharCode(byte)).join('');
                base64 = btoa(chunk);
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
        this._listeners = {};
        this._fetchPromise = null;
        this._refreshInterval = null;
        this._activeUi = null;
        this._activePopup = null;
        this._activeFlow = null;
        this._debugLogs = []; // advanced debug logs

        this.environment = this.detectEnvironment();
        this.config = this.normalizeConfig(config);
        this.storage = new StorageManager(this.config.storagePrefix, this.config.storage);
        this.session = {
            tokens: null
        };

        this.loadSession();

        if (this.config.autoRefresh) {
            this.setupAutoRefresh();
        }

        if (isBrowser) {
            window.ZenuxOAuthInstance = this;
        }

        this.debugLog('Initialized', {
            environment: this.environment,
            defaultMode: this.getDefaultMode()
        });
    }

    // ==================== ADVANCED DEBUGGING ====================
    _addDebugEntry(category, message, data = null) {
        const entry = {
            timestamp: Date.now(),
            iso: new Date().toISOString(),
            category,
            message,
            data: data ? this._safeStringify(data) : null
        };
        this._debugLogs.push(entry);
        // Keep last 500 logs
        if (this._debugLogs.length > 500) this._debugLogs.shift();

        if (this.config.debug) {
            console.log(`[ZenuxOAuth:${category}]`, message, data || '');
        }
    }

    _safeStringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch {
            return String(obj);
        }
    }

    exportDebugLogs() {
        const logs = this._debugLogs.map(log => ({
            ...log,
            data: log.data ? (typeof log.data === 'string' ? log.data : this._safeStringify(log.data)) : null
        }));
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zenux-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return logs;
    }

    getDebugLogs() {
        return [...this._debugLogs];
    }

    // ==================== EVENTS ====================
    on(event, handler) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }

        this._listeners[event].push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!this._listeners[event]) {
            return;
        }

        if (!handler) {
            delete this._listeners[event];
            return;
        }

        this._listeners[event] = this._listeners[event].filter(listener => listener !== handler);

        if (this._listeners[event].length === 0) {
            delete this._listeners[event];
        }
    }

    emit(event, payload) {
        const listeners = this._listeners[event];
        if (!listeners || listeners.length === 0) {
            return;
        }

        for (const listener of listeners) {
            try {
                listener(payload);
            } catch (error) {
                this.debugLog(`Listener failed for ${event}`, error);
            }
        }
    }

    // ==================== CONFIG ====================
    detectEnvironment() {
        if (isReactNative) {
            return 'react-native';
        }

        if (isBrowser) {
            return 'browser';
        }

        if (isNode) {
            return 'node';
        }

        return 'unknown';
    }

    normalizeConfig(config) {
        const clientId = config.clientId || config.clientID || config.clientid;
        if (!clientId) {
            throw new ZenuxOAuthError('clientId is required', 'INVALID_CONFIG');
        }

        const popupWidth = Number.isFinite(Number(config.popupWidth)) ? Number(config.popupWidth) : 540;
        const popupHeight = Number.isFinite(Number(config.popupHeight)) ? Number(config.popupHeight) : 720;
        const uiWidth = Number.isFinite(Number(config.uiWidth)) ? Number(config.uiWidth) : 460;
        const uiHeight = Number.isFinite(Number(config.uiHeight)) ? Number(config.uiHeight) : 720;

        return {
            clientId,
            authServer: this.normalizeAuthServer(config.authServer || DEFAULT_AUTH_SERVER),
            redirectUri: config.redirectUri || config.redirectURL || config.redirectUrl || null,
            scopes: config.scopes || config.scope || DEFAULT_SCOPE,
            authorizeEndpoint: config.authorizeEndpoint || '/oauth/authorize',
            tokenEndpoint: config.tokenEndpoint || '/oauth/token',
            userinfoEndpoint: config.userinfoEndpoint || '/oauth/userinfo',
            discoveryEndpoint: config.discoveryEndpoint || '/oauth/.well-known/openid-configuration',
            jwksEndpoint: config.jwksEndpoint || '/oauth/.well-known/jwks.json',
            clientInfoEndpoint: config.clientInfoEndpoint || '/oauth/client',
            revokeEndpoint: config.revokeEndpoint || '/oauth/revoke',
            storage: config.storage || config.storageManager || 'auto',
            storagePrefix: config.storagePrefix || DEFAULT_STORAGE_PREFIX,
            usePKCE: config.usePKCE !== false,
            validateState: config.validateState !== false,
            debug: !!config.debug,
            autoRefresh: !!config.autoRefresh,
            refreshThreshold: Number.isFinite(Number(config.refreshThreshold)) ? Number(config.refreshThreshold) : 60,
            popupWidth,
            popupHeight,
            uiWidth,
            uiHeight,
            uiTitle: config.uiTitle || '',
            uiDescription: config.uiDescription || '',
            theme: this.normalizeTheme(config.theme || config.uiTheme || 'auto', 'auto'),
            uiFallbackMode: this.normalizeUiFallbackMode(config.uiFallbackMode || config.providerFallbackMode || 'popup', 'popup'),
            uiAllowRedirectFallback: config.uiAllowRedirectFallback !== false,
            uiCloseConfirm: config.uiCloseConfirm !== false,
            uiLoadHintDelay: Number.isFinite(Number(config.uiLoadHintDelay)) ? Number(config.uiLoadHintDelay) : 1800,
            uiRedirectFallbackDelay: Number.isFinite(Number(config.uiRedirectFallbackDelay)) ? Number(config.uiRedirectFallbackDelay) : 2600,
            fetchFunction: config.fetchFunction || config.fetch || null,
            fetch: config.fetchFunction || config.fetch || null,
            frontendMode: this.normalizeMode(config.frontendMode || config.defaultMode || config.mode || 'redirect', 'redirect'),
            backendMode: this.normalizeMode(config.backendMode || config.defaultMode || config.mode || 'redirect', 'redirect'),
            extraAuthParams: config.extraAuthParams || {},
            extraTokenParams: config.extraTokenParams || {},
            cleanupUrl: config.cleanupUrl !== false,
            closePopupOnSuccess: config.closePopupOnSuccess !== false,
            closeUiOnSuccess: config.closeUiOnSuccess !== false,
            // NEW: disable all fallback mechanisms (mode promotion, UI fallback timers)
            disableFallback: config.disableFallback === true,
            // NEW: never use window.location.origin to resolve relative URLs
            disableOriginFallback: config.disableOriginFallback === true,
            ...config
        };
    }

    normalizeAuthServer(authServer) {
        return String(authServer || DEFAULT_AUTH_SERVER).replace(/\/+$/, '');
    }

    normalizeMode(mode, fallback) {
        if (!mode) {
            return fallback;
        }

        const normalized = String(mode).trim().toLowerCase();

        if (normalized === 'ui' || normalized === 'inui' || normalized === 'iframe' || normalized === 'inline') {
            return 'ui';
        }

        if (normalized === 'popup' || normalized === 'window') {
            return 'popup';
        }

        if (normalized === 'redirect' || normalized === 'page') {
            return 'redirect';
        }

        if (normalized === 'manual' || normalized === 'url' || normalized === 'none') {
            return 'manual';
        }

        return fallback;
    }

    normalizeTheme(theme, fallback = 'auto') {
        if (!theme) {
            return fallback;
        }

        const normalized = String(theme).trim().toLowerCase();
        if (normalized === 'light' || normalized === 'dark' || normalized === 'auto') {
            return normalized;
        }

        return fallback;
    }

    resolveTheme(theme = this.config.theme) {
        const normalizedTheme = this.normalizeTheme(theme, 'auto');
        if (normalizedTheme === 'dark' || normalizedTheme === 'light') {
            return normalizedTheme;
        }

        if (isBrowser && typeof window.matchMedia === 'function') {
            try {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } catch {
                return 'light';
            }
        }

        return 'light';
    }

    normalizeUiFallbackMode(mode, fallback = 'popup') {
        if (!mode) {
            return fallback;
        }

        const normalized = String(mode).trim().toLowerCase();
        if (normalized === 'popup' || normalized === 'redirect') {
            return normalized;
        }

        return fallback;
    }

    getUiFallbackMode(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        return this.normalizeUiFallbackMode(
            normalizedOptions.uiFallbackMode || normalizedOptions.providerFallbackMode || this.config.uiFallbackMode,
            'popup'
        );
    }

    getRequestedProvider(options = {}, authUrl = null) {
        const normalizedOptions = this.normalizeOptions(options);
        const fromOptions = normalizedOptions.provider
            || normalizedOptions.identityProvider
            || normalizedOptions.connection
            || normalizedOptions.idp
            || (normalizedOptions.extraAuthParams && (
                normalizedOptions.extraAuthParams.provider
                || normalizedOptions.extraAuthParams.identity_provider
                || normalizedOptions.extraAuthParams.connection
                || normalizedOptions.extraAuthParams.idp
            ));

        if (fromOptions) {
            return String(fromOptions).trim().toLowerCase();
        }

        if (authUrl) {
            try {
                const params = new URL(authUrl).searchParams;
                const fromUrl = params.get('provider')
                    || params.get('identity_provider')
                    || params.get('connection')
                    || params.get('idp');

                if (fromUrl) {
                    return String(fromUrl).trim().toLowerCase();
                }
            } catch {
                // Ignore malformed URLs and fall through.
            }
        }

        return null;
    }

    isFrameSensitiveProvider(provider) {
        return provider === 'google' || provider === 'discord' || provider === 'github';
    }

    setActiveFlowContext(authData, mode, details = {}) {
        this._activeFlow = {
            authData,
            mode,
            startedAt: Date.now(),
            status: details.status || 'pending',
            ...details
        };
    }


    clearActiveFlowContext(state = null) {
        if (!this._activeFlow) {
            return;
        }

        if (state && this._activeFlow.authData && this._activeFlow.authData.state && this._activeFlow.authData.state !== state) {
            return;
        }

        this._activeFlow = null;
    }

    getDefaultMode() {
        return isBrowser ? this.config.frontendMode : this.config.backendMode;
    }

    getLoginMode(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        const requestedMode = normalizedOptions.mode || normalizedOptions.flow || normalizedOptions.loginMode;
        const fallback = this.getDefaultMode();
        const mode = this.normalizeMode(requestedMode || fallback, fallback);

        if (!isBrowser && (mode === 'popup' || mode === 'ui')) {
            return this.normalizeMode(normalizedOptions.serverFallbackMode || 'redirect', 'redirect');
        }

        return mode;
    }

    normalizeOptions(options) {
        if (!options) {
            return {};
        }

        if (typeof options === 'string') {
            return { mode: options };
        }

        return options;
    }

    // ==================== URL HELPERS ====================
    getIframeResourceSnapshot(cursor = 0) {
        if (!isBrowser || !window.performance || typeof window.performance.getEntriesByType !== 'function') {
            return { cursor, urls: [] };
        }

        try {
            const entries = window.performance.getEntriesByType('resource');
            const urls = [];

            for (let index = cursor; index < entries.length; index++) {
                const entry = entries[index];
                if (!entry || entry.initiatorType !== 'iframe' || !entry.name) {
                    continue;
                }

                const absoluteUrl = this.toAbsoluteUrl(entry.name);
                if (absoluteUrl) {
                    urls.push(absoluteUrl);
                }
            }

            return {
                cursor: entries.length,
                urls
            };
        } catch {
            return { cursor, urls: [] };
        }
    }

    isFrameSensitiveUrl(url) {
        const absoluteUrl = this.toAbsoluteUrl(url);
        if (!absoluteUrl) return false;

        // Block any Zenuxs domain from being considered sensitive
        if (absoluteUrl.includes('zenuxs.in')) {
            this._addDebugEntry('sensitivity', `URL is Zenuxs domain, NOT sensitive: ${absoluteUrl}`);
            return false;
        }

        try {
            const urlOrigin = new URL(absoluteUrl).origin;
            const authOrigin = new URL(this.config.authServer).origin;
            if (urlOrigin === authOrigin) {
                this._addDebugEntry('sensitivity', `URL matches auth server origin, NOT sensitive: ${absoluteUrl}`);
                return false;
            }
        } catch { /* ignore */ }

        try {
            const parsed = new URL(absoluteUrl);
            const hostname = parsed.hostname.toLowerCase();
            const sensitiveDomains = [
                'accounts.google.com',
                'oauth2.googleapis.com',
                'github.com',
                'discord.com',
                'discordapp.com'
            ];
            const isSensitive = sensitiveDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
            this._addDebugEntry('sensitivity', `URL ${absoluteUrl} hostname ${hostname} -> sensitive=${isSensitive}`);
            return isSensitive;
        } catch {
            const normalized = String(absoluteUrl).toLowerCase();
            const isSensitive = normalized.includes('google.com') ||
                normalized.includes('github.com') ||
                normalized.includes('discord.com');
            this._addDebugEntry('sensitivity', `URL fallback check ${absoluteUrl} -> sensitive=${isSensitive}`);
            return isSensitive;
        }
    }

    toAbsoluteUrl(value) {
        if (!value) {
            return null;
        }

        if (value instanceof URL) {
            return value.toString();
        }

        if (typeof value !== 'string') {
            return null;
        }

        // If it's already absolute, just return it
        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        // If fallback to origin is disabled, reject relative URLs
        if (this.config.disableOriginFallback) {
            throw new ZenuxOAuthError(
                `Cannot resolve relative URL "${value}" without a base. Provide an absolute URL.`,
                'RELATIVE_URL_NOT_ALLOWED'
            );
        }

        // Legacy fallback (only when disableOriginFallback is false)
        if (isBrowser && window.location && window.location.origin) {
            try {
                return new URL(value, window.location.origin).toString();
            } catch {
                return null;
            }
        }

        return null;
    }

    getCurrentBrowserUrl() {
        if (!isBrowser || !window.location) {
            return null;
        }

        return window.location.href;
    }

    getRequestUrl(request, fallbackBase = null) {
        if (!request) {
            return null;
        }

        if (typeof request === 'string' || request instanceof URL) {
            return this.toAbsoluteUrl(request);
        }

        if (typeof request.url === 'string' && /^https?:\/\//i.test(request.url)) {
            return request.url;
        }

        let path = request.originalUrl || request.url || request.path || request.pathname || '/';
        if (!request.originalUrl && !request.url && request.query && typeof request.query === 'object') {
            const search = new URLSearchParams();
            for (const [key, value] of Object.entries(request.query)) {
                if (value !== undefined && value !== null) {
                    search.append(key, Array.isArray(value) ? value.join(',') : String(value));
                }
            }
            const suffix = search.toString();
            if (suffix) {
                path += path.includes('?') ? `&${suffix}` : `?${suffix}`;
            }
        }

        const host = request.get
            ? request.get('host')
            : request.headers?.['x-forwarded-host'] || request.headers?.host || null;
        const protocol = request.protocol
            || (request.headers?.['x-forwarded-proto']
                ? String(request.headers['x-forwarded-proto']).split(',')[0].trim()
                : (request.socket && request.socket.encrypted ? 'https' : 'http'));

        if (host) {
            try {
                return new URL(path, `${protocol}://${host}`).toString();
            } catch {
                return null;
            }
        }

        if (fallbackBase) {
            try {
                return new URL(path, fallbackBase).toString();
            } catch {
                return null;
            }
        }

        return null;
    }

    getRuntimeUrl(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);

        if (normalizedOptions.callbackUrl) {
            return this.toAbsoluteUrl(normalizedOptions.callbackUrl);
        }

        if (normalizedOptions.currentUrl) {
            return this.toAbsoluteUrl(normalizedOptions.currentUrl);
        }

        if (normalizedOptions.request) {
            return this.getRequestUrl(normalizedOptions.request, normalizedOptions.baseUrl);
        }

        // If origin fallback is disabled, do NOT use the current browser URL
        if (this.config.disableOriginFallback) {
            return null;
        }

        return this.getCurrentBrowserUrl();
    }

    stripCallbackParams(url) {
        const absoluteUrl = this.toAbsoluteUrl(url);
        if (!absoluteUrl) {
            return null;
        }

        const urlObject = new URL(absoluteUrl);
        for (const key of CALLBACK_QUERY_KEYS) {
            urlObject.searchParams.delete(key);
        }
        urlObject.hash = '';
        return urlObject.toString();
    }

    resolveRedirectUri(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        const explicitRedirectUri = normalizedOptions.redirectUri || this.config.redirectUri;
        const runtimeUrl = this.getRuntimeUrl(normalizedOptions);

        if (explicitRedirectUri) {
            return this.toAbsoluteUrl(explicitRedirectUri);
        }

        if (runtimeUrl && !this.config.disableOriginFallback) {
            return this.stripCallbackParams(runtimeUrl) || runtimeUrl;
        }

        throw new ZenuxOAuthError(
            'redirectUri is required when disableOriginFallback is true. Please provide an absolute redirectUri in the config or login options.',
            'MISSING_REDIRECT_URI'
        );
    }

    hasOAuthCallback(url = null) {
        const runtimeUrl = url || this.getRuntimeUrl();
        const absoluteUrl = this.toAbsoluteUrl(runtimeUrl);
        if (!absoluteUrl) {
            return false;
        }

        try {
            const params = new URL(absoluteUrl).searchParams;
            return params.has('code') || params.has('error');
        } catch {
            return false;
        }
    }

    parseCallbackParams(url) {
        const absoluteUrl = this.toAbsoluteUrl(url);
        if (!absoluteUrl) {
            return {
                url: null,
                code: null,
                state: null,
                error: null,
                errorDescription: null
            };
        }

        const urlObject = new URL(absoluteUrl);
        const params = urlObject.searchParams;

        return {
            url: absoluteUrl,
            code: params.get('code'),
            state: params.get('state'),
            error: params.get('error'),
            errorDescription: params.get('error_description')
        };
    }

    cleanupBrowserUrl(url) {
        if (!isBrowser || !window.history || typeof window.history.replaceState !== 'function') {
            return;
        }

        const cleanedUrl = this.stripCallbackParams(url || window.location.href);
        if (cleanedUrl) {
            window.history.replaceState({}, document.title, cleanedUrl);
        }
    }

    setEmbeddedCallbackMask(visible, heading = 'Finishing sign in', message = 'Securely completing your session...') {
        if (!isBrowser) {
            return;
        }

        const existingMask = document.getElementById('zenux-oauth-embedded-mask');
        if (!visible) {
            if (existingMask && existingMask.parentNode) {
                existingMask.parentNode.removeChild(existingMask);
            }
            return;
        }

        let mask = existingMask;
        if (!mask) {
            mask = document.createElement('div');
            mask.id = 'zenux-oauth-embedded-mask';
            mask.style.position = 'fixed';
            mask.style.inset = '0';
            mask.style.zIndex = '2147483647';
            mask.style.display = 'flex';
            mask.style.alignItems = 'center';
            mask.style.justifyContent = 'center';
            mask.style.padding = '24px';
            mask.style.background = 'linear-gradient(180deg, rgba(247, 250, 253, 0.94), rgba(241, 246, 251, 0.98))';
            mask.style.backdropFilter = 'blur(8px)';

            const panel = document.createElement('div');
            panel.style.width = 'min(88vw, 320px)';
            panel.style.padding = '22px 18px';
            panel.style.borderRadius = '22px';
            panel.style.background = 'rgba(255, 255, 255, 0.94)';
            panel.style.border = '1px solid rgba(148, 163, 184, 0.24)';
            panel.style.boxShadow = '0 18px 36px rgba(15, 23, 42, 0.14)';
            panel.style.textAlign = 'center';

            const spinner = document.createElement('div');
            spinner.style.width = '50px';
            spinner.style.height = '50px';
            spinner.style.margin = '0 auto 14px';
            spinner.style.borderRadius = '50%';
            spinner.style.border = '4px solid rgba(15, 124, 255, 0.16)';
            spinner.style.borderTopColor = '#0f7cff';
            spinner.style.animation = 'zenuxOAuthEmbeddedSpin 0.8s linear infinite';

            const title = document.createElement('div');
            title.setAttribute('data-zenux-mask-title', 'true');
            title.style.font = '700 18px/1.2 "Segoe UI", system-ui, sans-serif';
            title.style.color = '#102033';

            const text = document.createElement('div');
            text.setAttribute('data-zenux-mask-text', 'true');
            text.style.marginTop = '8px';
            text.style.font = '400 13px/1.7 "Segoe UI", system-ui, sans-serif';
            text.style.color = '#607286';

            const animationStyle = document.createElement('style');
            animationStyle.textContent = '@keyframes zenuxOAuthEmbeddedSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';

            panel.appendChild(animationStyle);
            panel.appendChild(spinner);
            panel.appendChild(title);
            panel.appendChild(text);
            mask.appendChild(panel);
            document.body.appendChild(mask);
        }

        const titleElement = mask.querySelector('[data-zenux-mask-title="true"]');
        const textElement = mask.querySelector('[data-zenux-mask-text="true"]');
        if (titleElement) {
            titleElement.textContent = heading;
        }
        if (textElement) {
            textElement.textContent = message;
        }
    }

    // ==================== FETCH ====================
    normalizeFetchImplementation(fetchImpl) {
        if (typeof fetchImpl === 'function') {
            return fetchImpl.bind(globalThis);
        }

        if (fetchImpl && typeof fetchImpl.default === 'function') {
            return fetchImpl.default.bind(globalThis);
        }

        if (fetchImpl && typeof fetchImpl.fetch === 'function') {
            return fetchImpl.fetch.bind(globalThis);
        }

        return null;
    }

    async getFetchFunction() {
        if (this._fetchPromise) {
            return this._fetchPromise;
        }

        this._fetchPromise = (async () => {
            const configuredFetch = this.normalizeFetchImplementation(this.config.fetchFunction || this.config.fetch);
            if (configuredFetch) {
                return configuredFetch;
            }

            if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
                return globalThis.fetch.bind(globalThis);
            }

            if (typeof fetch !== 'undefined' && typeof fetch === 'function') {
                return fetch.bind(globalThis);
            }

            if (isNode) {
                try {
                    const nodeFetch = require('node-fetch');
                    const normalizedNodeFetch = this.normalizeFetchImplementation(nodeFetch);
                    if (normalizedNodeFetch) {
                        return normalizedNodeFetch;
                    }
                } catch {
                    // Fall through to dynamic imports.
                }

                try {
                    const dynamicImport = new Function('specifier', 'return import(specifier);');
                    const nodeFetchModule = await dynamicImport('node-fetch');
                    const normalizedNodeFetch = this.normalizeFetchImplementation(nodeFetchModule);
                    if (normalizedNodeFetch) {
                        return normalizedNodeFetch;
                    }
                } catch {
                    // Fall through to undici.
                }

                try {
                    const dynamicImport = new Function('specifier', 'return import(specifier);');
                    const undiciModule = await dynamicImport('undici');
                    const undiciFetch = this.normalizeFetchImplementation(undiciModule);
                    if (undiciFetch) {
                        return undiciFetch;
                    }
                } catch {
                    // Fall through to error below.
                }
            }

            throw new ZenuxOAuthError(
                'Fetch not available. Provide fetch/fetchFunction or use a runtime with global fetch.',
                'FETCH_UNAVAILABLE'
            );
        })();

        return this._fetchPromise;
    }

    // ==================== STORAGE HELPERS ====================
    loadSession() {
        const tokensString = this.storage.get('tokens');
        if (!tokensString) {
            return;
        }

        try {
            this.session.tokens = JSON.parse(tokensString);
        } catch {
            this.storage.remove('tokens');
        }
    }

    setTokens(tokens) {
        this.session.tokens = tokens;
        this.storage.set('tokens', JSON.stringify(tokens));
    }

    clearTokens() {
        this.session.tokens = null;
        this.storage.remove('tokens');
    }

    getTransactionKey(state) {
        return `tx:${state}`;
    }

    storeTransaction(transaction) {
        this.storage.set(this.getTransactionKey(transaction.state), JSON.stringify(transaction));

        // Legacy keys are still written for compatibility with callback.html and older integrations.
        this.storage.set('state', transaction.state);
        if (transaction.codeVerifier) {
            this.storage.set('code_verifier', transaction.codeVerifier);
        }
        if (transaction.nonce) {
            this.storage.set('nonce', transaction.nonce);
        }
        if (transaction.redirectUri) {
            this.storage.set('redirect_uri', transaction.redirectUri);
        }
        this.storage.set('client_id', this.config.clientId);
        this.storage.set('auth_server', this.config.authServer);
    }

    getTransaction(state) {
        if (state) {
            const transactionString = this.storage.get(this.getTransactionKey(state));
            if (transactionString) {
                try {
                    return JSON.parse(transactionString);
                } catch {
                    this.storage.remove(this.getTransactionKey(state));
                }
            }
        }

        const legacyState = this.storage.get('state');
        if (state && legacyState && legacyState !== state) {
            return null;
        }

        const codeVerifier = this.storage.get('code_verifier');
        const redirectUri = this.storage.get('redirect_uri') || this.config.redirectUri;
        const nonce = this.storage.get('nonce');

        if (!legacyState && !codeVerifier && !redirectUri) {
            const parentInstance = this.getParentOAuthInstance();
            if (parentInstance && parentInstance !== this) {
                try {
                    const parentTransaction = parentInstance.getTransaction(state);
                    if (parentTransaction) {
                        return parentTransaction;
                    }
                } catch {
                    // Ignore parent access failures and fall through.
                }
            }

            return null;
        }

        return {
            state: legacyState || state || null,
            codeVerifier: codeVerifier || null,
            redirectUri: redirectUri || null,
            nonce: nonce || null
        };
    }

    clearTransaction(state) {
        if (state) {
            this.storage.remove(this.getTransactionKey(state));
        }

        const storedState = this.storage.get('state');
        if (!state || !storedState || storedState === state) {
            this.storage.remove('state');
            this.storage.remove('code_verifier');
            this.storage.remove('nonce');
            this.storage.remove('redirect_uri');
        }

        const parentInstance = this.getParentOAuthInstance();
        if (parentInstance && parentInstance !== this) {
            try {
                if (state) {
                    parentInstance.storage.remove(this.getTransactionKey(state));
                }

                const parentStoredState = parentInstance.storage.get('state');
                if (!state || !parentStoredState || parentStoredState === state) {
                    parentInstance.storage.remove('state');
                    parentInstance.storage.remove('code_verifier');
                    parentInstance.storage.remove('nonce');
                    parentInstance.storage.remove('redirect_uri');
                }
            } catch {
                // Ignore parent cleanup failures.
            }
        }
    }

    // ==================== DEBUG ====================
    debugLog(message, data = null) {
        this._addDebugEntry('general', message, data);
    }

    toOAuthError(error, fallbackCode = 'OAUTH_ERROR', details = {}) {
        if (error instanceof ZenuxOAuthError) {
            return error;
        }

        return new ZenuxOAuthError(
            error && error.message ? error.message : 'OAuth request failed',
            fallbackCode,
            details
        );
    }

    // ==================== AUTHORIZATION ====================
    async getAuthorizationUrl(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        const redirectUri = this.resolveRedirectUri(normalizedOptions);
        const scopes = normalizedOptions.scopes || this.config.scopes;
        const state = normalizedOptions.state || CryptoUtils.generateRandomString(32);
        const nonce = normalizedOptions.nonce || CryptoUtils.generateRandomString(32);

        let codeVerifier = null;
        let codeChallenge = null;

        if (this.config.usePKCE) {
            codeVerifier = normalizedOptions.codeVerifier || CryptoUtils.generateRandomString(96);
            codeChallenge = await CryptoUtils.sha256(codeVerifier);
        }

        const params = new URLSearchParams();
        params.set('client_id', this.config.clientId);
        params.set('redirect_uri', redirectUri);
        params.set('response_type', 'code');
        params.set('scope', scopes);
        params.set('state', state);
        params.set('nonce', nonce);

        if (codeChallenge) {
            params.set('code_challenge', codeChallenge);
            params.set('code_challenge_method', 'S256');
        }

        const extraAuthParams = {
            ...this.config.extraAuthParams,
            ...(normalizedOptions.extraAuthParams || normalizedOptions.extraParams || {})
        };

        for (const [key, value] of Object.entries(extraAuthParams)) {
            if (value !== undefined && value !== null) {
                params.set(key, String(value));
            }
        }

        const authUrl = `${this.config.authServer}${this.config.authorizeEndpoint}?${params.toString()}`;
        const transaction = {
            state,
            nonce,
            codeVerifier,
            redirectUri,
            createdAt: Date.now(),
            mode: this.getLoginMode(normalizedOptions),
            scopes
        };

        this.storeTransaction(transaction);

        const authData = {
            url: authUrl,
            state,
            nonce,
            codeVerifier,
            redirectUri,
            mode: transaction.mode
        };

        this.debugLog('Authorization URL prepared', authData);
        return authData;
    }

    async login(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        const runtimeUrl = this.getRuntimeUrl(normalizedOptions);

        if (this.hasOAuthCallback(runtimeUrl)) {
            return this.handleCallback(runtimeUrl, normalizedOptions);
        }

        const mode = this.getLoginMode(normalizedOptions);
        const authData = await this.getAuthorizationUrl({
            ...normalizedOptions,
            mode
        });

        // === DISABLE MODE PROMOTION IF FALLBACK IS DISABLED ===
        let resolvedMode = mode;
        const requestedProvider = this.getRequestedProvider(normalizedOptions, authData.url);

        if (!this.config.disableFallback && mode === 'ui' && this.isFrameSensitiveProvider(requestedProvider)) {
            resolvedMode = 'popup';
            this.debugLog('Promoting frame-sensitive provider to popup mode', { requestedProvider });
        }

        if (isBrowser) {
            this.setActiveFlowContext(authData, resolvedMode, { status: 'authorizing' });
        }

        this.emit('loginRequest', authData);

        if (!isBrowser) {
            return this.handleServerLogin(authData, resolvedMode, normalizedOptions);
        }

        if (resolvedMode === 'manual') {
            return authData;
        }

        if (resolvedMode === 'redirect') {
            window.location.assign(authData.url);
            return null;
        }

        if (resolvedMode === 'popup') {
            return this.openPopupFlow(authData, normalizedOptions);
        }

        if (resolvedMode === 'ui') {
            return this.openUiFlow(authData, normalizedOptions);
        }

        return authData;
    }

    async init(options = {}) {
        const normalizedOptions = this.normalizeOptions(options);
        const runtimeUrl = this.getRuntimeUrl(normalizedOptions);

        if (isBrowser && !this.hasOAuthCallback(runtimeUrl)) {
            const parentInstance = this.getParentOAuthInstance();
            if (
                window.parent &&
                window.parent !== window &&
                parentInstance &&
                parentInstance !== this &&
                parentInstance._activeFlow &&
                parentInstance._activeFlow.mode === 'ui'
            ) {
                this.notifyParent('progress', {
                    phase: 'embedded_return_without_callback',
                    state: parentInstance._activeFlow.authData ? parentInstance._activeFlow.authData.state : null,
                    hasCode: false
                });
            }
        }

        if (this.hasOAuthCallback(runtimeUrl)) {
            return this.handleCallback(runtimeUrl, normalizedOptions);
        }

        if (normalizedOptions.autoLogin) {
            return this.login(normalizedOptions.loginOptions || normalizedOptions);
        }

        return this.getSessionState();
    }

    async handleServerLogin(authData, mode, options = {}) {
        if (mode === 'manual') {
            return authData;
        }

        if (options.response) {
            this.redirectResponse(options.response, authData.url, options.redirectStatus || 302);
            return null;
        }

        return authData;
    }

    redirectResponse(response, location, statusCode = 302) {
        if (!response) {
            return false;
        }

        if (typeof response.redirect === 'function') {
            response.redirect(statusCode, location);
            return true;
        }

        if (typeof response.writeHead === 'function') {
            response.writeHead(statusCode, { Location: location });
            if (typeof response.end === 'function') {
                response.end();
            }
            return true;
        }

        if (typeof response.setHeader === 'function') {
            response.statusCode = statusCode;
            response.setHeader('Location', location);
            if (typeof response.end === 'function') {
                response.end();
            }
            return true;
        }

        return false;
    }

    // ==================== CALLBACK HANDLING ====================
    async handleCallback(callbackUrl = null, options = {}) {
        let state = null;

        try {
            if (callbackUrl && typeof callbackUrl === 'object' && !(callbackUrl instanceof URL) && !Array.isArray(callbackUrl)) {
                options = callbackUrl;
                callbackUrl = null;
            }

            const normalizedOptions = this.normalizeOptions(options);
            const runtimeUrl = callbackUrl ? this.toAbsoluteUrl(callbackUrl) : this.getRuntimeUrl(normalizedOptions);
            const parsed = this.parseCallbackParams(runtimeUrl);
            state = parsed.state;

            if (isBrowser && this.getParentWindow() && (parsed.code || parsed.error)) {
                this.setEmbeddedCallbackMask(true, 'Finishing sign in', 'Securely completing your session...');
            }

            if (isBrowser && normalizedOptions.notifyParent !== false && (parsed.code || parsed.error)) {
                this.notifyParent('progress', {
                    phase: 'callback_detected',
                    state: parsed.state,
                    hasCode: !!parsed.code,
                    hasError: !!parsed.error
                });
            }

            if (parsed.error) {
                throw new ZenuxOAuthError(
                    parsed.errorDescription || parsed.error,
                    'OAUTH_ERROR',
                    {
                        error: parsed.error,
                        errorDescription: parsed.errorDescription
                    }
                );
            }

            if (!parsed.code) {
                if (normalizedOptions.allowMissingCallback) {
                    return null;
                }
                throw new ZenuxOAuthError('No authorization code received', 'NO_AUTH_CODE');
            }

            const transaction = this.getTransaction(parsed.state);
            const expectedState = transaction && transaction.state ? transaction.state : this.storage.get('state');

            if (this.config.validateState) {
                if (!parsed.state || !expectedState || parsed.state !== expectedState) {
                    throw new ZenuxOAuthError('State mismatch', 'STATE_MISMATCH', {
                        expectedState,
                        receivedState: parsed.state
                    });
                }
            }

            if (isBrowser && normalizedOptions.notifyParent !== false) {
                this.notifyParent('progress', {
                    phase: 'exchanging_token',
                    state: parsed.state,
                    hasCode: true
                });
            }

            if (isBrowser && this.getParentWindow()) {
                this.setEmbeddedCallbackMask(true, 'Exchanging secure token', 'Almost done. Creating your session safely...');
            }

            const tokens = await this.exchangeCodeForTokens(parsed.code, {
                codeVerifier: normalizedOptions.codeVerifier || (transaction ? transaction.codeVerifier : null),
                redirectUri: normalizedOptions.redirectUri || (transaction ? transaction.redirectUri : null) || this.resolveRedirectUri({
                    ...normalizedOptions,
                    currentUrl: parsed.url
                }),
                extraTokenParams: normalizedOptions.extraTokenParams || normalizedOptions.extraParams
            });

            this.setTokens(tokens);
            this.clearTransaction(parsed.state);

            if (isBrowser && this.config.cleanupUrl && normalizedOptions.cleanupUrl !== false) {
                this.cleanupBrowserUrl(parsed.url);
            }

            this.emit('login', tokens);

            if (typeof normalizedOptions.onSuccess === 'function') {
                normalizedOptions.onSuccess(tokens);
            }

            if (isBrowser && normalizedOptions.notifyParent !== false) {
                this.notifyParent('success', {
                    state: parsed.state,
                    tokens
                });

                if (this.isPopupWindow() && normalizedOptions.closePopup !== false && this.config.closePopupOnSuccess) {
                    setTimeout(() => {
                        try {
                            window.close();
                        } catch {
                            // Ignore popup close failures.
                        }
                    }, Number.isFinite(Number(normalizedOptions.closeDelay)) ? Number(normalizedOptions.closeDelay) : 0);
                }
            }

            this.setEmbeddedCallbackMask(false);
            this.clearActiveFlowContext(parsed.state);
            return tokens;
        } catch (error) {
            const oauthError = this.toOAuthError(error, 'CALLBACK_FAILED');
            if (state) {
                this.clearTransaction(state);
            }

            this.setEmbeddedCallbackMask(false);

            if (typeof options.onError === 'function') {
                options.onError(oauthError);
            }

            if (isBrowser && options.notifyParent !== false) {
                this.notifyParent('error', {
                    state,
                    error: oauthError.message,
                    code: oauthError.code,
                    details: oauthError.details
                });
            }

            this.emit('error', oauthError);
            this.clearActiveFlowContext(state);
            throw oauthError;
        }
    }

    // ==================== TOKEN EXCHANGE ====================
    async exchangeCodeForTokens(code, options = {}) {
        const redirectUri = options.redirectUri || this.config.redirectUri;
        if (!redirectUri) {
            throw new ZenuxOAuthError('redirectUri is required for token exchange', 'MISSING_REDIRECT_URI');
        }

        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('code', code);
        body.set('redirect_uri', redirectUri);
        body.set('client_id', this.config.clientId);

        const codeVerifier = options.codeVerifier || this.storage.get('code_verifier');
        if (this.config.usePKCE && codeVerifier) {
            body.set('code_verifier', codeVerifier);
        }

        const extraTokenParams = {
            ...this.config.extraTokenParams,
            ...(options.extraTokenParams || {})
        };

        for (const [key, value] of Object.entries(extraTokenParams)) {
            if (value !== undefined && value !== null) {
                body.set(key, String(value));
            }
        }

        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(
            `${this.config.authServer}${this.config.tokenEndpoint}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: body.toString()
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Token exchange failed: ${response.status}`,
                'TOKEN_EXCHANGE_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        const tokens = await response.json();

        if (tokens.expires_in && !tokens.expires_at) {
            tokens.expires_at = Date.now() + (Number(tokens.expires_in) * 1000);
        }

        return tokens;
    }

    // ==================== BROWSER FLOWS ====================
    getPopupWindowFeatures(options = {}) {
        const width = Number.isFinite(Number(options.popupWidth)) ? Number(options.popupWidth) : this.config.popupWidth;
        const height = Number.isFinite(Number(options.popupHeight)) ? Number(options.popupHeight) : this.config.popupHeight;
        const left = Math.max(0, Math.round((window.screen.width - width) / 2));
        const top = Math.max(0, Math.round((window.screen.height - height) / 2));
        const extras = options.popupFeatures ? `,${options.popupFeatures}` : '';

        return `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes${extras}`;
    }

    openPopupFlow(authData, options = {}) {
        if (!isBrowser) {
            throw new ZenuxOAuthError('Popup mode is only available in browser environments', 'UNSUPPORTED_MODE');
        }

        const popupName = options.popupName || 'zenux_oauth_popup';
        const popup = window.open(authData.url, popupName, this.getPopupWindowFeatures(options));

        if (!popup) {
            throw new ZenuxOAuthError('Popup blocked by browser', 'POPUP_BLOCKED');
        }

        this._activePopup = popup;

        return this.waitForBrowserAuth(authData, {
            type: 'popup',
            timeout: Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 300000,
            checkClosed: () => popup.closed,
            cleanup: () => {
                try {
                    if (!popup.closed) {
                        popup.close();
                    }
                } catch {
                    // Ignore popup cleanup failures.
                }
                this._activePopup = null;
            },
            onCancelled: () => new ZenuxOAuthError('Popup closed by user', 'AUTH_CANCELLED'),
            onSettled: () => {
                this.clearActiveFlowContext(authData.state);
            }
        });
    }

    openUiFlow(authData, options = {}) {
        if (!isBrowser) {
            throw new ZenuxOAuthError('UI mode is only available in browser environments', 'UNSUPPORTED_MODE');
        }

        // If fallback is disabled, completely block UI flow (no iframe, no fallback)
        if (this.config.disableFallback) {
            throw new ZenuxOAuthError(
                'UI flow is disabled because disableFallback is true. Use mode "popup" or "redirect".',
                'UI_FLOW_DISABLED'
            );
        }

        const resolvedTheme = this.resolveTheme(options.theme || this.config.theme);
        const isDarkTheme = resolvedTheme === 'dark';
        const fallbackMode = this.getUiFallbackMode(options);
        const allowRedirectFallback = options.uiAllowRedirectFallback !== false && this.config.uiAllowRedirectFallback !== false;
        const uiCloseConfirm = options.uiCloseConfirm !== false && this.config.uiCloseConfirm !== false;
        const redirectFallbackDelay = Number.isFinite(Number(options.uiRedirectFallbackDelay))
            ? Number(options.uiRedirectFallbackDelay)
            : Number.isFinite(Number(this.config.uiRedirectFallbackDelay))
                ? Number(this.config.uiRedirectFallbackDelay)
                : 2600;
        const palette = isDarkTheme ? {
            backdrop: 'rgba(2, 6, 23, 0.72)',
            shellBackground: '#0b1220',
            shellShadow: '0 34px 70px rgba(2, 6, 23, 0.44)',
            closeBackground: 'rgba(10, 18, 32, 0.78)',
            closeText: '#f8fbff',
            frameBackground: '#08101d',
            loadingBackground: 'linear-gradient(180deg, rgba(5, 11, 20, 0.88), rgba(8, 16, 29, 0.96))',
            loadingCard: 'rgba(10, 18, 32, 0.96)',
            loadingBorder: 'rgba(148, 163, 184, 0.14)',
            text: '#ebf3fb',
            muted: '#93a7bc',
            accent: '#5ab0ff',
            accentStrong: '#3599ff',
            confirmBackground: 'rgba(8, 15, 27, 0.98)',
            confirmBorder: 'rgba(148, 163, 184, 0.12)',
            dangerBackground: '#3a1720',
            dangerText: '#ffc6d0',
            secondaryBackground: '#18263b',
            secondaryText: '#e8f0f7'
        } : {
            backdrop: 'rgba(15, 23, 42, 0.38)',
            shellBackground: '#ffffff',
            shellShadow: '0 30px 64px rgba(15, 23, 42, 0.22)',
            closeBackground: 'rgba(255, 255, 255, 0.92)',
            closeText: '#102033',
            frameBackground: '#ffffff',
            loadingBackground: 'linear-gradient(180deg, rgba(247, 250, 253, 0.92), rgba(240, 246, 251, 0.98))',
            loadingCard: 'rgba(255, 255, 255, 0.96)',
            loadingBorder: 'rgba(148, 163, 184, 0.14)',
            text: '#102033',
            muted: '#607286',
            accent: '#0f7cff',
            accentStrong: '#0b5fcc',
            confirmBackground: 'rgba(255, 255, 255, 0.98)',
            confirmBorder: 'rgba(148, 163, 184, 0.12)',
            dangerBackground: '#fff1f1',
            dangerText: '#a02727',
            secondaryBackground: '#edf3f8',
            secondaryText: '#102033'
        };

        const redirectBase = this.stripCallbackParams(authData.redirectUri) || null;
        let popupHandle = null;
        let hasLoadedFrame = false;
        let frameLoadCount = 0;
        let callbackStarted = false;
        let fallbackTriggered = false;
        let initialRevealTimer = null;
        let redirectFallbackTimer = null;
        let iframeResourceCursor = this.getIframeResourceSnapshot(0).cursor;
        let preferredFallbackUrl = authData.url;

        const overlay = document.createElement('div');
        const styleElement = document.createElement('style');
        const scrim = document.createElement('div');
        const sheet = document.createElement('section');
        const closeButton = document.createElement('button');
        const stage = document.createElement('div');
        const frameWrap = document.createElement('div');
        const frame = document.createElement('iframe');
        const loadingLayer = document.createElement('div');
        const spinner = document.createElement('div');
        const loadingTitle = document.createElement('div');
        const loadingText = document.createElement('div');
        const confirmBar = document.createElement('div');
        const confirmTitle = document.createElement('div');
        const confirmText = document.createElement('div');
        const confirmActions = document.createElement('div');
        const keepButton = document.createElement('button');
        const confirmCloseButton = document.createElement('button');

        let _resolvedFrameUrl = authData.url;
        const _onFrameMessage = (event) => {
            if (!event.origin.includes('zenuxs.in')) return;
            if (event.data?.type === 'zenux:navigate' && event.data.url) {
                _resolvedFrameUrl = event.data.url;
                this._addDebugEntry('ui-nav', `postMessage URL update: ${_resolvedFrameUrl}`);
            }
        };
        window.addEventListener('message', _onFrameMessage);

        const getObservedUrl = () => {
            if (frame && frame.src && frame.src !== 'about:blank') {
                return frame.src;
            }
            return _resolvedFrameUrl;
        };


        overlay.setAttribute('data-zenux-oauth-ui', 'true');
        overlay.className = 'zo-ui-overlay';

        styleElement.textContent = `
.zo-ui-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    background: ${palette.backdrop};
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
.zo-ui-scrim {
    position: absolute;
    inset: 0;
}
.zo-ui-sheet {
    position: relative;
    width: min(100vw, ${Math.max(this.config.uiWidth, 420)}px);
    height: min(94vh, ${Math.max(this.config.uiHeight, 560)}px);
    max-height: 94vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 26px 26px 0 0;
    background: ${palette.shellBackground};
    box-shadow: ${palette.shellShadow};
    transform: translateY(46px);
    opacity: 0;
    transition: transform 240ms ease, opacity 240ms ease;
}
.zo-ui-overlay.zo-open .zo-ui-sheet {
    transform: translateY(0);
    opacity: 1;
}
.zo-ui-close {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 4;
    width: 42px;
    height: 42px;
    border: 0;
    border-radius: 999px;
    background: ${palette.closeBackground};
    color: ${palette.closeText};
    font: 600 22px/1 "Segoe UI", system-ui, sans-serif;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
    transition: transform 180ms ease, opacity 180ms ease, background 180ms ease;
}
.zo-ui-close:hover {
    transform: scale(1.04);
}
.zo-ui-sheet.zo-confirming .zo-ui-close {
    transform: rotate(90deg) scale(0.98);
}
.zo-ui-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    background: ${palette.frameBackground};
}
.zo-ui-frame-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
.zo-ui-frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: ${palette.frameBackground};
    transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}
.zo-ui-sheet.zo-processing .zo-ui-frame {
    opacity: 0.06;
    transform: scale(0.986);
    filter: blur(4px);
}
.zo-ui-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 180ms ease;
    background: ${palette.loadingBackground};
}
.zo-ui-loading.is-visible {
    opacity: 1;
}
.zo-ui-loading-card {
    width: min(86%, 338px);
    padding: 24px 22px;
    border-radius: 24px;
    background: ${palette.loadingCard};
    border: 1px solid ${palette.loadingBorder};
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.16);
    text-align: center;
}
.zo-ui-spinner {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    border-radius: 50%;
    border: 4px solid transparent;
    border-top-color: ${palette.accent};
    border-right-color: ${palette.accentStrong};
    animation: zo-ui-spin 0.82s linear infinite;
}
.zo-ui-loading-title {
    font: 700 18px/1.2 "Segoe UI", system-ui, sans-serif;
    color: ${palette.text};
}
.zo-ui-loading-text {
    margin-top: 8px;
    font: 400 13px/1.7 "Segoe UI", system-ui, sans-serif;
    color: ${palette.muted};
}
.zo-ui-confirm {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 4;
    border-radius: 22px;
    background: ${palette.confirmBackground};
    border: 1px solid ${palette.confirmBorder};
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
    padding: 16px;
    opacity: 0;
    transform: translateY(24px);
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms ease;
}
.zo-ui-confirm.is-visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}
.zo-ui-confirm-title {
    font: 700 14px/1.2 "Segoe UI", system-ui, sans-serif;
    color: ${palette.text};
}
.zo-ui-confirm-text {
    margin-top: 6px;
    font: 400 13px/1.7 "Segoe UI", system-ui, sans-serif;
    color: ${palette.muted};
}
.zo-ui-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 14px;
}
.zo-ui-button {
    border: 0;
    border-radius: 14px;
    padding: 11px 14px;
    font: 600 13px/1 "Segoe UI", system-ui, sans-serif;
    cursor: pointer;
}
.zo-ui-button-secondary {
    background: ${palette.secondaryBackground};
    color: ${palette.secondaryText};
}
.zo-ui-button-danger {
    background: ${palette.dangerBackground};
    color: ${palette.dangerText};
}
@keyframes zo-ui-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
        `.trim();

        scrim.className = 'zo-ui-scrim';
        sheet.className = 'zo-ui-sheet';
        closeButton.className = 'zo-ui-close';
        closeButton.type = 'button';
        closeButton.textContent = '×';
        stage.className = 'zo-ui-stage';
        frameWrap.className = 'zo-ui-frame-wrap';
        frame.className = 'zo-ui-frame';
        frame.title = 'Zenux OAuth Login';
        frame.src = authData.url;
        loadingLayer.className = 'zo-ui-loading is-visible';
        confirmBar.className = 'zo-ui-confirm';
        confirmTitle.className = 'zo-ui-confirm-title';
        confirmText.className = 'zo-ui-confirm-text';
        confirmActions.className = 'zo-ui-confirm-actions';

        loadingLayer.innerHTML = '<div class="zo-ui-loading-card"></div>';
        const loadingCard = loadingLayer.firstChild;
        spinner.className = 'zo-ui-spinner';
        loadingTitle.className = 'zo-ui-loading-title';
        loadingText.className = 'zo-ui-loading-text';
        loadingCard.appendChild(spinner);
        loadingCard.appendChild(loadingTitle);
        loadingCard.appendChild(loadingText);

        confirmTitle.textContent = 'Close sign in?';
        confirmText.textContent = 'Are you sure you want to close this login?';

        keepButton.type = 'button';
        keepButton.className = 'zo-ui-button zo-ui-button-secondary';
        keepButton.textContent = 'Stay';

        confirmCloseButton.type = 'button';
        confirmCloseButton.className = 'zo-ui-button zo-ui-button-danger';
        confirmCloseButton.textContent = 'Close';

        confirmActions.appendChild(keepButton);
        confirmActions.appendChild(confirmCloseButton);
        confirmBar.appendChild(confirmTitle);
        confirmBar.appendChild(confirmText);
        confirmBar.appendChild(confirmActions);

        frameWrap.appendChild(frame);
        frameWrap.appendChild(loadingLayer);
        stage.appendChild(frameWrap);
        stage.appendChild(confirmBar);
        sheet.appendChild(closeButton);
        sheet.appendChild(stage);
        overlay.appendChild(styleElement);
        overlay.appendChild(scrim);
        overlay.appendChild(sheet);

        const setLoadingState = (visible, heading, message) => {
            loadingLayer.classList.toggle('is-visible', visible);
            sheet.classList.toggle('zo-processing', visible);
            if (heading) {
                loadingTitle.textContent = heading;
            }
            if (message) {
                loadingText.textContent = message;
            }
        };

        const resolveFallbackUrl = (overrideUrl = null) => overrideUrl || preferredFallbackUrl || authData.url;

        const clearRedirectFallbackTimer = () => {
            if (redirectFallbackTimer) {
                clearTimeout(redirectFallbackTimer);
                redirectFallbackTimer = null;
                this._addDebugEntry('ui-fallback', 'Cleared fallback timer');
            }
        };

       
        const scheduleRedirectFallback = (reason, heading, message) => {
            this._addDebugEntry('ui-fallback', `scheduleRedirectFallback: ${reason}`);
            if (callbackStarted || fallbackTriggered || redirectFallbackTimer || redirectFallbackDelay <= 0) return;

            const authServerHost = this.config.authServer.replace(/^https?:\/\//, '');
            const isZenuxsUrl = (url) => url && (url.includes('zenuxs.in') || url.includes(authServerHost));

            const observedUrl = getObservedUrl();
            if (isZenuxsUrl(observedUrl)) {
                this._addDebugEntry('ui-fallback', `aborted, still Zenuxs: ${observedUrl}`);
                return;
            }

            setLoadingState(true, heading, message);
            redirectFallbackTimer = setTimeout(() => {
                redirectFallbackTimer = null;
                if (callbackStarted || fallbackTriggered) return;
                const finalUrl = getObservedUrl();
                if (isZenuxsUrl(finalUrl)) {
                    this._addDebugEntry('ui-fallback', `timer fired but still Zenuxs: ${finalUrl}`);
                    return;
                }
                setLoadingState(true, 'Continuing sign in', 'Opening this step in a safer window...');
                triggerFallback(reason, finalUrl);
            }, redirectFallbackDelay);
        };

        const triggerFallback = (reason, overrideUrl = null) => {
            this._addDebugEntry('ui-fallback', `triggerFallback: ${reason}, url: ${overrideUrl}`);
            if (fallbackTriggered) return;

            const authServerHost = this.config.authServer.replace(/^https?:\/\//, '');
            const isZenuxsUrl = (url) => url && (url.includes('zenuxs.in') || url.includes(authServerHost));

            const observedUrl = overrideUrl || getObservedUrl();
            if (isZenuxsUrl(observedUrl)) {
                this._addDebugEntry('ui-fallback', `aborted, Zenuxs URL: ${observedUrl}`);
                return;
            }

            clearRedirectFallbackTimer();
            fallbackTriggered = true;

            if (fallbackMode === 'popup') {
                const popupOpened = openPopupFallback(reason, observedUrl);
                if (popupOpened) return;
                if (allowRedirectFallback) { fallbackToRedirect(reason, observedUrl); return; }
                fallbackTriggered = false;
                setLoadingState(false, 'Popup blocked', 'Allow popups for this site to continue sign in.');
                return;
            }

            if (allowRedirectFallback) { fallbackToRedirect(reason, observedUrl); return; }
            fallbackTriggered = false;
        };

        const showConfirm = () => {
            sheet.classList.add('zo-confirming');
            confirmBar.classList.add('is-visible');
        };

        const hideConfirm = () => {
            sheet.classList.remove('zo-confirming');
            confirmBar.classList.remove('is-visible');
        };

        const fallbackToRedirect = (reason, overrideUrl = null) => {
            const destinationUrl = resolveFallbackUrl(overrideUrl);
            this._addDebugEntry('ui-fallback', `Executing redirect fallback to: ${destinationUrl}, reason: ${reason}`);
            clearRedirectFallbackTimer();
            setLoadingState(true, 'Opening secure page', 'Continuing sign in outside the embedded view...');
            window.location.assign(destinationUrl);
        };

        const openPopupFallback = (reason, overrideUrl = null) => {
            const destinationUrl = resolveFallbackUrl(overrideUrl);
            if (popupHandle && !popupHandle.closed) {
                try {
                    popupHandle.focus();
                    this._addDebugEntry('ui-fallback', `Popup fallback already open, focusing`);
                } catch { }
                return true;
            }
            const popup = window.open(
                destinationUrl,
                options.popupName || 'zenux_oauth_popup',
                this.getPopupWindowFeatures(options)
            );
            if (!popup) {
                this._addDebugEntry('ui-fallback', `Popup fallback blocked by browser, reason: ${reason}`);
                return false;
            }
            clearRedirectFallbackTimer();
            popupHandle = popup;
            this._activePopup = popup;
            callbackStarted = false;
            setLoadingState(true, 'Opening secure popup', 'Provider sign in is continuing in a popup window...');
            this._addDebugEntry('ui-fallback', `Popup fallback opened: ${destinationUrl}, reason: ${reason}`);
            return true;
        };

        setLoadingState(true, 'Opening secure sign in', 'Loading the login screen...');

        frame.addEventListener('load', () => {
            frameLoadCount += 1;

            // Read src directly — always works, always reflects current load
            const observedUrl = getObservedUrl();
            preferredFallbackUrl = observedUrl; // keep in sync

            this._addDebugEntry('ui-load', `Frame load #${frameLoadCount}, observed URL: ${observedUrl}`);

            const authServerHost = this.config.authServer.replace(/^https?:\/\//, '');
            const isZenuxsDomain = (url) => {
                if (!url) return false;
                return url.includes('zenuxs.in') || url.includes(authServerHost);
            };

            // 1. Callback detected
            if (observedUrl && (observedUrl.includes('?code=') || observedUrl.includes('&code=') || observedUrl.includes('?error='))) {
                this._addDebugEntry('ui-load', 'Callback detected, finishing');
                callbackStarted = true;
                clearRedirectFallbackTimer();
                hideConfirm();
                setLoadingState(true, 'Finishing sign in', 'Securing your session...');
                return;
            }

            // 2. Still on Zenuxs
            if (isZenuxsDomain(observedUrl)) {
                this._addDebugEntry('ui-load', `Still on Zenuxs domain (${observedUrl}), clearing timers`);
                clearRedirectFallbackTimer();
                if (!hasLoadedFrame) {
                    hasLoadedFrame = true;
                    initialRevealTimer = setTimeout(() => {
                        initialRevealTimer = null;
                        if (!callbackStarted && !fallbackTriggered) {
                            setLoadingState(false, '', '');
                        }
                    }, 320);
                }
                return;
            }

            // 3. Frame-sensitive provider
            if (!callbackStarted && this.isFrameSensitiveUrl(observedUrl)) {
                this._addDebugEntry('ui-load', `Frame-sensitive URL: ${observedUrl}`);
                clearRedirectFallbackTimer();
                setLoadingState(true, 'Continuing sign in', 'Opening the provider in a safer window...');
                triggerFallback('frame_sensitive_provider_navigation', observedUrl);
                return;
            }

            // 4. External domain
            if (!callbackStarted && !fallbackTriggered) {
                this._addDebugEntry('ui-load', `External domain, scheduling fallback: ${observedUrl}`);
                scheduleRedirectFallback('provider_redirect_stalled', 'Continuing sign in', 'Please wait while the provider redirects...');
            }

            if (!hasLoadedFrame) {
                hasLoadedFrame = true;
                initialRevealTimer = setTimeout(() => {
                    initialRevealTimer = null;
                    if (!callbackStarted && !fallbackTriggered && !isZenuxsDomain(getObservedUrl())) {
                        setLoadingState(false, '', '');
                    }
                }, 320);
            }
        });

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.body.appendChild(overlay);
        this._activeUi = overlay;

        requestAnimationFrame(() => {
            overlay.classList.add('zo-open');
        });

        return this.waitForBrowserAuth(authData, {
            type: 'ui',
            timeout: Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 300000,
            checkClosed: () => !!(popupHandle && popupHandle.closed && fallbackTriggered),
            cleanup: () => {
                clearRedirectFallbackTimer();
                if (initialRevealTimer) {
                    clearTimeout(initialRevealTimer);
                    initialRevealTimer = null;
                }
                document.body.style.overflow = previousOverflow;
                overlay.classList.remove('zo-open');
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 220);
                if (popupHandle) {
                    try {
                        if (!popupHandle.closed) {
                            popupHandle.close();
                        }
                    } catch { }
                }
                this._activeUi = null;
                this._activePopup = null;
            },
            onCancelled: () => new ZenuxOAuthError('Embedded login closed by user', 'AUTH_CANCELLED'),
            onSettled: () => {
                this.clearActiveFlowContext(authData.state);
            },
            onProgress: (data) => {
                this._addDebugEntry('ui-progress', data);
                if (data.phase === 'callback_detected') {
                    callbackStarted = true;
                    clearRedirectFallbackTimer();
                    hideConfirm();
                    setLoadingState(true, 'Finishing sign in', 'Securing your session...');
                } else if (data.phase === 'exchanging_token') {
                    callbackStarted = true;
                    clearRedirectFallbackTimer();
                    hideConfirm();
                    setLoadingState(true, 'Signing you in', 'Creating your session...');
                } else if (data.phase === 'embedded_return_without_callback') {
                    callbackStarted = false;
                    clearRedirectFallbackTimer();
                    setLoadingState(true, 'Continuing sign in', 'Moving this step out of the embedded view...');
                    triggerFallback('embedded_return_without_callback');
                }
            },
            attachCancel: reject => {
                keepButton.addEventListener('click', () => {
                    hideConfirm();
                });
                confirmCloseButton.addEventListener('click', () => {
                    reject(new ZenuxOAuthError('Embedded login closed by user', 'AUTH_CANCELLED'));
                });
                closeButton.addEventListener('click', () => {
                    if (!uiCloseConfirm) {
                        reject(new ZenuxOAuthError('Embedded login closed by user', 'AUTH_CANCELLED'));
                        return;
                    }
                    if (confirmBar.classList.contains('is-visible')) {
                        hideConfirm();
                        return;
                    }
                    showConfirm();
                });
                scrim.addEventListener('click', () => {
                    if (uiCloseConfirm) {
                        showConfirm();
                    }
                });
            }
        });
    }

    waitForBrowserAuth(authData, flowOptions) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let timeoutId = null;
            let checkTimer = null;

            const finish = callback => value => {
                if (settled) {
                    return;
                }

                settled = true;

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (checkTimer) {
                    clearInterval(checkTimer);
                }

                window.removeEventListener('message', messageHandler);

                try {
                    flowOptions.cleanup();
                } catch {
                    // Ignore cleanup failures.
                }

                if (typeof flowOptions.onSettled === 'function') {
                    try {
                        flowOptions.onSettled(value);
                    } catch {
                        // Ignore settle hook failures.
                    }
                }

                callback(value);
            };

            const resolveOnce = finish(value => resolve(value));
            const rejectOnce = finish(error => {
                const oauthError = this.toOAuthError(error, 'AUTH_FLOW_FAILED');
                this.emit('error', oauthError);
                reject(oauthError);
            });

            const messageHandler = event => {
                const data = event.data || {};
                if (!data || (
                    data.type !== `${DEFAULT_MESSAGE_PREFIX}_success` &&
                    data.type !== `${DEFAULT_MESSAGE_PREFIX}_error` &&
                    data.type !== `${DEFAULT_MESSAGE_PREFIX}_progress`
                )) {
                    return;
                }

                if (event.origin && event.origin !== 'null' && event.origin !== window.location.origin) {
                    return;
                }

                if (data.clientId && data.clientId !== this.config.clientId) {
                    return;
                }

                if (authData.state && data.state && data.state !== authData.state) {
                    return;
                }

                if (data.type === `${DEFAULT_MESSAGE_PREFIX}_progress`) {
                    if (typeof flowOptions.onProgress === 'function') {
                        flowOptions.onProgress(data, event);
                    }
                    return;
                }

                if (data.type === `${DEFAULT_MESSAGE_PREFIX}_success`) {
                    this.setTokens(data.tokens);
                    this.emit('login', data.tokens);
                    resolveOnce(data.tokens);
                    return;
                }

                rejectOnce(new ZenuxOAuthError(
                    data.error || 'Authentication failed',
                    data.code || 'AUTH_FLOW_FAILED',
                    data.details || {}
                ));
            };

            window.addEventListener('message', messageHandler);

            if (typeof flowOptions.attachCancel === 'function') {
                flowOptions.attachCancel(rejectOnce);
            }

            if (typeof flowOptions.checkClosed === 'function') {
                checkTimer = setInterval(() => {
                    if (flowOptions.checkClosed()) {
                        rejectOnce(flowOptions.onCancelled());
                    }
                }, 500);
            }

            timeoutId = setTimeout(() => {
                rejectOnce(new ZenuxOAuthError('Authentication timed out', 'AUTH_TIMEOUT'));
            }, flowOptions.timeout);
        });
    }

    getParentWindow() {
        if (!isBrowser) {
            return null;
        }

        if (window.opener && window.opener !== window) {
            return window.opener;
        }

        if (window.parent && window.parent !== window) {
            return window.parent;
        }

        return null;
    }

    getParentOAuthInstance() {
        const parentWindow = this.getParentWindow();
        if (!parentWindow) {
            return null;
        }

        try {
            const instance = parentWindow.ZenuxOAuthInstance;
            if (instance && typeof instance.getTransaction === 'function') {
                return instance;
            }
        } catch {
            return null;
        }

        return null;
    }

    isPopupWindow() {
        return isBrowser && !!(window.opener && window.opener !== window);
    }

    notifyParent(type, payload) {
        const target = this.getParentWindow();
        if (!target) {
            return false;
        }

        try {
            target.postMessage({
                type: `${DEFAULT_MESSAGE_PREFIX}_${type}`,
                clientId: this.config.clientId,
                ...payload
            }, '*');
            return true;
        } catch {
            return false;
        }
    }

    // ==================== TOKEN MANAGEMENT ====================
    getTokens() {
        return this.session.tokens;
    }

    getAccessToken() {
        return this.session.tokens ? this.session.tokens.access_token : null;
    }

    isAuthenticated() {
        return !!(this.getAccessToken() && !this.isTokenExpired());
    }

    isTokenExpired(bufferSeconds = null) {
        const tokens = this.getTokens();
        if (!tokens || !tokens.expires_at) {
            return false;
        }

        const threshold = bufferSeconds === null ? this.config.refreshThreshold : Number(bufferSeconds);
        return Date.now() >= (Number(tokens.expires_at) - (Math.max(0, threshold) * 1000));
    }

    async refreshTokens(options = {}) {
        const tokens = this.getTokens();
        if (!tokens || !tokens.refresh_token) {
            throw new ZenuxOAuthError('No refresh token available', 'NO_REFRESH_TOKEN');
        }

        const body = new URLSearchParams();
        body.set('grant_type', 'refresh_token');
        body.set('refresh_token', tokens.refresh_token);
        body.set('client_id', this.config.clientId);

        const extraTokenParams = {
            ...this.config.extraTokenParams,
            ...(options.extraTokenParams || options.extraParams || {})
        };

        for (const [key, value] of Object.entries(extraTokenParams)) {
            if (value !== undefined && value !== null) {
                body.set(key, String(value));
            }
        }

        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(`${this.config.authServer}${this.config.tokenEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Token refresh failed: ${response.status}`,
                'TOKEN_REFRESH_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        const newTokens = await response.json();
        if (newTokens.expires_in && !newTokens.expires_at) {
            newTokens.expires_at = Date.now() + (Number(newTokens.expires_in) * 1000);
        }

        if (!newTokens.refresh_token) {
            newTokens.refresh_token = tokens.refresh_token;
        }

        this.setTokens(newTokens);
        this.emit('tokenRefresh', newTokens);
        return newTokens;
    }

    setupAutoRefresh() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }

        this._refreshInterval = setInterval(() => {
            const tokens = this.getTokens();
            if (!tokens || !tokens.refresh_token) {
                return;
            }

            if (this.isTokenExpired()) {
                this.emit('tokenExpired');
                this.refreshTokens().catch(error => {
                    this.emit('error', this.toOAuthError(error, 'TOKEN_REFRESH_FAILED'));
                });
            }
        }, 30000);
    }

    // ==================== USER / METADATA ====================
    async getUserInfo() {
        const accessToken = this.getAccessToken();
        if (!accessToken) {
            throw new ZenuxOAuthError('No access token available', 'NO_ACCESS_TOKEN');
        }

        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(`${this.config.authServer}${this.config.userinfoEndpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `UserInfo request failed: ${response.status}`,
                'USERINFO_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        return response.json();
    }

    async getDiscoveryDocument() {
        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(`${this.config.authServer}${this.config.discoveryEndpoint}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Discovery request failed: ${response.status}`,
                'DISCOVERY_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        return response.json();
    }

    async getJwks() {
        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(`${this.config.authServer}${this.config.jwksEndpoint}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `JWKS request failed: ${response.status}`,
                'JWKS_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        return response.json();
    }

    async getClientInfo(clientId) {
        const resolvedClientId = clientId || this.config.clientId;
        if (!resolvedClientId) {
            throw new ZenuxOAuthError('clientId is required', 'MISSING_CLIENT_ID');
        }

        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(
            `${this.config.authServer}${this.config.clientInfoEndpoint}/${encodeURIComponent(resolvedClientId)}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Client info request failed: ${response.status}`,
                'CLIENT_INFO_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        return response.json();
    }

    // ==================== LOGOUT ====================
    async logout(options = {}) {
        const tokens = this.getTokens();
        const revoke = options.revoke === true || options.revokeTokens === true;

        if (revoke && tokens) {
            try {
                if (tokens.access_token) {
                    await this.revokeToken(tokens.access_token, 'access_token');
                }
                if (tokens.refresh_token) {
                    await this.revokeToken(tokens.refresh_token, 'refresh_token');
                }
            } catch (error) {
                this.debugLog('Token revoke failed during logout', error);
            }
        }

        this.clearTokens();
        this.clearTransaction();

        if (options.clearStorage !== false) {
            this.storage.clear();
        }

        this.emit('logout');
        return true;
    }

    async revokeToken(token, tokenType = 'access_token') {
        if (!token) {
            throw new ZenuxOAuthError('Token is required for revocation', 'MISSING_TOKEN');
        }

        const body = new URLSearchParams();
        body.set('token', token);
        body.set('token_type_hint', tokenType);
        body.set('client_id', this.config.clientId);

        const fetchFunction = await this.getFetchFunction();
        const response = await fetchFunction(`${this.config.authServer}${this.config.revokeEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ZenuxOAuthError(
                `Token revocation failed: ${response.status}`,
                'REVOKE_FAILED',
                {
                    status: response.status,
                    response: errorText
                }
            );
        }

        return true;
    }

    // ==================== UTILITIES ====================
    getAuthenticatedFetch() {
        return async (url, options = {}) => {
            const currentTokens = this.getTokens();
            if (currentTokens && currentTokens.refresh_token && this.isTokenExpired()) {
                this.emit('tokenExpired');
                await this.refreshTokens();
            }

            const accessToken = this.getAccessToken();
            if (!accessToken) {
                throw new ZenuxOAuthError('No access token available', 'NO_ACCESS_TOKEN');
            }

            const fetchFunction = await this.getFetchFunction();
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                ...(options.headers || {})
            };

            return fetchFunction(url, {
                ...options,
                headers
            });
        };
    }

    decodeJWT(token) {
        if (!token || typeof token !== 'string') {
            return null;
        }

        try {
            const payload = token.split('.')[1];
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

            let json = '';
            if (typeof Buffer !== 'undefined') {
                json = Buffer.from(base64, 'base64').toString('utf8');
            } else if (typeof atob !== 'undefined') {
                json = decodeURIComponent(
                    atob(base64).split('').map(character =>
                        `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`
                    ).join('')
                );
            }

            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    exportSession() {
        return {
            tokens: this.getTokens(),
            clientId: this.config.clientId,
            authServer: this.config.authServer
        };
    }

    importSession(data) {
        if (!data || !data.tokens) {
            throw new ZenuxOAuthError('Session data with tokens is required', 'INVALID_SESSION');
        }

        this.setTokens(data.tokens);
        return this.getTokens();
    }

    getSessionState() {
        const tokens = this.getTokens();
        return {
            isAuthenticated: this.isAuthenticated(),
            tokens,
            expiresAt: tokens ? tokens.expires_at : null,
            timeUntilExpiry: tokens && tokens.expires_at
                ? Math.max(0, Math.floor((Number(tokens.expires_at) - Date.now()) / 1000))
                : null
        };
    }

    destroy() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }

        if (this._activeUi && this._activeUi.parentNode) {
            this._activeUi.parentNode.removeChild(this._activeUi);
            this._activeUi = null;
        }

        if (this._activePopup) {
            try {
                if (!this._activePopup.closed) {
                    this._activePopup.close();
                }
            } catch {
                // Ignore popup cleanup failures.
            }
            this._activePopup = null;
        }

        this._listeners = {};
    }
}

// Attach list of supported scopes for easy reference
ZenuxOAuth.supportedScopes = SUPPORTED_SCOPES;

// ==================== EXPORT ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZenuxOAuth;
    module.exports.ZenuxOAuth = ZenuxOAuth;
    module.exports.ZenuxOAuthError = ZenuxOAuthError;
} else if (typeof define === 'function' && define.amd) {
    define([], function () {
        return {
            ZenuxOAuth,
            ZenuxOAuthError
        };
    });
} else if (typeof window !== 'undefined') {
    window.ZenuxOAuth = ZenuxOAuth;
    window.ZenuxOAuthError = ZenuxOAuthError;
} else if (typeof global !== 'undefined') {
    global.ZenuxOAuth = ZenuxOAuth;
    global.ZenuxOAuthError = ZenuxOAuthError;
}

if (typeof exports !== 'undefined') {
    exports.ZenuxOAuth = ZenuxOAuth;
    exports.ZenuxOAuthError = ZenuxOAuthError;
}