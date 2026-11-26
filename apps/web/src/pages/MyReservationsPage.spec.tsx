import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiPost } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { useApiResource } from '../hooks/useApiResource';
import { MyReservationsPage } from './MyReservationsPage';
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useApiResource', () => ({ useApiResource: jest.fn() }));
jest.mock('../api/http', () => ({ ...jest.requireActual<object>('../api/http'), apiPost: jest.fn() }));
const resource = jest.mocked(useApiResource);
const post = jest.mocked(apiPost);
const reservation = { id: 'r1', userId: '1', spaceId: 's1', status: 'PENDING', startsAt: '2099-01-01T14:00:00Z', endsAt: '2099-01-01T15:00:00Z', space: { name: 'Cancha', type: 'pista', campus: 'Robledo' } };
function show() { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MyReservationsPage /></MemoryRouter>); }
beforeEach(() => {
  resource.mockReset(); post.mockReset();
  jest.mocked(useAuth).mockReturnValue({ user: { id: '1' } } as ReturnType<typeof useAuth>);
});
describe('My reservations', () => {
  it('shows loading and errors', () => {
    resource.mockReturnValue({ status: 'loading' }); show();
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });
  it('reports query failures', () => {
    resource.mockReturnValue({ status: 'error', message: 'No disponible' }); show();
    expect(screen.getByRole('alert').textContent).toContain('No disponible');
  });
  it.each(['empty', 'success'] as const)('shows empty state for %s including other users reservations', (status) => {
    resource.mockReturnValue(status === 'empty' ? { status } : { status, data: [{ ...reservation, userId: 'other' }] }); show();
    expect(screen.getByText(/Aún no tienes solicitudes/)).toBeTruthy();
  });
  it('requires confirmation, allows backing out and refreshes after cancellation', async () => {
    resource.mockReturnValue({ status: 'success', data: [reservation] }); post.mockResolvedValue({}); show();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(resource).toHaveBeenCalledWith('/reservations', 1));
    expect(post).toHaveBeenCalledWith('/reservations/r1/cancel');
  });
  it('reports cancellation failures and restores the confirmation button', async () => {
    resource.mockReturnValue({ status: 'success', data: [reservation] }); post.mockRejectedValue(new Error('offline')); show();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Sí, cancelar' }) as HTMLButtonElement).disabled).toBe(false));
  });
  it('hides cancellation for rejected and started reservations and shows the reason', () => {
    resource.mockReturnValue({ status: 'success', data: [{ ...reservation, status: 'REJECTED', reason: 'Mantenimiento' }, { ...reservation, id: 'past', startsAt: '2000-01-01T14:00:00Z' }] }); show();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.getByText('Motivo: Mantenimiento')).toBeTruthy();
  });
});
