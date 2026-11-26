import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/http';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
const login = jest.fn<(email: string, password: string) => Promise<void>>();
const register = jest.fn<(name: string, email: string, password: string) => Promise<void>>();
beforeEach(() => {
  login.mockReset(); register.mockReset();
  jest.mocked(useAuth).mockReturnValue({ login, register, status: 'anonymous', user: null, logout: async () => {} });
});
function show(page: React.ReactElement) {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/" element={page} /><Route path="/spaces" element={<p>Catálogo</p>} /></Routes></MemoryRouter>);
}
function fill(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
describe('Authentication forms', () => {
  it('logs in and navigates to the catalogue', async () => {
    login.mockResolvedValue(); show(<LoginPage />);
    fill('Correo', 'ana@udea.edu.co'); fill('Contraseña', 'password123');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Catálogo')).toBeTruthy();
    expect(login).toHaveBeenCalledWith('ana@udea.edu.co', 'password123');
  });
  it('displays rejected credentials and allows another attempt', async () => {
    login.mockRejectedValue(new ApiError(401, 'Unauthorized')); show(<LoginPage />);
    fill('Correo', 'ana@udea.edu.co'); fill('Contraseña', 'wrong123');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Correo o contraseña incorrectos');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Ingresar' }) as HTMLButtonElement).disabled).toBe(false));
  });
  it.each([
    ['A', 'ana@udea.edu.co', 'password123', 'nombre'],
    ['Ana', 'ana@gmail.com', 'password123', 'institucionales'],
    ['Ana', 'ana@udea.edu.co', 'abcdefgh', 'letras y números'],
  ])('validates registration %s %s %s', (name, email, password, message) => {
    show(<RegisterPage />); fill('Nombre', name); fill('Correo institucional', email); fill('Contraseña', password);
    fireEvent.submit(screen.getByRole('button', { name: 'Registrarme' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(register).not.toHaveBeenCalled();
  });
  it.each([true, false])('handles registration success=%s', async (success) => {
    if (success) register.mockResolvedValue(); else register.mockRejectedValue(new ApiError(409, 'already registered'));
    show(<RegisterPage />); fill('Nombre', ' Ana '); fill('Correo institucional', 'ana@udea.edu.co'); fill('Contraseña', 'password123');
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));
    if (success) expect(await screen.findByText('Catálogo')).toBeTruthy();
    else expect((await screen.findByRole('alert')).textContent).toContain('ya está registrado');
    expect(register).toHaveBeenCalledWith('Ana', 'ana@udea.edu.co', 'password123');
  });
});
