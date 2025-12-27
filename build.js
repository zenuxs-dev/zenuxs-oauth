import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  // Clean dist directory
  const distDir = path.join(__dirname, 'dist');
  try {
    await fs.rm(distDir, { recursive: true, force: true });
  } catch {}
  await fs.mkdir(distDir, { recursive: true });

  // Create subdirectories
  await fs.mkdir(path.join(distDir, 'browser'), { recursive: true });
  await fs.mkdir(path.join(distDir, 'server'), { recursive: true });
  await fs.mkdir(path.join(distDir, 'core'), { recursive: true });

  // Read package.json
  const pkg = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));

  // Create rollup config
  const rollupConfig = `
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
  // Browser UMD (for script tag)
  {
    input: 'src/browser/index.js',
    output: {
      file: 'dist/browser/zenux-oauth.umd.js',
      format: 'umd',
      name: 'ZenuxOAuth',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      terser()
    ],
    onwarn: (warning, warn) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  },

  // Browser ESM (for modern bundlers)
  {
    input: 'src/browser/index.js',
    output: {
      file: 'dist/browser/zenux-oauth.esm.js',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ browser: true }),
      commonjs()
    ],
    onwarn: (warning, warn) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  },

  // Server CommonJS
  {
    input: 'src/server/index.js',
    output: {
      file: 'dist/server/index.cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs()
    ],
    external: ['node-fetch', 'undici', 'crypto']
  },

  // Server ESM
  {
    input: 'src/server/index.js',
    output: {
      file: 'dist/server/index.mjs',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs()
    ],
    external: ['node-fetch', 'undici', 'crypto']
  },

  // Core CommonJS
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/core/index.cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },

  // Core ESM
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/core/index.mjs',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  }
];
`;

  await fs.writeFile(path.join(__dirname, 'rollup.config.mjs'), rollupConfig);

  // Generate TypeScript definitions
  const typeDefs = `declare module 'zenuxs-oauth' {
  export interface OAuthConfig {
    clientId: string;
    authServer: string;
    redirectUri?: string;
    scopes?: string;
    usePKCE?: boolean;
    extraAuthParams?: Record<string, string>;
    extraTokenParams?: Record<string, string>;
  }

  export interface BrowserOAuthConfig extends OAuthConfig {
    storage?: 'localStorage' | 'sessionStorage' | 'memory';
    storagePrefix?: string;
    autoRefresh?: boolean;
    refreshThreshold?: number;
    popupWidth?: number;
    popupHeight?: number;
    debug?: boolean;
    fetch?: typeof fetch;
  }

  export interface ServerOAuthConfig extends OAuthConfig {
    fetch?: typeof fetch;
  }

  export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    expires_at?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  }

  export class OAuthError extends Error {
    code: string;
    details: any;
    timestamp: string;
    toJSON(): any;
  }

  export class OAuthClient {
    constructor(config: OAuthConfig);
    getAuthorizationUrl(options?: any): Promise<{
      url: string;
      state: string;
      nonce: string;
      codeVerifier?: string;
    }>;
  }

  export class BrowserOAuthClient extends OAuthClient {
    constructor(config: BrowserOAuthConfig);
    login(options?: any): Promise<any>;
    handleCallback(options?: any): Promise<TokenResponse>;
    getTokens(): TokenResponse | null;
    isAuthenticated(): boolean;
    refreshTokens(): Promise<TokenResponse>;
    getUserInfo(): Promise<any>;
    logout(options?: any): Promise<boolean>;
    getAuthenticatedFetch(): (url: string, options?: any) => Promise<Response>;
    destroy(): void;
  }

  export class ServerOAuthClient extends OAuthClient {
    constructor(config: ServerOAuthConfig);
    exchangeCodeForTokens(code: string, codeVerifier?: string, options?: any): Promise<TokenResponse>;
    refreshToken(refreshToken: string, options?: any): Promise<TokenResponse>;
    revokeToken(token: string, tokenTypeHint?: string, options?: any): Promise<boolean>;
    getUserInfo(accessToken: string, options?: any): Promise<any>;
    verifyToken(accessToken: string, options?: any): Promise<any>;
    parseToken(accessToken: string, options?: any): Promise<any>;
  }

  // Utility functions
  export function generateRandomString(length?: number): string;
  export function generatePKCEChallenge(): Promise<{ codeVerifier: string; codeChallenge: string }>;
  export function buildAuthorizationUrl(options: any): string;
  export function parseCallbackUrl(url: string): any;
  export function parseTokenResponse(response: any): TokenResponse;
  export function isTokenExpired(tokens: TokenResponse, threshold?: number): boolean;
  export function decodeJWT(token: string): any;
  export function validateTokenStructure(tokens: any): { valid: boolean; error?: string };

  // Browser-specific exports
  export function createOAuthClient(config: BrowserOAuthConfig): Promise<BrowserOAuthClient>;
  export function login(config: BrowserOAuthConfig, options?: any): Promise<any>;
  export function handleCallback(config: BrowserOAuthConfig, options?: any): Promise<TokenResponse>;

  export default OAuthClient;
}

declare module 'zenuxs-oauth/server' {
  export interface ServerOAuthConfig {
    clientId: string;
    authServer: string;
    redirectUri: string;
    scopes?: string;
    usePKCE?: boolean;
    extraAuthParams?: Record<string, string>;
    extraTokenParams?: Record<string, string>;
    fetch?: typeof fetch;
  }

  export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    expires_at?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  }

  export class OAuthError extends Error {
    code: string;
    details: any;
    timestamp: string;
    toJSON(): any;
  }

  export class ServerOAuthClient {
    constructor(config: ServerOAuthConfig);
    exchangeCodeForTokens(code: string, codeVerifier?: string, options?: any): Promise<TokenResponse>;
    refreshToken(refreshToken: string, options?: any): Promise<TokenResponse>;
    revokeToken(token: string, tokenTypeHint?: string, options?: any): Promise<boolean>;
    getUserInfo(accessToken: string, options?: any): Promise<any>;
    verifyToken(accessToken: string, options?: any): Promise<any>;
    parseToken(accessToken: string, options?: any): Promise<any>;
    getAuthorizationUrl(options?: any): Promise<{
      url: string;
      state: string;
      nonce: string;
      codeVerifier?: string;
    }>;
  }

  // Server-specific utility functions
  export function getTokenFromCode(code: string, config: ServerOAuthConfig, options?: any): Promise<TokenResponse>;
  export function refreshToken(refreshToken: string, config: ServerOAuthConfig, options?: any): Promise<TokenResponse>;
  export function getUserByToken(accessToken: string, config: ServerOAuthConfig, options?: any): Promise<any>;
  export function verifyToken(accessToken: string, config: ServerOAuthConfig, options?: any): Promise<any>;
  export function revokeToken(accessToken: string, config: ServerOAuthConfig, options?: any): Promise<boolean>;
  export function parseToken(accessToken: string, config: ServerOAuthConfig, options?: any): Promise<any>;

  // Common utilities
  export function generateRandomString(length?: number): string;
  export function generatePKCEChallenge(): Promise<{ codeVerifier: string; codeChallenge: string }>;
  export function buildAuthorizationUrl(options: any): string;
  export function parseTokenResponse(response: any): TokenResponse;
  export function isTokenExpired(tokens: TokenResponse, threshold?: number): boolean;
  export function decodeJWT(token: string): any;

  export function createOAuthClient(config: ServerOAuthConfig): Promise<ServerOAuthClient>;

  export default ServerOAuthClient;
}

declare module 'zenuxs-oauth/callback' {
  // This is an HTML file for OAuth callbacks
  const html: string;
  export default html;
}
`;

  await fs.writeFile(path.join(distDir, 'index.d.ts'), typeDefs);

  // Copy callback.html
  await fs.copyFile(
    path.join(__dirname, 'callback.html'),
    path.join(distDir, 'browser', 'callback.html')
  );

  // Create package.json for dist
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    author: pkg.author,
    exports: {
      ".": {
        "types": "./index.d.ts",
        "browser": {
          "import": "./browser/zenux-oauth.esm.js",
          "require": "./browser/zenux-oauth.umd.js"
        },
        "node": {
          "import": "./server/index.mjs",
          "require": "./server/index.cjs"
        },
        "default": "./browser/zenux-oauth.umd.js"
      },
      "./server": {
        "types": "./index.d.ts",
        "node": {
          "import": "./server/index.mjs",
          "require": "./server/index.cjs"
        },
        "default": "./server/index.cjs"
      },
      "./core": {
        "types": "./index.d.ts",
        "import": "./core/index.mjs",
        "require": "./core/index.cjs",
        "default": "./core/index.cjs"
      },
      "./browser": {
        "types": "./index.d.ts",
        "browser": {
          "import": "./browser/zenux-oauth.esm.js",
          "require": "./browser/zenux-oauth.umd.js"
        },
        "default": "./browser/zenux-oauth.umd.js"
      },
      "./callback": {
        "browser": "./browser/callback.html",
        "default": "./browser/callback.html"
      }
    },
    main: "./browser/zenux-oauth.umd.js",
    module: "./browser/zenux-oauth.esm.js",
    browser: "./browser/zenux-oauth.umd.js",
    types: "./index.d.ts",
    files: [
      "*.d.ts",
      "browser/",
      "server/",
      "core/"
    ],
    sideEffects: false
  };

  await fs.writeFile(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );

  console.log('✓ Build configuration generated');
  console.log('✓ TypeScript definitions created');
  console.log('✓ Dist directory structure prepared');
  console.log('\nRun: npm run build:rollup');
}

build().catch(console.error);