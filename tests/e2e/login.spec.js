import {test,expect} from '@playwright/test';
import {login} from './helpers.js';
test('ingreso de administrador',async({page})=>{await login(page);await expect(page.locator('#app-view')).toBeVisible();});
test('credenciales inválidas',async({page})=>{await page.goto('/');await page.fill('#l-user','admin');await page.fill('#l-pass','incorrecta');await page.click('#login-form button[type=submit]');await expect(page.locator('#l-msg')).toContainText('inválidas');});
