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
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit(company_id, created_at);;
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER REFERENCES users(id),
  filename TEXT NOT NULL,
  digest TEXT NOT NULL,
  submitted INTEGER NOT NULL,
  inserted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_import_company ON import_batches(company_id,created_at);
CREATE TABLE IF NOT EXISTS budget_lines (
 company_id INTEGER NOT NULL REFERENCES companies(id),
 month TEXT NOT NULL,
 category TEXT NOT NULL,
 cents INTEGER NOT NULL CHECK(cents>=0),
 PRIMARY KEY(company_id,month,category)
);
CREATE TABLE IF NOT EXISTS budget_cash_links (
 company_id INTEGER NOT NULL REFERENCES companies(id),
 cash_id INTEGER NOT NULL REFERENCES petty_cash(id) ON DELETE CASCADE,
 op_id INTEGER NOT NULL REFERENCES ops(id),
 PRIMARY KEY(company_id,cash_id), UNIQUE(company_id,op_id)
);
CREATE TABLE IF NOT EXISTS budget_month_refs (
 company_id INTEGER NOT NULL REFERENCES companies(id),
 month TEXT NOT NULL,
 cents INTEGER NOT NULL CHECK(cents>=0),
 filename TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(company_id,month)
);

CREATE TABLE IF NOT EXISTS flow_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), date TEXT NOT NULL, part TEXT NOT NULL, concept TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0), status TEXT NOT NULL, receipt TEXT NOT NULL DEFAULT '', bank TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flow_entries_period ON flow_entries(company_id,date);
CREATE TABLE IF NOT EXISTS flow_classification (
 company_id INTEGER NOT NULL REFERENCES companies(id), source_key TEXT NOT NULL, part TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', PRIMARY KEY(company_id,source_key)
);
CREATE TABLE IF NOT EXISTS flow_years (
 company_id INTEGER NOT NULL REFERENCES companies(id), year TEXT NOT NULL, config_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(company_id,year)
);

CREATE TABLE IF NOT EXISTS treasury_documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), kind TEXT NOT NULL CHECK(kind IN ('bank','collection','income_summary')), month TEXT NOT NULL, account TEXT NOT NULL DEFAULT '', bank TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL, digest TEXT NOT NULL, content_json TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,kind,month,account)
);

CREATE TABLE IF NOT EXISTS budget_date_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), source_date TEXT NOT NULL, target_date TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0), payload TEXT NOT NULL, reason TEXT NOT NULL, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_date_links_company ON budget_date_links(company_id,target_date);
