export class OAuthError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export class InvalidConfigError extends OAuthError {
  constructor(message, details = {}) {
    super(message, 'INVALID_CONFIG', details);
    this.name = 'InvalidConfigError';
  }
}

export class TokenError extends OAuthError {
  constructor(message, details = {}) {
    super(message, 'TOKEN_ERROR', details);
    this.name = 'TokenError';
  }
}

export class NetworkError extends OAuthError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}