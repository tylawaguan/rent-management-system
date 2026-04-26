// Each statement separated by --- so initDb can run them individually
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  description TEXT,
  total_floors INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
---
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  branch_id VARCHAR(36),
  permissions TEXT NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  last_login DATETIME,
  reset_token VARCHAR(100),
  reset_token_exp DATETIME,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
)
---
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(36) PRIMARY KEY,
  branch_id VARCHAR(36) NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  floor INT DEFAULT 1,
  room_type VARCHAR(50) DEFAULT 'standard',
  capacity INT DEFAULT 1,
  rent_amount DECIMAL(15,2) NOT NULL,
  deposit_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  status VARCHAR(20) DEFAULT 'available',
  amenities TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_branch_room (branch_id, room_number),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
)
---
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(36) PRIMARY KEY,
  branch_id VARCHAR(36) NOT NULL,
  room_id VARCHAR(36),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  national_id VARCHAR(100),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  lease_end_date DATE,
  rent_amount DECIMAL(15,2) NOT NULL,
  deposit_paid DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
)
---
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  room_id VARCHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  amount_due DECIMAL(15,2) NOT NULL,
  penalty DECIMAL(15,2) DEFAULT 0,
  payment_type VARCHAR(50) DEFAULT 'rent',
  payment_method VARCHAR(50) DEFAULT 'cash',
  due_date DATE NOT NULL,
  paid_date DATE,
  month_year VARCHAR(7) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  receipt_number VARCHAR(100) UNIQUE,
  receipt_file VARCHAR(500),
  notes TEXT,
  recorded_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
)
---
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36),
  branch_id VARCHAR(36),
  user_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) DEFAULT 'in_app',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
)
---
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  branch_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  details TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
---
CREATE TABLE IF NOT EXISTS system_settings (
  \`key\` VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_by VARCHAR(36),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`;
