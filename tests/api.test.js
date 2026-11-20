import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'node:child_process';

let server;
const URL = 'http://localhost:3100';

beforeAll(async () => {
  process.env.DB_PATH = './data/test.db';
  process.env.JWT_SECRET = 'test-secret';
  server = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: '3100' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2000));
});
afterAll(() => { server.kill(); });

describe('api', () => {
  let cookie;
  it('login admin', async () => {
    const r = await request(URL).post('/api/auth/login').send({ companyCode: 'LSALLE', username: 'admin', password: 'admin123' });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('admin');
    cookie = r.headers['set-cookie'];
  });
  it('crea operación', async () => {
    const r = await request(URL).post('/api/ops').set('Cookie', cookie).send({ date: '2026-11-10', concept: 'Test', amount: 100, ruc: '10062021476' });
    expect(r.status).toBe(201);
    expect(r.body.signature).toBeTruthy();
  });
  it('lista operaciones', async () => {
    const r = await request(URL).get('/api/ops').set('Cookie', cookie);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
  it('rechaza sin auth', async () => {
    const r = await request(URL).get('/api/ops');
    expect(r.status).toBe(401);
  });
});