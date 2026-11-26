import { describe, expect, it } from '@jest/globals';
import { ApiError } from './api/http';
import { isInstitutionalEmail, isValidPassword, toAuthErrorMessage } from './auth/messages';
import { toReservationErrorMessage } from './reservations/messages';
import { toRoleErrorMessage } from './users/messages';
import { toSpaceAdminErrorMessage, validateSpaceDraft } from './spaces/messages';

describe('Form validation and actionable errors', () => {
  it.each([['a@udea.edu.co', true], [' A@UDEA.EDU.CO ', true], ['a@udea.edu.co.evil.com', false], ['a@gmail.com', false]])('validates institutional email %s', (email, valid) => {
    expect(isInstitutionalEmail(email)).toBe(valid);
  });
  it.each([['abc12345', true], ['abc1234', false], ['abcdefgh', false], ['12345678', false]])('validates password policy %s', (password, valid) => { expect(isValidPassword(password)).toBe(valid); });
  it.each([
    [429, '', 'Demasiados intentos'], [400, 'udea.edu.co', 'institucionales'],
    [400, 'registration is limited', 'institucionales'], [409, 'already registered', 'ya está registrado'],
    [400, 'password', 'letras y números'], [400, 'letters and numbers', 'letras y números'],
    [401, '', 'incorrectos'], [400, '', 'Revisa los datos'], [500, '', 'No se pudo completar'],
  ])('translates authentication error %s %s', (status, message, expected) => { expect(toAuthErrorMessage(new ApiError(status, message))).toContain(expected); });
  it.each([
    [429, '', 'Demasiadas solicitudes'], [403, '', 'No tienes permiso'], [404, '', 'esa reserva'],
    [409, '', 'no está disponible'], [400, 'overlap', 'no está disponible'], [400, 'blocked', 'no está disponible'],
    [400, 'past', 'horario ya pasó'], [400, 'already started', 'horario ya pasó'],
    [400, 'operating hours', 'fuera de las franjas'], [400, 'align to', 'fuera de las franjas'],
    [400, 'single calendar day', 'un solo día'], [400, 'cannot cancel', 'ya no se puede cancelar'],
    [400, 'cannot transition', 'cambio de estado'], [400, 'rejection reason', 'al menos 3'],
    [400, '', 'Revisa el horario'], [500, '', 'No se pudo completar'],
  ])('translates reservation error %s %s', (status, message, expected) => { expect(toReservationErrorMessage(new ApiError(status, message))).toContain(expected); });
  it.each([[403, '', 'administrador'], [404, '', 'ese usuario'], [409, '', 'sin un administrador'], [500, 'last administrator', 'sin un administrador'], [400, '', 'Revisa el rol'], [500, '', 'conexión']])('translates role errors %s %s', (status, message, expected) => { expect(toRoleErrorMessage(new ApiError(status, message))).toContain(expected); });
  it.each([[403, '', 'personal autorizado'], [404, '', 'ese espacio'], [400, '', 'Revisa nombre'], [500, 'Error concreto', 'Error concreto'], [500, '', 'conexión']])('translates space errors %s %s', (status, message, expected) => { expect(toSpaceAdminErrorMessage(new ApiError(status, message))).toContain(expected); });
  it('handles network and unknown errors', () => {
    expect(toAuthErrorMessage(new Error())).toContain('No se pudo completar');
    for (const translate of [toRoleErrorMessage, toReservationErrorMessage, toSpaceAdminErrorMessage]) {
      expect(translate(new Error('offline'))).toContain('conexión');
    }
  });
  const draft = { name: 'Cancha', type: 'Pista', campus: 'Robledo', capacity: '20', usageRules: 'Usar tenis' };
  it.each([
    [{ name: ' ' }, 'nombre'], [{ type: '' }, 'tipo'], [{ campus: ' ' }, 'campus'],
    [{ capacity: '0' }, 'capacidad'], [{ capacity: '1.5' }, 'capacidad'], [{ capacity: 'NaN' }, 'capacidad'],
    [{ usageRules: ' ' }, 'reglas'], [{ imageUrl: 'javascript:alert(1)' }, 'foto'],
  ])('rejects invalid space draft %j', (change, message) => { expect(validateSpaceDraft({ ...draft, ...change })).toContain(message); });
  it.each([undefined, '', 'https://example.com/a.jpg', 'http://example.com/a.jpg', '/spaces/image.jpg'])('accepts valid space image %s', (imageUrl) => {
    expect(validateSpaceDraft({ ...draft, imageUrl })).toBeNull();
  });
});
