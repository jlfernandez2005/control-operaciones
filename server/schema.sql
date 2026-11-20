PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','editor','lector')),
  pass_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1,
  q TEXT,
  a_hash TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, username)
);
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ruc TEXT NOT NULL,
  name TEXT NOT NULL,
  cci TEXT NOT NULL,
  holder TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, ruc)
);
CREATE TABLE IF NOT EXISTS ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  concept TEXT NOT NULL,
  receipt TEXT,
  amount REAL NOT NULL,
  ruc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendiente',
  bank TEXT NOT NULL DEFAULT 'Scotiabank',
  type TEXT NOT NULL DEFAULT 'General',
  signature TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS petty_cash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  num TEXT NOT NULL,
  resp TEXT,
  area TEXT,
  ord TEXT,
  from_date TEXT,
  to_date TEXT,
  fund REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS petty_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cc_id INTEGER NOT NULL REFERENCES petty_cash(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  ruc TEXT,
  provider TEXT,
  receipt TEXT,
  category TEXT,
  detail TEXT NOT NULL,
  amount REAL NOT NULL,
  usd REAL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  payload TEXT,
  ip TEXT,
  ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ops_company_date ON ops(company_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit(company_id, created_at);