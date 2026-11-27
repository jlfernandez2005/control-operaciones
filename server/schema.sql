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

-- 4.2: additive, tenant-scoped security and payroll. No changes to historical finance tables.
CREATE TABLE IF NOT EXISTS auth_sessions (
 sid_hash TEXT PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id), created INTEGER NOT NULL, seen INTEGER NOT NULL, expires INTEGER NOT NULL, mfa INTEGER NOT NULL DEFAULT 0, payroll_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(company_id,user_id);
CREATE TABLE IF NOT EXISTS auth_mfa (
 company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id), secret_box TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, last_counter INTEGER NOT NULL DEFAULT -1, pending_until INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS auth_attempts (
 key_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL, since INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payroll_access (
 company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id), can_write INTEGER NOT NULL DEFAULT 0, can_export INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS payroll_documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), period TEXT NOT NULL, kind TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, digest TEXT NOT NULL, content_box TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,period,kind)
);
CREATE TABLE IF NOT EXISTS payroll_history (
 company_id INTEGER NOT NULL REFERENCES companies(id), document_id INTEGER NOT NULL REFERENCES payroll_documents(id), revision INTEGER NOT NULL, content_box TEXT NOT NULL, digest TEXT NOT NULL, changed_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(company_id,document_id,revision)
);

-- SISFIA 5.0: only additive structures. No legacy records are rewritten.
CREATE TABLE IF NOT EXISTS erp_periods (
 company_id INTEGER NOT NULL REFERENCES companies(id), month TEXT NOT NULL, closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1)), reason TEXT NOT NULL, updated_by INTEGER REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(company_id,month)
);
CREATE TABLE IF NOT EXISTS erp_access (
 company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id), module TEXT NOT NULL CHECK(module IN ('erp','treasury')), can_write INTEGER NOT NULL DEFAULT 0 CHECK(can_write IN (0,1)), PRIMARY KEY(company_id,user_id,module)
);
CREATE TABLE IF NOT EXISTS erp_policy (
 company_id INTEGER PRIMARY KEY REFERENCES companies(id), require_mfa INTEGER NOT NULL DEFAULT 0 CHECK(require_mfa IN (0,1)), restrict_treasury INTEGER NOT NULL DEFAULT 0 CHECK(restrict_treasury IN (0,1))
);
CREATE TABLE IF NOT EXISTS erp_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), kind TEXT NOT NULL CHECK(kind IN ('center','purchase','payable','asset','document')), date TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, cents INTEGER NOT NULL DEFAULT 0 CHECK(cents>=0), state TEXT NOT NULL, data_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_by INTEGER REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,kind,code)
);
CREATE INDEX IF NOT EXISTS idx_erp_records_company ON erp_records(company_id,kind,date);
CREATE TABLE IF NOT EXISTS erp_allocations (
 company_id INTEGER NOT NULL REFERENCES companies(id), op_id INTEGER NOT NULL REFERENCES ops(id), center_id INTEGER NOT NULL REFERENCES erp_records(id), PRIMARY KEY(company_id,op_id)
);
CREATE TABLE IF NOT EXISTS erp_bank_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id), kind TEXT NOT NULL CHECK(kind IN ('payment','transfer')), month TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0), op_id INTEGER REFERENCES ops(id), payload TEXT NOT NULL, reason TEXT NOT NULL, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(company_id,op_id)
);
CREATE TABLE IF NOT EXISTS erp_bank_members (
 company_id INTEGER NOT NULL REFERENCES companies(id), link_id INTEGER NOT NULL REFERENCES erp_bank_links(id) ON DELETE CASCADE, doc_id INTEGER NOT NULL REFERENCES treasury_documents(id), row_index INTEGER NOT NULL CHECK(row_index>=0), PRIMARY KEY(company_id,doc_id,row_index)
);
CREATE TABLE IF NOT EXISTS erp_attachments (
 company_id INTEGER NOT NULL REFERENCES companies(id), record_id INTEGER NOT NULL REFERENCES erp_records(id), digest TEXT NOT NULL, filename TEXT NOT NULL, content_box TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>0), revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(company_id,record_id)
);

-- Daily batches are metadata only; the financial source is ops.
CREATE TABLE IF NOT EXISTS daily_batches (
 company_id INTEGER NOT NULL REFERENCES companies(id),
 request_id TEXT NOT NULL,
 report_date TEXT NOT NULL,
 digest TEXT NOT NULL,
 op_ids TEXT NOT NULL,
 created_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(company_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_batches_date ON daily_batches(company_id,report_date);
