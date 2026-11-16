import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  STUDENT_PASSWORD,
  loginAs,
  logout,
  registerStudent,
  uniqueEmail,
} from './helpers';

test.describe('Gherkin autenticacion.feature', () => {
  test('HU-05 visitante no autenticado no ve el catálogo', async ({ page }) => {
    await page.goto('/spaces');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('HU-01 registro rechazado por dominio no institucional', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Visitante Gmail');
    await page.getByLabel('Correo institucional').fill('persona@gmail.com');
    await page.getByLabel('Contraseña').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.getByRole('alert')).toContainText('@udea.edu.co');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  });

  test('HU-02 credenciales incorrectas no revelan si el correo existe', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo', { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel('Contraseña').fill('incorrecta1');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    if (/Demasiados intentos/i.test((await alert.textContent()) ?? '')) {
      await page.waitForTimeout(65_000);
      await page.getByLabel('Contraseña').fill('incorrecta1');
      await page.getByRole('button', { name: 'Ingresar' }).click();
    }
    await expect(alert).toContainText(/incorrectos|revisa/i);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('HU-01 y HU-02 registro e inicio de sesión de estudiante', async ({ page }) => {
    const { email } = await registerStudent(page);
    await expect(page.getByRole('link', { name: 'Espacios' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Administración' })).toHaveCount(0);

    await logout(page);
    await loginAs(page, email, STUDENT_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Espacios deportivos' })).toBeVisible();
  });

  test('HU-03 cierre de sesión', async ({ page }) => {
    await registerStudent(page, uniqueEmail('logout'));
    await logout(page);
    await page.goto('/spaces');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('HU-04 el estudiante no ve acciones de staff', async ({ page }) => {
    await registerStudent(page, uniqueEmail('nostaff'));
    await expect(page.getByRole('link', { name: 'Administración' })).toHaveCount(0);
    await page.goto('/admin/inbox');
    await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
    await expect(page.getByText(/No tienes permiso/)).toBeVisible();
  });

  test('HU-02 admin inicia sesión y ve administración', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole('link', { name: 'Administración' })).toBeVisible();
  });
});
