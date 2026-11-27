-- Additive migration: old entries, users/sessions, settings and documents remain intact.
CREATE TABLE finance_workspace (
  id INTEGER PRIMARY KEY CHECK(id=1),
  version INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL CHECK(json_valid(data)),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE finance_audit (
  version INTEGER PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'administrador autenticado',
  before_data TEXT NOT NULL,
  after_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER finance_workspace_audit AFTER UPDATE ON finance_workspace
BEGIN
  INSERT INTO finance_audit(version,request_id,request_hash,reason,before_data,after_data)
  VALUES(NEW.version,NEW.request_id,NEW.request_hash,NEW.reason,OLD.data,NEW.data);
END;
CREATE TABLE finance_attachments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

