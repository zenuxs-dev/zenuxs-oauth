import { OAuthError } from '../core/errors.js';
import { OAuthClient } from '../core/client.js';
import { decodeJWT } from '../core/tokens.js';
import { createFetchFunction } from './utils.js';

/**
 * Server-side OAuth flows
 */

export async function getTokenFromCode(code, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new OAuthClient(config);
  
  const tokenRequest = await client.exchangeCodeForTokens(
    code,
    options.codeVerifier,
    options
  );

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
  return OAuthClient.parseTokenResponse(tokenData);
}

export async function refreshToken(refreshToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new OAuthClient(config);
  
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
  return OAuthClient.parseTokenResponse(tokenData);
}

export async function getUserByToken(accessToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new OAuthClient(config);
  
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
  // First decode the JWT to check basic structure
  const decoded = decodeJWT(accessToken);
  if (!decoded) {
    throw new OAuthError('Invalid JWT format', 'INVALID_JWT');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    throw new OAuthError('Token expired', 'TOKEN_EXPIRED');
  }

  // If introspection endpoint is configured, use it
  if (config.introspectionEndpoint) {
    const fetchImpl = await createFetchFunction(config.fetch);
    
    const introspectUrl = new URL(
      config.introspectionEndpoint,
      config.authServer
    ).toString();

    const response = await fetchImpl(introspectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: config.clientId
      })
    });

    if (!response.ok) {
      throw new OAuthError('Token introspection failed', 'INTROSPECT_FAILED');
    }

    const introspection = await response.json();
    if (!introspection.active) {
      throw new OAuthError('Token is not active', 'TOKEN_INACTIVE');
    }

    return introspection;
  }

  return decoded;
}

export async function revokeToken(accessToken, config, options = {}) {
  const fetchImpl = await createFetchFunction(config.fetch);
  const client = new OAuthClient(config);
  
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

  // Validate required claims
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