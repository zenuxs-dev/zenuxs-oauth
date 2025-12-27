/**
 * Server utilities with no browser dependencies
 */

export function validateConfig(config) {
  const errors = [];
  
  if (!config.clientId) errors.push('clientId is required');
  if (!config.authServer) errors.push('authServer is required');
  if (!config.redirectUri) errors.push('redirectUri is required');
  
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join(', ')}`);
  }
  
  return config;
}

export async function createFetchFunction(fetchImpl) {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch !== 'undefined') return fetch;
  
  // Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // Try to use global fetch if available (Node.js 18+)
      if (globalThis.fetch) return globalThis.fetch;
      
      // Try to import node-fetch
      const { default: nodeFetch } = await import('node-fetch');
      return nodeFetch;
    } catch (error) {
      try {
        // Try to import undici fetch
        const { fetch: undiciFetch } = await import('undici');
        return undiciFetch;
      } catch {
        throw new Error('No fetch implementation available. Please provide fetchFunction or install node-fetch/undici');
      }
    }
  }
  
  throw new Error('No fetch implementation available');
}