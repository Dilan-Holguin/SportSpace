import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { RequireAuth, GuestOnly, RequireStaff } from './route-guards';
jest.mock('./AuthProvider', () => ({ useAuth: jest.fn() }));
const auth = jest.mocked(useAuth);
beforeEach(() => { auth.mockReset(); });
function Destination() {
  const location = useLocation();
  return <p>{location.pathname} {location.state?.from}</p>;
}
function show(guard: React.ReactElement) {
  render(<MemoryRouter initialEntries={['/private']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route element={guard}><Route path="/private" element={<p>Protected content</p>} /></Route>
      <Route path="/login" element={<Destination />} /><Route path="/spaces" element={<Destination />} /></Routes>
  </MemoryRouter>);
}
describe('Route permissions', () => {
  it.each([RequireAuth, GuestOnly])('shows loading while restoring session', (Guard) => {
    auth.mockReturnValue({ status: 'bootstrapping' } as ReturnType<typeof useAuth>);
    show(<Guard />);
    expect(screen.getByRole('status').textContent).toContain('Restaurando');
  });
  it('redirects anonymous users to login with the original destination', () => {
    auth.mockReturnValue({ status: 'anonymous' } as ReturnType<typeof useAuth>);
    show(<RequireAuth />);
    expect(screen.getByText('/login /private')).toBeTruthy();
  });
  it('allows authenticated users', () => {
    auth.mockReturnValue({ status: 'authenticated' } as ReturnType<typeof useAuth>);
    show(<RequireAuth />);
    expect(screen.getByText('Protected content')).toBeTruthy();
  });
  it('redirects authenticated guests to spaces', () => {
    auth.mockReturnValue({ status: 'authenticated' } as ReturnType<typeof useAuth>);
    show(<GuestOnly />);
    expect(screen.getByText('/spaces')).toBeTruthy();
  });
  it('allows anonymous guests', () => {
    auth.mockReturnValue({ status: 'anonymous' } as ReturnType<typeof useAuth>);
    show(<GuestOnly />);
    expect(screen.getByText('Protected content')).toBeTruthy();
  });
  it.each(['ADMIN', 'STAFF', 'STUDENT', null])('enforces staff access for %s', (role) => {
    auth.mockReturnValue({ user: role ? { role } : null } as ReturnType<typeof useAuth>);
    show(<RequireStaff />);
    if (role === 'ADMIN' || role === 'STAFF') expect(screen.getByText('Protected content')).toBeTruthy();
    else expect(screen.getByRole('alert').textContent).toContain('No tienes permiso');
  });
});
