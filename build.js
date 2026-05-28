const fs = require('fs');
const path = require('path');
const uglifyJS = require('uglify-js');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const sourcePath = path.join(__dirname, 'src', 'zenux-oauth.js');
let sourceCode = fs.readFileSync(sourcePath, 'utf8');

const browserCode = sourceCode.replace(
    /async sha256\(plain\) \{[\s\S]*?throw new ZenuxOAuthError[^}]*\}/,
    `async sha256(plain) {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(plain);
            const hash = await crypto.subtle.digest('SHA-256', data);
            return btoa(String.fromCharCode(...new Uint8Array(hash)))
                .replace(/\\+/g, '-')
                .replace(/\\//g, '_')
                .replace(/=/g, '');
        }
        
        // For Node.js environments, this will be overridden by the CJS version
        throw new ZenuxOAuthError(
            'SHA-256 not supported in this environment. Use Node.js specific build for server-side.',
            'CRYPTO_NOT_SUPPORTED'
        );
    }`
);

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.js'),
    browserCode
);

const minified = uglifyJS.minify(browserCode);
if (minified.error) {
    console.error('Minification error:', minified.error);
    process.exit(1);
}

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.min.js'),
    minified.code
);

let esmCode = browserCode
    .replace(/\/\/ UMD pattern for universal module definition[\s\S]*?\(typeof window !== 'undefined' \? window : this, function \(\) \{[\s\S]*?return ZenuxOAuth;[\s\S]*?\}\)\);/, '')
    .trim() + '\n\nexport default ZenuxOAuth;\nexport { ZenuxOAuth, ZenuxOAuthError };';

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.esm.js'),
    esmCode
);

// Create CommonJS version with Node.js crypto support
const nodeCryptoCode = sourceCode.replace(
    /async sha256\(plain\) \{[\s\S]*?throw new ZenuxOAuthError[^}]*\}/,
    `async sha256(plain) {
        // Node.js environment
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(plain).digest('base64');
            return hash.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
        }
        
        // Browser environment
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(plain);
            const hash = await crypto.subtle.digest('SHA-256', data);
            return btoa(String.fromCharCode(...new Uint8Array(hash)))
                .replace(/\\+/g, '-')
                .replace(/\\//g, '_')
                .replace(/=/g, '');
        }

        throw new ZenuxOAuthError(
            'SHA-256 not supported in this environment',
            'CRYPTO_NOT_SUPPORTED'
        );
    }`
);

const cjsCode = nodeCryptoCode
    // Remove UMD wrapper
    .replace(/\/\/ UMD pattern for universal module definition[\s\S]*?\(typeof window !== 'undefined' \? window : this, function \(\) \{[\s\S]*?return ZenuxOAuth;[\s\S]*?\}\)\);/, '')
    // Add CommonJS export
    .trim() + '\n\nmodule.exports = ZenuxOAuth;\nmodule.exports.ZenuxOAuth = ZenuxOAuth;\nmodule.exports.ZenuxOAuthError = ZenuxOAuthError;';

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.cjs.js'),
    cjsCode
);

// Create TypeScript definitions
const typeDefinitions = `export type ZenuxOAuthMode = 'ui' | 'inui' | 'iframe' | 'popup' | 'redirect' | 'manual';

export type ZenuxOAuthFetch = (...args: any[]) => Promise<any>;

export interface ZenuxOAuthStorageLike {
    getItem?(key: string): string | null;
    setItem?(key: string, value: string): void;
    removeItem?(key: string): void;
    get?(key: string): string | null;
    set?(key: string, value: string): void;
    remove?(key: string): void;
    clear?(): void;
    clearPrefix?(prefix: string): void;
}

export interface ZenuxOAuthConfig {
    clientId: string;
    authServer?: string;
    redirectUri?: string;
    scopes?: string;
    authorizeEndpoint?: string;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
    discoveryEndpoint?: string;
    jwksEndpoint?: string;
    clientInfoEndpoint?: string;
    revokeEndpoint?: string;
    storage?: 'auto' | 'localStorage' | 'sessionStorage' | 'memory' | ZenuxOAuthStorageLike;
    storagePrefix?: string;
    autoRefresh?: boolean;
    refreshThreshold?: number;
    debug?: boolean;
    usePKCE?: boolean;
    validateState?: boolean;
    fetch?: ZenuxOAuthFetch;
    fetchFunction?: ZenuxOAuthFetch;
    theme?: 'auto' | 'light' | 'dark' | string;
    mode?: ZenuxOAuthMode | string;
    frontendMode?: ZenuxOAuthMode | string;
    backendMode?: ZenuxOAuthMode | string;
    provider?: string;
    popupWidth?: number;
    popupHeight?: number;
    uiWidth?: number;
    uiHeight?: number;
    uiTitle?: string;
    uiDescription?: string;
    uiFallbackMode?: 'popup' | 'redirect' | string;
    uiAllowRedirectFallback?: boolean;
    uiCloseConfirm?: boolean;
    uiLoadHintDelay?: number;
    extraAuthParams?: Record<string, any>;
    extraTokenParams?: Record<string, any>;
}

export interface TokenResponse {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
    expires_at?: number;
    [key: string]: any;
}

export interface UserInfo {
    sub: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
    given_name?: string;
    family_name?: string;
    [key: string]: any;
}

export interface ZenuxOAuthAuthorizationRequest {
    url: string;
    state: string;
    nonce: string;
    codeVerifier?: string | null;
    redirectUri: string;
    mode: string;
}

export interface ZenuxOAuthLoginOptions {
    mode?: ZenuxOAuthMode | string;
    flow?: ZenuxOAuthMode | string;
    loginMode?: ZenuxOAuthMode | string;
    theme?: 'auto' | 'light' | 'dark' | string;
    provider?: string;
    identityProvider?: string;
    connection?: string;
    idp?: string;
    redirectUri?: string;
    currentUrl?: string;
    callbackUrl?: string;
    request?: any;
    response?: any;
    baseUrl?: string;
    timeout?: number;
    popupName?: string;
    popupWidth?: number;
    popupHeight?: number;
    popupFeatures?: string;
    uiTitle?: string;
    uiDescription?: string;
    uiFallbackMode?: 'popup' | 'redirect' | string;
    uiAllowRedirectFallback?: boolean;
    uiCloseConfirm?: boolean;
    extraAuthParams?: Record<string, any>;
    extraTokenParams?: Record<string, any>;
    autoLogin?: boolean;
    allowMissingCallback?: boolean;
    notifyParent?: boolean;
    closePopup?: boolean;
    closeDelay?: number;
    redirectStatus?: number;
    onSuccess?: (tokens: TokenResponse) => void;
    onError?: (error: ZenuxOAuthError) => void;
    [key: string]: any;
}

export interface ZenuxOAuthSessionState {
    isAuthenticated: boolean;
    tokens: TokenResponse | null;
    expiresAt: number | null;
    timeUntilExpiry: number | null;
}

export interface ZenuxOAuthExportedSession {
    tokens: TokenResponse | null;
    clientId: string;
    authServer: string;
}

declare class ZenuxOAuthError extends Error {
    constructor(message: string, code: string, details?: any);
    code: string;
    details: any;
    timestamp: string;
    toJSON(): any;
}

declare class ZenuxOAuth {
    constructor(config: ZenuxOAuthConfig);

    login(options?: ZenuxOAuthLoginOptions | ZenuxOAuthMode): Promise<TokenResponse | ZenuxOAuthAuthorizationRequest | null>;
    init(options?: ZenuxOAuthLoginOptions): Promise<TokenResponse | ZenuxOAuthSessionState | null>;
    handleCallback(callbackUrl?: string | ZenuxOAuthLoginOptions, options?: ZenuxOAuthLoginOptions): Promise<TokenResponse | null>;
    getAuthorizationUrl(options?: ZenuxOAuthLoginOptions): Promise<ZenuxOAuthAuthorizationRequest>;
    exchangeCodeForTokens(code: string, options?: ZenuxOAuthLoginOptions): Promise<TokenResponse>;
    getUserInfo(): Promise<UserInfo>;
    getDiscoveryDocument(): Promise<any>;
    getJwks(): Promise<any>;
    getClientInfo(clientId?: string): Promise<any>;
    getTokens(): TokenResponse | null;
    getAccessToken(): string | null;
    isAuthenticated(): boolean;
    isTokenExpired(bufferSeconds?: number | null): boolean;
    logout(options?: any): Promise<boolean>;
    refreshTokens(options?: any): Promise<TokenResponse>;
    revokeToken(token?: string, tokenType?: string): Promise<boolean>;
    decodeJWT(token: string): any;
    exportSession(): ZenuxOAuthExportedSession;
    importSession(data: ZenuxOAuthExportedSession): TokenResponse;
    getSessionState(): ZenuxOAuthSessionState;
    getAuthenticatedFetch(): ZenuxOAuthFetch;
    on(event: string, handler: Function): Function;
    off(event: string, handler?: Function): void;
    emit(event: string, payload?: any): void;
    destroy(): void;
    static supportedScopes: string[];
}

export default ZenuxOAuth;
export { ZenuxOAuth, ZenuxOAuthError };`;

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.d.ts'),
    typeDefinitions
);

// Copy callback.html to dist
fs.copyFileSync(
    path.join(__dirname, 'callback.html'),
    path.join(distDir, 'callback.html')
);

// Create package.json for dist with proper exports
const distPackageJson = {
    name: "zenuxs-oauth",
    version: "5.2.0",
    main: "zenux-oauth.cjs.js",
    module: "zenux-oauth.esm.js",
    browser: "zenux-oauth.js",
    types: "zenux-oauth.d.ts",
    exports: {
        ".": {
            import: "./zenux-oauth.esm.js",
            require: "./zenux-oauth.cjs.js",
            browser: "./zenux-oauth.js",
            default: "./zenux-oauth.js"
        },
        "./callback": {
            browser: "./callback.html",
            default: "./callback.html"
        }
    },
    files: [
        "*.js",
        "*.d.ts",
        "callback.html"
    ]
};

fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
);

console.log('Build completed successfully!');
console.log('✓ Created dist/zenux-oauth.js (UMD - Browser)');
console.log('✓ Created dist/zenux-oauth.min.js (UMD minified - Browser)');
console.log('✓ Created dist/zenux-oauth.esm.js (ES Module - Browser)');
console.log('✓ Created dist/zenux-oauth.cjs.js (CommonJS - Node.js)');
console.log('✓ Created dist/zenux-oauth.d.ts (TypeScript)');
console.log('✓ Created dist/package.json (Exports mapping)');
console.log('✓ Copied callback.html to dist/');
