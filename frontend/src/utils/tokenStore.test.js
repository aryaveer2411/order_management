import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccessToken,
  setTokens,
  clearTokens,
  decodeJWT,
  isTokenExpired,
} from './tokenStore';
import { makeJWT, VALID_TOKEN, EXPIRED_TOKEN } from '../test/helpers';

beforeEach(() => {
  clearTokens();
});

describe('setTokens / getAccessToken / clearTokens', () => {
  it('returns null before any token is set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and retrieves an access token', () => {
    setTokens('my-token');
    expect(getAccessToken()).toBe('my-token');
  });

  it('clearTokens resets the stored token to null', () => {
    setTokens('my-token');
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });

  it('overwrites the previous token on subsequent setTokens calls', () => {
    setTokens('first');
    setTokens('second');
    expect(getAccessToken()).toBe('second');
  });
});

describe('decodeJWT', () => {
  it('decodes a valid JWT and returns its payload', () => {
    const payload = decodeJWT(VALID_TOKEN);
    expect(payload).toMatchObject({ sub: 'testuser', exp: 9999999999 });
  });

  it('returns null for a malformed token', () => {
    expect(decodeJWT('not.a.jwt')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJWT('')).toBeNull();
  });

  it('returns null when only one segment is present', () => {
    expect(decodeJWT('onlyone')).toBeNull();
  });

  it('decodes a token with arbitrary claims', () => {
    const token = makeJWT({ sub: 'alice', role: 'admin', exp: 9999999999 });
    const payload = decodeJWT(token);
    expect(payload.sub).toBe('alice');
    expect(payload.role).toBe('admin');
  });
});

describe('isTokenExpired', () => {
  it('returns false for a token with a future expiry', () => {
    expect(isTokenExpired(VALID_TOKEN)).toBe(false);
  });

  it('returns true for a token with a past expiry', () => {
    expect(isTokenExpired(EXPIRED_TOKEN)).toBe(true);
  });

  it('returns true when the token has no exp claim', () => {
    const token = makeJWT({ sub: 'testuser' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('bad-token')).toBe(true);
  });
});
