declare interface ZenuxOAuthConfig {
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
export { ZenuxOAuth, ZenuxOAuthError, ZenuxOAuthConfig, TokenResponse, UserInfo };