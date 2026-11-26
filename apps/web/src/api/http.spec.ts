import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, refreshAccessToken, setOnUnauthorized, ApiError } from './http';
import { clearSession, getAccessToken, setAccessToken, setStoredUser, getStoredUser } from '../auth/session';

const request = jest.fn<typeof fetch>();
function response(status: number, body: unknown = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}
beforeEach(() => {
  clearSession();
  request.mockReset();
  globalThis.fetch = request;
  setOnUnauthorized(null);
});
afterEach(() => { jest.restoreAllMocks(); });

describe('HTTP requests', () => {
  it('sends credentials and the stored access token', async () => {
    setAccessToken('token');
    request.mockResolvedValue(response(200, { id: 1 }));
    await expect(apiGet('/spaces')).resolves.toEqual({ id: 1 });
    expect(request).toHaveBeenCalledWith('/api/spaces', expect.objectContaining({
      method: 'GET', credentials: 'include', headers: { Accept: 'application/json', Authorization: 'Bearer token' },
    }));
  });
  it.each([apiPost, apiPut, apiPatch])('serializes JSON request bodies', async (send) => {
    request.mockResolvedValue(response(200));
    await send('/spaces', { name: 'Cancha' });
    expect(request).toHaveBeenCalledWith('/api/spaces', expect.objectContaining({
      body: '{"name":"Cancha"}', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }));
  });
  it('handles a DELETE with no response body', async () => {
    request.mockResolvedValue(response(204));
    await expect(apiDelete('/spaces/1')).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/api/spaces/1', expect.objectContaining({ method: 'DELETE' }));
  });
  it('refreshes an expired token and retries the protected request', async () => {
    setAccessToken('expired');
    request.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(response(200, ['space']));
    await expect(apiGet('/spaces')).resolves.toEqual(['space']);
    expect(request).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('new');
    expect(request.mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer new' });
  });
  it('shares one refresh across concurrent calls', async () => {
    request.mockResolvedValue(response(200, { accessToken: 'new' }));
    await expect(Promise.all([refreshAccessToken(), refreshAccessToken()])).resolves.toEqual(['new', 'new']);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('clears the session and notifies when refresh is refused', async () => {
    const listener = jest.fn();
    setOnUnauthorized(listener);
    setAccessToken('expired');
    setStoredUser({ id: '1', name: 'Ana', email: 'ana@udea.edu.co', role: 'STUDENT' });
    request.mockResolvedValue(response(401));
    await expect(apiGet('/spaces')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
  it('limits retry to once even when the replacement token is rejected', async () => {
    request.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'bad' }))
      .mockResolvedValueOnce(response(401));
    await expect(apiGet('/spaces')).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it.each(['/auth/login', '/auth/register', '/auth/refresh'])('does not refresh authentication endpoint %s', async (path) => {
    request.mockResolvedValue(response(401));
    await expect(apiPost(path)).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('propagates network failures', async () => {
    request.mockRejectedValue(new Error('offline'));
    await expect(apiGet('/spaces')).rejects.toThrow('offline');
    await expect(refreshAccessToken()).resolves.toBeNull();
  });
  it.each([
    [400, { message: 'Invalid input' }, 'Invalid input'],
    [400, { message: ['Invalid date', 'Missing space'] }, 'Invalid date Missing space'],
    [401, {}, 'Necesitas iniciar sesión para continuar.'],
    [403, {}, 'No tienes permiso para esta acción.'],
    [404, {}, 'No encontramos lo que buscabas.'],
    [500, { message: ' ' }, 'No se pudo completar la solicitud. Inténtalo de nuevo.'],
    [500, { message: [] }, 'No se pudo completar la solicitud. Inténtalo de nuevo.'],
  ])('reports useful error for status %s and body %j', async (status, body, message) => {
    request.mockResolvedValue(response(status, body));
    await expect(apiPost('/auth/login')).rejects.toMatchObject({ status, message });
  });
  it('handles a non-JSON error body', async () => {
    request.mockResolvedValue({ ...response(500), json: async () => { throw new Error('HTML response'); } });
    await expect(apiGet('/spaces')).rejects.toThrow('No se pudo completar');
  });
});
