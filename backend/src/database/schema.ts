export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  description TEXT,
  total_floors INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','admin','manager','accountant','receptionist','staff')),
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  permissions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  otp_secret TEXT,
  otp_enabled INTEGER DEFAULT 0,
  otp_temp_token TEXT,
  otp_temp_token_exp TEXT,
  last_login TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  room_type TEXT DEFAULT 'standard' CHECK(room_type IN ('standard','deluxe','suite','studio','office','shop')),
  capacity INTEGER DEFAULT 1,
  rent_amount REAL NOT NULL,
  deposit_amount REAL DEFAULT 0,
  description TEXT,
  status TEXT DEFAULT 'available' CHECK(status IN ('available','occupied','maintenance','reserved')),
  amenities TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(branch_id, room_number)
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  national_id TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  move_in_date TEXT NOT NULL,
  move_out_date TEXT,
  lease_end_date TEXT,
  rent_amount REAL NOT NULL,
  deposit_paid REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','evicted','moved_out')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  amount_due REAL NOT NULL,
  penalty REAL DEFAULT 0,
  payment_type TEXT DEFAULT 'rent' CHECK(payment_type IN ('rent','deposit','penalty','utility','other')),
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank_transfer','mobile_money','cheque','card','other')),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  month_year TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','partial','overdue','waived')),
  receipt_number TEXT UNIQUE,
  receipt_file TEXT,
  notes TEXT,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('reminder','overdue','penalty','general','system','payment_received')),
  channel TEXT DEFAULT 'in_app' CHECK(channel IN ('in_app','email','sms')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  sent_at TEXT DEFAULT (datetime('now')),
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_role TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK(status IN ('success','failed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_branch ON rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_tenants_branch ON tenants(branch_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room ON tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month_year);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
`;
