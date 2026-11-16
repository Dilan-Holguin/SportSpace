import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, logout, registerStudent, uniqueEmail } from './helpers';

test.describe('Gherkin espacios.feature', () => {
  test('HU-05 y HU-06 catálogo, foto, filtros y detalle', async ({ page }) => {
    await registerStudent(page, uniqueEmail('catalog'));
    await expect(page.getByRole('heading', { name: 'Espacios deportivos' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pista sintetica/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Coliseo Robledo/i })).toBeVisible();
    await expect(page.locator('.space-card__photo').first()).toBeVisible();

    await page.getByLabel('Campus').selectOption('Robledo');
    await expect(page.getByRole('link', { name: /Coliseo Robledo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pista sintetica/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await page.getByRole('link', { name: /Coliseo Robledo/i }).click();
    await expect(page.getByRole('heading', { name: 'Coliseo Robledo' })).toBeVisible();
    await expect(page.getByText('coliseo', { exact: true })).toBeVisible();
    await expect(page.getByText('Robledo', { exact: true })).toBeVisible();
    await expect(page.getByText(/personas/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reglas de uso' })).toBeVisible();
    await expect(page.locator('.space-detail__photo')).toBeVisible();
  });

  test('HU-06 detalle inexistente muestra mensaje claro', async ({ page }) => {
    await registerStudent(page, uniqueEmail('missing'));
    await page.goto('/spaces/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: /no encontrado/i })).toBeVisible();
  });

  test('HU-07 staff crea y desactiva un espacio', async ({ page }) => {
    const spaceName = `E2E Coliseo ${Date.now()}`;
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/spaces');
    await page.getByLabel('Nombre').first().fill(spaceName);
    await page.getByLabel('Tipo').first().fill('coliseo');
    await page.getByLabel('Campus').first().fill('Ciudad Universitaria');
    await page.getByLabel('Capacidad').first().fill('40');
    await page.getByLabel('Reglas de uso').first().fill('Solo para prueba E2E');
    await page.getByRole('button', { name: 'Crear espacio' }).click();
    const card = page.locator('.reservation-card').filter({ hasText: spaceName });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Desactivar' }).click();
    await expect(page.locator('.success-text')).toContainText(/inactivo/i);

    await logout(page);
    await registerStudent(page, uniqueEmail('noinactive'));
    await expect(page.getByRole('link', { name: new RegExp(spaceName) })).toHaveCount(0);
  });
});
