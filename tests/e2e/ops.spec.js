import { test, expect } from '@playwright/test';

test('login exitoso con admin', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#login-view')).toBeVisible();
  await page.fill('#l-company', 'LSALLE');
  await page.fill('#l-user', 'admin');
  await page.fill('#l-pass', 'admin123');
  await page.click('#login-form button[type="submit"]');
  const fp = page.locator('#firstpass-form');
  if (await fp.isVisible()) {
    await page.fill('#fp-pass', 'nueva12345');
    await page.fill('#fp-q', 'mascota');
    await page.fill('#fp-a', 'firulais');
    await page.click('#firstpass-form button[type="submit"]');
  }
  await expect(page.locator('#app-view')).toBeVisible();
});

test('credenciales inválidas', async ({ page }) => {
  await page.goto('/');
  await page.fill('#l-company', 'LSALLE');
  await page.fill('#l-user', 'admin');
  await page.fill('#l-pass', 'incorrecta');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#l-msg')).toContainText('inválidas');
});