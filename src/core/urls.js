export function buildAuthorizationUrl({
  authServer,
  authorizeEndpoint = '/oauth/authorize',
  clientId,
  redirectUri,
  scopes = 'openid profile email',
  state,
  codeChallenge,
  nonce,
  responseType = 'code',
  extraParams = {}
}) {
  const url = new URL(authorizeEndpoint, authServer);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope: scopes,
    ...extraParams
  });

  if (state) params.append('state', state);
  if (nonce) params.append('nonce', nonce);
  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }

  url.search = params.toString();
  return url.toString();
}

export function parseCallbackUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    return {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
      rawParams: Object.fromEntries(params.entries())
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

export function buildUserInfoUrl({
  authServer,
  userInfoEndpoint = '/oauth/userinfo'
}) {
  const url = new URL(userInfoEndpoint, authServer);
  return url.toString();
}

export function buildTokenUrl({
  authServer,
  tokenEndpoint = '/oauth/token'
}) {
  const url = new URL(tokenEndpoint, authServer);
  return url.toString();
}
