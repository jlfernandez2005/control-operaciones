import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import 'dotenv/config';

import { initSchema, seed } from './db.js';
import authRouter from './routes/auth.js';
import opsRouter from './routes/ops.js';
import provRouter from './routes/prov.js';
import ccRouter from './routes/cc.js';
import usersRouter from './routes/users.js';
import compRouter from './routes/companies.js';
import exportRouter from './routes/export.js';
import auditRouter from './routes/audit.js';

const app = express();
const PORT = process.env.PORT || 3000;

initSchema();
seed();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 120 }));

app.use('/api/auth', authRouter);
app.use('/api/ops', opsRouter);
app.use('/api/prov', provRouter);
app.use('/api/cc', ccRouter);
app.use('/api/users', usersRouter);
app.use('/api/companies', compRouter);
app.use('/api/export', exportRouter);
app.use('/api/audit', auditRouter);

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No encontrado' });
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));