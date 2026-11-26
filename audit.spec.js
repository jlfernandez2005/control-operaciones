import {test,expect} from '@playwright/test';
import {login} from './helpers.js';
test('admin ve auditoría',async({page})=>{await login(page);await page.click('#tab-aud');await expect(page.locator('#a-tb')).toContainText('login');});
