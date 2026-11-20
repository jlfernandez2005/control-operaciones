import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.fill('#l-company', 'LSALLE');
  await page.fill('#l-user', 'admin');
  await page.fill('#l-pass', 'admin123');
  await page.click('#login-form button[type="submit"]');
  const fp = page.locator('#firstpass-form');
  if (await fp.isVisible()) {
    await page.fill('#fp-pass', 'nueva12345');
    await page.click('#firstpass-form button[type="submit"]');
  }
  await expect(page.locator('#app-view')).toBeVisible();
}

test('crear operación', async ({ page }) => {
  await login(page);
  await page.click('#nav button[data-t="reg"]');
  await page.fill('#r-f', '2026-11-20');
  await page.fill('#r-c', 'Operación E2E');
  await page.fill('#r-p', 'FE E001 - 999');
  await page.fill('#r-m', '150.50');
  await page.fill('#r-r', '10062021476');
  await page.click('#r-add');
  await expect(page.locator('#r-tb')).toContainText('Operación E2E');
});

test('dashboard KPIs', async ({ page }) => {
  await login(page);
  await page.click('#nav button[data-t="dash"]');
  await expect(page.locator('#d-k')).toContainText('Operaciones del mes');
});