import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { clearSession, getAccessToken, setAccessToken, getStoredUser, setStoredUser, writeStorage } from './session';

beforeEach(() => { sessionStorage.clear(); clearSession(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('Session storage', () => {
  it('round trips a token and a user with Unicode characters', () => {
    const user = { id: '1', name: 'María', email: 'maria@udea.edu.co', role: 'STUDENT' as const };
    setAccessToken('token-ñ');
    setStoredUser(user);
    expect(getAccessToken()).toBe('token-ñ');
    expect(getStoredUser()).toEqual(user);
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
  it.each(['not base64!', btoa('{bad json'), btoa('{}'), btoa('null'), btoa('')])('rejects malformed stored user %s', (raw) => {
    sessionStorage.setItem('sportspace.user', raw);
    expect(getStoredUser()).toBeNull();
  });
  it('keeps an in-memory token when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    setAccessToken('memory');
    expect(getAccessToken()).toBe('memory');
    expect(getStoredUser()).toBeNull();
  });
  it('tolerates storage removal failures', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => writeStorage('key', null)).not.toThrow();
  });
  it('keeps the current in-memory token on malformed stored token', () => {
    setAccessToken('known');
    sessionStorage.setItem('sportspace.accessToken', '%');
    expect(getAccessToken()).toBe('known');
  });
});
