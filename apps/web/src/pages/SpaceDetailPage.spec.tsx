import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { SpaceDetailPage } from './SpaceDetailPage';
jest.mock('../hooks/useApiResource', () => ({ useApiResource: jest.fn() }));
const resource = jest.mocked(useApiResource);
function show(path = '/spaces/1', route = '/spaces/:spaceId') {
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path={route} element={<SpaceDetailPage />} /></Routes></MemoryRouter>);
}
beforeEach(() => { resource.mockReset(); });
describe('Space detail', () => {
  it('shows loading', () => {
    resource.mockReturnValue({ status: 'loading' }); show();
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });
  it.each([400, 401, 404, 500])('explains status %s', (httpStatus) => {
    resource.mockReturnValue({ status: 'error', message: 'Servidor inaccesible', httpStatus }); show();
    expect(screen.getByRole('alert').textContent).toContain(httpStatus === 401 ? 'iniciar sesión' : httpStatus === 500 ? 'Servidor inaccesible' : 'no existe');
  });
  it('handles missing id', () => {
    resource.mockReturnValue({ status: 'loading' }); show('/spaces', '/spaces');
    expect(resource).toHaveBeenCalledWith('');
    expect(screen.getByRole('alert').textContent).toContain('no existe');
  });
  it('handles absent data', () => {
    resource.mockReturnValue({ status: 'empty' }); show();
    expect(screen.getByRole('alert').textContent).toContain('no existe');
  });
  it.each([true, false])('renders details for active=%s with optional image', (isActive) => {
    resource.mockReturnValue({ status: 'success', data: { id: '1', name: 'Espacio', type: isActive ? 'cancha' : 'otro', campus: 'Robledo', capacity: 20, usageRules: 'Usar tenis', isActive } }); show();
    expect(screen.getByText('20 personas')).toBeTruthy();
    expect(screen.getByText(isActive ? 'Activo' : 'Inactivo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver disponibilidad' }).getAttribute('href')).toBe('/spaces/1/availability');
    expect(Boolean(screen.queryByRole('img'))).toBe(isActive);
  });
});
