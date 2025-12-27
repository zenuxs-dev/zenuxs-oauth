const fs = require('fs');
const path = require('path');
const uglifyJS = require('uglify-js');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Read source file
const sourcePath = path.join(__dirname, 'src', 'zenux-oauth.js');
let sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Create browser-compatible version by removing Node.js specific crypto code
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

// Create regular version (UMD) - Browser compatible
fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.js'),
    browserCode
);

// Create minified version (UMD) - Browser compatible
const minified = uglifyJS.minify(browserCode);
if (minified.error) {
    console.error('Minification error:', minified.error);
    process.exit(1);
}

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.min.js'),
    minified.code
);

// Create ES module version (without UMD wrapper) - Browser compatible
let esmCode = browserCode
    // Remove UMD wrapper
    .replace(/\/\/ UMD pattern for universal module definition[\s\S]*?\(typeof window !== 'undefined' \? window : this, function \(\) \{[\s\S]*?return ZenuxOAuth;[\s\S]*?\}\)\);/, '')
    // Add ES module export
    .trim() + '\n\nexport default ZenuxOAuth;';

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
    .trim() + '\n\nmodule.exports = ZenuxOAuth;';

fs.writeFileSync(
    path.join(distDir, 'zenux-oauth.cjs.js'),
    cjsCode
);

// Create TypeScript definitions
const typeDefinitions = `declare interface ZenuxOAuthConfig {
    clientId: string;
    redirectUri?: string;
    authServer?: string;
    frontend?: string;
    scopes?: string;
    storage?: 'localStorage' | 'sessionStorage' | 'memory';
    autoRefresh?: boolean;
    debug?: boolean;
    usePKCE?: boolean;
    useCSRF?: boolean;
    fetchFunction?: Function;
}

declare interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
    expires_at?: number;
}

declare interface UserInfo {
    sub: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
    given_name?: string;
    family_name?: string;
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
    
    login(options?: any): Promise<any>;
    handleCallback(callbackUrl?: string): Promise<TokenResponse>;
    getUserInfo(): Promise<UserInfo>;
    getTokens(): TokenResponse | null;
    isAuthenticated(): boolean;
    logout(options?: any): Promise<boolean>;
    refreshTokens(): Promise<TokenResponse>;
    decodeJWT(token: string): any;
    getAuthorizationUrl(options?: any): Promise<any>;
    getAuthenticatedFetch(): Function;
    revokeToken(token?: string, tokenType?: string): Promise<boolean>;
    destroy(): void;
}

export default ZenuxOAuth;
export { ZenuxOAuth, ZenuxOAuthError, ZenuxOAuthConfig, TokenResponse, UserInfo };`;

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
    version: "2.2.0",
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