import type { PlatformRole } from './platform';
export interface LoginRequest { email: string; password: string }
export type RegisterRequest = LoginRequest;
export interface RegisteredUser { id: string; email: string }
export interface RefreshRequest { refreshToken: string }
export interface IssuedTokens { accessToken: string; refreshToken: string; accessTokenExpiresAt: string }
/** View model of backend-issued claims; no display name/email claim is currently issued. */
export interface CurrentUser { id: string; roles: PlatformRole[]; accessTokenExpiresAt: string }
