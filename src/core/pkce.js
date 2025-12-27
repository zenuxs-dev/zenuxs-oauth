/**
 * Pure PKCE utilities with zero environment dependencies
 */

export function generateRandomString(length = 128) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  
  // Use crypto.getRandomValues if available (browser)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues, byte => charset[byte % charset.length]).join('');
  }
  
  // Fallback for Node.js without crypto.getRandomValues
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export async function sha256(plain) {
  // Handle both browser and Node.js environments
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser or Node.js 15+ with Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node.js with crypto module
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(plain).digest('base64');
    return hash
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  throw new Error('Crypto API not available in this environment');
}

export async function generatePKCEChallenge() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  return { codeVerifier, codeChallenge };
}