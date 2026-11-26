import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiPatch } from '../api/http';
import { useApiResource } from '../hooks/useApiResource';
import { AdminRolesPage } from './AdminRolesPage';
jest.mock('../hooks/useApiResource', () => ({ useApiResource: jest.fn() }));
jest.mock('../api/http', () => ({ ...jest.requireActual<object>('../api/http'), apiPatch: jest.fn() }));
const resource = jest.mocked(useApiResource);
const patch = jest.mocked(apiPatch);
const user = { id: '1', name: 'Ana', email: 'ana@udea.edu.co', role: 'STUDENT' };
beforeEach(() => { resource.mockReset(); patch.mockReset(); });
describe('Role management', () => {
  it('announces loading', () => {
    resource.mockReturnValue({ status: 'loading' }); render(<AdminRolesPage />);
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });
  it.each([403, 500])('explains errors with status %s', (httpStatus) => {
    resource.mockReturnValue({ status: 'error', message: 'Servidor inaccesible', httpStatus }); render(<AdminRolesPage />);
    expect(screen.getByRole('alert').textContent).toContain(httpStatus === 403 ? 'Solo un administrador' : 'Servidor inaccesible');
  });
  it('shows an empty list', () => {
    resource.mockReturnValue({ status: 'empty' }); render(<AdminRolesPage />);
    expect(screen.getByText('Aún no hay usuarios registrados.')).toBeTruthy();
  });
  it('prevents demoting the last admin and saving unchanged roles', () => {
    resource.mockReturnValue({ status: 'success', data: [{ ...user, role: 'ADMIN' }] }); render(<AdminRolesPage />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Último administrador')).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
  });
  it.each([true, false])('updates role with server success=%s', async (success) => {
    resource.mockReturnValue({ status: 'success', data: [user] });
    if (success) patch.mockResolvedValue({}); else patch.mockRejectedValue(new Error('offline'));
    render(<AdminRolesPage />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'STAFF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));
    expect(patch).toHaveBeenCalledWith('/users/1', { role: 'STAFF' });
    if (success) {
      await waitFor(() => expect(resource).toHaveBeenCalledWith('/users', 1));
      expect(screen.getByRole('status').textContent).toContain('Ana ahora es');
    } else expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
