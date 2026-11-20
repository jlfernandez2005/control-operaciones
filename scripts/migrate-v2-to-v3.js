import { test, expect } from '@playwright/test';

test('admin ve auditoría', async ({ page }) => {
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
  await expect(page.locator('#tab-aud')).toBeVisible();
  await page.click('#tab-aud');
  await expect(page.locator('#a-tb')).toContainText(/login|create/);
});