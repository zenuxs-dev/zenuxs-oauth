export function parseTokenResponse(response) {
  const tokens = { ...response };
  
  if (tokens.expires_in) {
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
  }
  
  return tokens;
}

export function isTokenExpired(tokens, threshold = 0) {
  if (!tokens || !tokens.access_token) return true;
  if (!tokens.expires_at) return false;
  
  return Date.now() >= (tokens.expires_at - (threshold * 1000));
}

export function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Pure JavaScript decoding - no Buffer/atob dependency
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export function validateTokenStructure(tokens) {
  if (!tokens || typeof tokens !== 'object') {
    return { valid: false, error: 'Tokens must be an object' };
  }
  
  if (!tokens.access_token) {
    return { valid: false, error: 'Missing access_token' };
  }
  
  if (tokens.expires_at && typeof tokens.expires_at !== 'number') {
    return { valid: false, error: 'expires_at must be a number' };
  }
  
  if (tokens.expires_in && typeof tokens.expires_in !== 'number') {
    return { valid: false, error: 'expires_in must be a number' };
  }
  
  return { valid: true };
}