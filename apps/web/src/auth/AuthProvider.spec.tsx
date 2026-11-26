import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
import { apiGet, apiPost, refreshAccessToken, setOnUnauthorized } from '../api/http';
import { clearSession, setAccessToken, setStoredUser, getStoredUser, getAccessToken } from './session';
jest.mock('../api/http', () => ({ apiGet: jest.fn(), apiPost: jest.fn(), refreshAccessToken: jest.fn(), setOnUnauthorized: jest.fn() }));
const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);
const refresh = jest.mocked(refreshAccessToken);
const user = { id: '1', email: 'ana@udea.edu.co', name: 'Ana', role: 'STUDENT' as const };
function mount() { return renderHook(() => useAuth(), { wrapper: AuthProvider }); }
beforeEach(() => { jest.clearAllMocks(); clearSession(); refresh.mockResolvedValue(null); });

describe('AuthProvider', () => {
  it('requires its provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow('within AuthProvider');
    consoleError.mockRestore();
  });
  it('becomes anonymous when refresh cannot restore a token', async () => {
    const { result } = mount();
    expect(result.current.status).toBe('bootstrapping');
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });
  it.each([true, false])('restores a profile with stored name=%s', async (stored) => {
    setAccessToken('token');
    if (stored) setStoredUser(user);
    get.mockResolvedValue({ user: { sub: user.id, email: user.email, role: user.role } });
    const { result, unmount } = mount();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.name).toBe(stored ? 'Ana' : user.email);
    expect(getStoredUser()).toEqual(result.current.user);
    unmount();
    expect(setOnUnauthorized).toHaveBeenLastCalledWith(null);
  });
  it('clears an invalid restored session', async () => {
    setAccessToken('bad'); get.mockRejectedValue(new Error('invalid profile'));
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(getAccessToken()).toBeNull();
  });
  it('logs in, stores identity and responds to an unauthorized event', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    post.mockResolvedValue({ accessToken: 'new', user });
    await act(async () => { await result.current.login(user.email, 'pass1234'); });
    expect(post).toHaveBeenCalledWith('/auth/login', { email: user.email, password: 'pass1234' });
    expect(result.current.user).toEqual(user);
    expect(getAccessToken()).toBe('new');
    const listener = jest.mocked(setOnUnauthorized).mock.calls[0][0];
    act(() => listener?.());
    expect(result.current.status).toBe('anonymous');
  });
  it('registers then logs in', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    post.mockResolvedValueOnce({}).mockResolvedValueOnce({ accessToken: 'new', user });
    await act(async () => { await result.current.register(user.name, user.email, 'pass1234'); });
    expect(post).toHaveBeenNthCalledWith(1, '/auth/register', { name: user.name, email: user.email, password: 'pass1234' });
    expect(result.current.status).toBe('authenticated');
  });
  it.each([true, false])('logs out locally when server success=%s', async (success) => {
    setAccessToken('token'); get.mockResolvedValue({ user: { sub: user.id, email: user.email, role: user.role } });
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    if (success) post.mockResolvedValue({}); else post.mockRejectedValue(new Error('offline'));
    await act(async () => { await result.current.logout(); });
    expect(result.current.status).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});
