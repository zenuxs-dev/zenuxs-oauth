/**
 * Main entry point that auto-detects environment
 * Exports appropriate client based on environment
 */

import { OAuthClient as CoreOAuthClient } from './core/client.js';
export { OAuthError, InvalidConfigError, TokenError, NetworkError } from './core/errors.js';
export { generateRandomString, generatePKCEChallenge } from './core/pkce.js';
export { buildAuthorizationUrl, parseCallbackUrl } from './core/urls.js';
export { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from './core/tokens.js';

// Detect environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

let OAuthClient = CoreOAuthClient;

if (isBrowser) {
  import('./browser/client.js').then(module => {
    OAuthClient = module.default || module.OAuthClient;
  }).catch(() => {
    console.warn('Failed to load browser module, using core OAuth client');
  });
} else if (isNode) {
  import('./server/client.js').then(module => {
    OAuthClient = module.default || module.OAuthClient;
  }).catch(() => {
    console.warn('Failed to load server module, using core OAuth client');
  });
}

export { OAuthClient };
export default OAuthClient;

export async function createOAuthClient(config) {
  if (isBrowser) {
    const { BrowserOAuthClient } = await import('./browser/client.js');
    return new BrowserOAuthClient(config);
  } else if (isNode) {
    const { ServerOAuthClient } = await import('./server/client.js');
    return new ServerOAuthClient(config);
  }
  
  // Fallback to core client
  return new CoreOAuthClient(config);
}

// Export browser-specific helpers conditionally
export async function login(config, options = {}) {
  if (!isBrowser) {
    throw new Error('login() is only available in browser environments');
  }
  
  const { BrowserOAuthClient } = await import('./browser/client.js');
  const client = new BrowserOAuthClient(config);
  return client.login(options);
}

export async function handleCallback(config, options = {}) {
  if (!isBrowser) {
    throw new Error('handleCallback() is only available in browser environments');
  }
  
  const { BrowserOAuthClient } = await import('./browser/client.js');
  const client = new BrowserOAuthClient(config);
  return client.handleCallback(options);
}