import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  STUDENT_PASSWORD,
  loginAs,
  logout,
  nextWeekdayIso,
  registerStudent,
  selectOptionContaining,
  uniqueEmail,
} from './helpers';

test.describe('Gherkin administracion.feature y disponibilidad.feature HU-10', () => {
  test('HU-19 dashboard de ocupación', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/occupancy');
    await expect(page.getByRole('heading', { name: 'Ocupación semanal' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Espacio' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Pista sintetica/i })).toBeVisible();
    await selectOptionContaining(page, 'Espacio', /Pista sintetica/i);
    await expect(page.getByRole('cell', { name: /Pista sintetica/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Coliseo Robledo/i })).toHaveCount(0);
  });

  test('HU-20 admin lista usuarios, no degrada al último ADMIN y promociona a staff', async ({
    page,
  }) => {
    const student = await registerStudent(page, uniqueEmail('promote'));
    await logout(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/roles');
    const adminCard = page.locator('.reservation-card').filter({ hasText: ADMIN_EMAIL });
    await expect(adminCard).toBeVisible();
    if ((await page.getByText('Último administrador').count()) > 0) {
      await expect(adminCard.getByLabel('Rol')).toBeDisabled();
    }

    const studentCard = page.locator('.reservation-card').filter({ hasText: student.email });
    await studentCard.getByLabel('Rol').selectOption('STAFF');
    await studentCard.getByRole('button', { name: 'Guardar rol' }).click();
    await expect(page.locator('.success-text')).toContainText(/staff/i);

    await logout(page);
    await loginAs(page, student.email, STUDENT_PASSWORD);
    await expect(page.getByRole('link', { name: 'Administración' })).toBeVisible();
  });

  test('HU-10 staff guarda horario y crea/elimina un bloqueo', async ({ page }) => {
    const date = nextWeekdayIso(21);
    const reason = `Mantenimiento E2E ${Date.now()}`;
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/availability');
    await selectOptionContaining(page, 'Espacio', /Pista sintetica/i);
    await expect(page.getByRole('heading', { name: 'Horario semanal' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Abierto' }).first()).toBeChecked();
    await page.getByRole('button', { name: 'Guardar horario' }).click();
    await expect(page.getByText('Horario semanal guardado.')).toBeVisible();

    const createForm = page.locator('.block-create-form');
    await createForm.getByLabel('Desde').fill(`${date}T09:00`);
    await createForm.getByLabel('Hasta').fill(`${date}T12:00`);
    await createForm.getByLabel('Motivo').fill(reason);
    await createForm.getByRole('button', { name: 'Crear bloqueo' }).click();
    await expect(page.getByText('Bloqueo creado.')).toBeVisible();
    await expect(page.getByText(`Motivo: ${reason}`)).toBeVisible();

    const blockCard = page.locator('.reservation-card').filter({ hasText: reason });
    await blockCard.getByRole('button', { name: 'Eliminar bloqueo' }).click();
    await blockCard.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Bloqueo eliminado.')).toBeVisible();
  });
});
