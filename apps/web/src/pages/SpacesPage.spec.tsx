import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { SpacesPage } from './SpacesPage';
jest.mock('../hooks/useApiResource', () => ({ useApiResource: jest.fn() }));
const resource = jest.mocked(useApiResource);
const space = { id: '1', name: 'Coliseo', type: 'coliseo', campus: 'Robledo', usageRules: 'Uso deportivo' };
function show(path = '/spaces') {
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SpacesPage /></MemoryRouter>);
}
beforeEach(() => { resource.mockReset(); });
describe('Spaces catalogue', () => {
  it('announces loading', () => {
    resource.mockReturnValue({ status: 'loading' });
    show();
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });
  it('shows server errors', () => {
    resource.mockReturnValue({ status: 'error', message: 'Servidor inaccesible' });
    show();
    expect(screen.getByRole('alert').textContent).toContain('Servidor inaccesible');
  });
  it.each(['/spaces', '/spaces?campus=Robledo'])('explains empty results for %s', (path) => {
    resource.mockReturnValue({ status: 'empty' });
    show(path);
    expect(screen.getByText(path.includes('?') ? 'No hay espacios que coincidan con esos filtros.' : 'Aún no hay espacios activos.')).toBeTruthy();
  });
  it('renders cards, photos and abbreviated descriptions and updates filters', () => {
    resource.mockReturnValue({ status: 'success', data: [space, { ...space, id: '2', name: 'Otro', type: 'otro', imageUrl: null, usageRules: 'Reglas '.repeat(40) }] });
    show();
    expect(screen.getByRole('img', { name: 'Coliseo' }).getAttribute('src')).toContain('coliseo');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Campus'), { target: { value: 'Robledo' } });
    expect(resource).toHaveBeenCalledWith('/spaces?campus=Robledo');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'coliseo' } });
    expect(resource).toHaveBeenCalledWith('/spaces?campus=Robledo&type=coliseo');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.queryByText('Quitar filtros')).toBeNull();
  });
  it.each(['loading', 'error'] as const)('keeps catalogue filters visible while filtered results are %s', (status) => {
    resource.mockImplementation((path) => path === '/spaces' ? { status: 'success', data: [space] as never } : status === 'loading' ? { status } : { status, message: 'Filtro falló' });
    show('/spaces?campus=Robledo');
    expect(screen.getByLabelText('Campus')).toBeTruthy();
    expect(screen.getByText(status === 'loading' ? 'Actualizando el catálogo…' : 'Filtro falló')).toBeTruthy();
  });
});
