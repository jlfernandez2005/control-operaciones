import {expect} from '@playwright/test';
export async function login(page){await page.goto('/');await page.fill('#l-company','LSALLE');await page.fill('#l-user','admin');await page.fill('#l-pass','E2E-final-2026!');await page.click('#login-form button[type=submit]');await expect(page.locator('#app-view')).toBeVisible();}
