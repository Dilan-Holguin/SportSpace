import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  STUDENT_PASSWORD,
  bookFirstFreeSlot,
  loginAs,
  logout,
  nextWeekdayIso,
  openAvailability,
  registerStudent,
  uniqueEmail,
} from './helpers';

test.describe('Gherkin reservas.feature', () => {
  test('HU-11, HU-12, HU-13, HU-14 y HU-15 solicitar, conflicto, listar, aprobar y cancelar', async ({
    page,
  }) => {
    const date = nextWeekdayIso();
    const student = await registerStudent(page, uniqueEmail('booker'));
    await openAvailability(page, 'Pista sintetica', date);
    await bookFirstFreeSlot(page);

    await page.getByRole('link', { name: 'Ver mis reservas' }).click();
    await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
    await expect(page.getByText(/Pista sintetica/i).first()).toBeVisible();
    await expect(page.getByText('Pendiente').first()).toBeVisible();

    await logout(page);
    await registerStudent(page, uniqueEmail('rival'));
    await openAvailability(page, 'Pista sintetica', date);
    await expect(page.getByRole('button', { name: /Ocupada/ }).first()).toBeVisible();

    await logout(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/inbox');
    const requestCard = page.locator('.reservation-card').filter({ hasText: student.email });
    await expect(requestCard).toBeVisible();
    await requestCard.getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.locator('.success-text')).toContainText(/aprobada/i);

    await logout(page);
    await loginAs(page, student.email, STUDENT_PASSWORD);
    await page.goto('/my-reservations');
    await expect(page.getByText('Aprobada').first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).first().click();
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText('Cancelada').first()).toBeVisible();
  });
});
