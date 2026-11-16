import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@udea.edu.co';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin1234';
export const STUDENT_PASSWORD = 'E2ePass123';

const LOGIN_RETRY_WAIT_MS = 65_000;

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@udea.edu.co`;
}

export function nextWeekdayIso(daysAhead = 8): string {
  const now = Date.now();
  for (let offset = daysAhead; offset < daysAhead + 12; offset += 1) {
    const instant = new Date(now + offset * 24 * 60 * 60 * 1000);
    const iso = instant.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [year, month, day] = iso.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      return iso;
    }
  }
  throw new Error('Could not find a weekday in America/Bogota');
}

async function waitForLoginThrottle(page: Page): Promise<boolean> {
  const alert = page.getByRole('alert').first();
  if ((await alert.count()) === 0) {
    return false;
  }
  const text = (await alert.textContent()) ?? '';
  return /Demasiados intentos/i.test(text);
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto('/login');
    await page.getByLabel('Correo', { exact: true }).fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    const session = page.getByRole('button', { name: 'Cerrar sesión' });
    try {
      await expect(session).toBeVisible({ timeout: 10_000 });
      return;
    } catch {
      if ((await waitForLoginThrottle(page)) && attempt < 3) {
        await page.waitForTimeout(LOGIN_RETRY_WAIT_MS);
        continue;
      }
      const alert = page.getByRole('alert');
      const text = (await alert.isVisible()) ? await alert.textContent() : 'session was not restored';
      throw new Error(`Login failed: ${text}`);
    }
  }
}

export async function selectOptionContaining(
  page: Page,
  label: string,
  text: string | RegExp,
): Promise<void> {
  const select = page.getByLabel(label);
  const value = await select.locator('option').filter({ hasText: text }).first().getAttribute('value');
  if (!value) {
    throw new Error(`No option matching ${String(text)} for ${label}`);
  }
  await select.selectOption(value);
}

export async function registerStudent(
  page: Page,
  email = uniqueEmail(),
): Promise<{ email: string; name: string }> {
  const name = `E2E ${email.split('@')[0]}`;
  await page.goto('/register');
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(STUDENT_PASSWORD);
  await page.getByRole('button', { name: 'Registrarme' }).click();

  const catalog = page.getByRole('heading', { name: 'Espacios deportivos' });
  const alert = page.getByRole('alert');
  await expect(catalog.or(alert)).toBeVisible();

  if (await catalog.isVisible()) {
    return { email, name };
  }

  if (await waitForLoginThrottle(page)) {
    await loginAs(page, email, STUDENT_PASSWORD);
    return { email, name };
  }

  throw new Error(`Registration failed: ${(await alert.textContent()) ?? 'unknown error'}`);
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
}

export async function openAvailability(page: Page, spaceName: string, date: string): Promise<void> {
  await page.goto('/spaces');
  await page.getByRole('link', { name: new RegExp(spaceName, 'i') }).click();
  await page.getByRole('link', { name: 'Ver disponibilidad' }).click();
  await page.getByLabel('Fecha').fill(date);
  await expect(page.getByRole('heading', { name: 'Disponibilidad' })).toBeVisible();
  await expect(page.getByText('Cargando franjas…')).toHaveCount(0);
}

export async function bookFirstFreeSlot(page: Page): Promise<void> {
  const freeSlot = page.getByRole('button', { name: /Libre/ }).first();
  await expect(freeSlot).toBeVisible();
  await freeSlot.click();
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  await expect(page.locator('.success-text')).toContainText(/Solicitud enviada|pendiente/i);
}
