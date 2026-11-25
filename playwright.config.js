import {defineConfig,devices} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'ops-e2e-'));
export default defineConfig({testDir:'./tests/e2e',globalSetup:'./tests/e2e/setup.js',workers:1,timeout:30000,use:{baseURL:'http://127.0.0.1:3101',trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],webServer:{command:'node server/index.js',port:3101,reuseExistingServer:false,timeout:30000,env:{PORT:'3101',DB_PATH:path.join(dir,'e2e.db'),JWT_SECRET:'e2e-secret-long-enough-for-testing',ADMIN_USER:'admin',ADMIN_PASS:'E2E-initial-2026!',COOKIE_SECURE:'false',NODE_ENV:'test',TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',COMPANY_CODE:'LSALLE'}}});
