import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGet, ApiError } from '../api/http';
import { useApiResource } from './useApiResource';
jest.mock('../api/http', () => ({ ...jest.requireActual<object>('../api/http'), apiGet: jest.fn() }));
const get = jest.mocked(apiGet);
beforeEach(() => { get.mockReset(); });

describe('useApiResource', () => {
  it('starts loading and returns data', async () => {
    get.mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useApiResource('/spaces'));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'success', data: { id: 1 } }));
  });
  it('handles an empty list', async () => {
    get.mockResolvedValue([]);
    const { result } = renderHook(() => useApiResource('/spaces'));
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });
  it.each([new ApiError(403, 'Forbidden'), new Error('offline')])('reports API and connection errors', async (error) => {
    get.mockRejectedValue(error);
    const { result } = renderHook(() => useApiResource('/spaces'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject(error instanceof ApiError ? { message: 'Forbidden', httpStatus: 403 } : { message: expect.stringContaining('conexión') });
  });
  it('rejects an empty path without requesting data', () => {
    const { result } = renderHook(() => useApiResource(''));
    expect(result.current).toMatchObject({ status: 'error', httpStatus: 404 });
    expect(get).not.toHaveBeenCalled();
  });
  it('refetches on refresh and ignores stale responses and errors', async () => {
    let resolveOld!: (value: unknown) => void;
    let rejectOld!: (reason: Error) => void;
    get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = (value) => resolve(value as never); }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
      .mockResolvedValue({ id: 'current' });
    const { result, rerender } = renderHook(({ key }) => useApiResource('/spaces', key), { initialProps: { key: 0 } });
    rerender({ key: 1 });
    rerender({ key: 2 });
    await waitFor(() => expect(result.current).toEqual({ status: 'success', data: { id: 'current' } }));
    await act(async () => { resolveOld([]); rejectOld(new Error('stale')); });
    expect(result.current).toEqual({ status: 'success', data: { id: 'current' } });
    expect(get).toHaveBeenCalledTimes(3);
  });
});
