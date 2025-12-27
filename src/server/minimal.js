// Minimal server build with everything bundled
import { OAuthClient as CoreOAuthClient } from '../core/client.js';
import { OAuthError, InvalidConfigError, TokenError, NetworkError } from '../core/errors.js';
import { generateRandomString, generatePKCEChallenge, sha256 } from '../core/pkce.js';
import { buildAuthorizationUrl, parseCallbackUrl } from '../core/urls.js';
import { parseTokenResponse, isTokenExpired, decodeJWT, validateTokenStructure } from '../core/tokens.js';
import { createFetchFunction } from './utils.js';

// Re-export core
export {
  CoreOAuthClient as OAuthClient,
  OAuthError,
  InvalidConfigError,
  TokenError,
  NetworkError,
  generateRandomString,
  generatePKCEChallenge,
  buildAuthorizationUrl,
  parseCallbackUrl,
  parseTokenResponse,
  isTokenExpired,
  decodeJWT,
  validateTokenStructure
};

// Server client
export class ServerOAuthClient extends CoreOAuthClient {
  constructor(config = {}) {
    super(config);
    this.serverConfig = config;
  }

  async getFetch() {
    return await createFetchFunction(this.serverConfig.fetch);
  }

  async exchangeCodeForTokens(code, codeVerifier, options = {}) {
    const fetchImpl = await this.getFetch();
    const tokenRequest = await super.exchangeCodeForTokens(code, codeVerifier, options);
    
    const response = await fetchImpl(tokenRequest.url, {
      method: tokenRequest.method,
      headers: tokenRequest.headers,
      body: tokenRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token exchange failed: ${response.status}`,
        'TOKEN_EXCHANGE_FAILED',
        { status: response.status, response: errorText }
      );
    }

    const tokenData = await response.json();
    return parseTokenResponse(tokenData);
  }

  async refreshToken(refreshToken, options = {}) {
    const fetchImpl = await this.getFetch();
    const refreshRequest = await super.refreshToken(refreshToken, options);
    
    const response = await fetchImpl(refreshRequest.url, {
      method: refreshRequest.method,
      headers: refreshRequest.headers,
      body: refreshRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token refresh failed: ${response.status}`,
        'TOKEN_REFRESH_FAILED',
        { status: response.status, response: errorText }
      );
    }

    const tokenData = await response.json();
    return parseTokenResponse(tokenData);
  }

  async revokeToken(token, tokenTypeHint = 'access_token', options = {}) {
    const fetchImpl = await this.getFetch();
    const revokeRequest = await super.revokeToken(token, tokenTypeHint, options);
    
    const response = await fetchImpl(revokeRequest.url, {
      method: revokeRequest.method,
      headers: revokeRequest.headers,
      body: revokeRequest.body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `Token revocation failed: ${response.status}`,
        'REVOKE_FAILED',
        { status: response.status, response: errorText }
      );
    }

    return true;
  }

  async getUserInfo(accessToken, options = {}) {
    const fetchImpl = await this.getFetch();
    const userInfoRequest = await super.getUserInfoRequest(accessToken, options);
    
    const response = await fetchImpl(userInfoRequest.url, {
      method: userInfoRequest.method,
      headers: userInfoRequest.headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthError(
        `UserInfo request failed: ${response.status}`,
        'USERINFO_FAILED',
        { status: response.status, response: errorText }
      );
    }

    return response.json();
  }

  async verifyToken(accessToken, options = {}) {
    const decoded = decodeJWT(accessToken);
    if (!decoded) {
      throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new OAuthError('Token expired', 'TOKEN_EXPIRED');
    }

    return decoded;
  }

  async parseToken(accessToken, options = {}) {
    const decoded = decodeJWT(accessToken);
    if (!decoded) {
      throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
    }

    const requiredClaims = options.requiredClaims || ['sub', 'exp'];
    const missingClaims = requiredClaims.filter(claim => !decoded[claim]);
    
    if (missingClaims.length > 0) {
      throw new OAuthError(
        `Missing required claims: ${missingClaims.join(', ')}`,
        'MISSING_CLAIMS',
        { missingClaims }
      );
    }

    return decoded;
  }
}

export default ServerOAuthClient;

// Server flows
export async function getTokenFromCode(code, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new CoreOAuthClient(config);
  
  const tokenRequest = await client.exchangeCodeForTokens(code, options.codeVerifier, options);

  const response = await fetchImpl(tokenRequest.url, {
    method: tokenRequest.method,
    headers: tokenRequest.headers,
    body: tokenRequest.body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OAuthError(
      `Token exchange failed: ${response.status}`,
      'TOKEN_EXCHANGE_FAILED',
      { status: response.status, response: errorText }
    );
  }

  const tokenData = await response.json();
  return parseTokenResponse(tokenData);
}

export async function refreshToken(refreshToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new CoreOAuthClient(config);
  
  const refreshRequest = await client.refreshToken(refreshToken, options);

  const response = await fetchImpl(refreshRequest.url, {
    method: refreshRequest.method,
    headers: refreshRequest.headers,
    body: refreshRequest.body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OAuthError(
      `Token refresh failed: ${response.status}`,
      'TOKEN_REFRESH_FAILED',
      { status: response.status, response: errorText }
    );
  }

  const tokenData = await response.json();
  return parseTokenResponse(tokenData);
}

export async function getUserByToken(accessToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new CoreOAuthClient(config);
  
  const userInfoRequest = await client.getUserInfoRequest(accessToken, options);

  const response = await fetchImpl(userInfoRequest.url, {
    method: userInfoRequest.method,
    headers: userInfoRequest.headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OAuthError(
      `UserInfo request failed: ${response.status}`,
      'USERINFO_FAILED',
      { status: response.status, response: errorText }
    );
  }

  return response.json();
}

export async function verifyToken(accessToken, config, options = {}) {
  const decoded = decodeJWT(accessToken);
  if (!decoded) {
    throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    throw new OAuthError('Token expired', 'TOKEN_EXPIRED');
  }

  return decoded;
}

export async function revokeToken(accessToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new CoreOAuthClient(config);
  
  const revokeRequest = await client.revokeToken(
    accessToken,
    options.tokenTypeHint,
    options
  );

  const response = await fetchImpl(revokeRequest.url, {
    method: revokeRequest.method,
    headers: revokeRequest.headers,
    body: revokeRequest.body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OAuthError(
      `Token revocation failed: ${response.status}`,
      'REVOKE_FAILED',
      { status: response.status, response: errorText }
    );
  }

  return true;
}

export async function parseToken(accessToken, config, options = {}) {
  const decoded = decodeJWT(accessToken);
  if (!decoded) {
    throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
  }

  const requiredClaims = options.requiredClaims || ['sub', 'exp'];
  const missingClaims = requiredClaims.filter(claim => !decoded[claim]);
  
  if (missingClaims.length > 0) {
    throw new OAuthError(
      `Missing required claims: ${missingClaims.join(', ')}`,
      'MISSING_CLAIMS',
      { missingClaims }
    );
  }

  return decoded;
}

// Convenience
export async function createOAuthClient(config) {
  return new ServerOAuthClient(config);
}