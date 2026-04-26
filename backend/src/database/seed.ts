import { initDb, queryOne, run } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  await initDb();
  console.log('Seeding database...');

  const ubumweId = uuidv4();
  const ihuriroId = uuidv4();

  // Branches
  const existingBranch = await queryOne('SELECT id FROM branches WHERE name = ?', ['UBUMWE HOUSE']);
  if (!existingBranch) {
    await run('INSERT INTO branches (id, name, address, phone, email, description, total_floors, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ubumweId, 'UBUMWE HOUSE', 'KG 123 St, Kigali', '+250788000001', 'ubumwe@rms.rw', 'First residential branch', 4, 'active']);
    await run('INSERT INTO branches (id, name, address, phone, email, description, total_floors, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ihuriroId, 'IHURIRO HOUSE', 'KN 456 Ave, Kigali', '+250788000002', 'ihuriro@rms.rw', 'Second residential branch', 3, 'active']);
  } else {
    console.log('Data already seeded. Skipping.');
    process.exit(0);
  }

  const superPw = await bcrypt.hash('Admin@1234', 10);
  const adminPw = await bcrypt.hash('Admin@1234', 10);
  const mgrPw = await bcrypt.hash('Manager@1234', 10);

  const superAdminId = uuidv4();
  const adminUbumweId = uuidv4();
  const adminIhuriroId = uuidv4();
  const managerUbId = uuidv4();

  await run('INSERT INTO users (id, name, email, password, role, branch_id, permissions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [superAdminId, 'Super Administrator', 'superadmin@rms.rw', superPw, 'super_admin', null, JSON.stringify(['*']), 'active']);
  await run('INSERT INTO users (id, name, email, password, role, branch_id, permissions, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [adminUbumweId, 'INEZA Pacifique', 'admin.ubumwe@rms.rw', adminPw, 'admin', ubumweId, JSON.stringify(['branch.*']), 'active', superAdminId]);
  await run('INSERT INTO users (id, name, email, password, role, branch_id, permissions, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [adminIhuriroId, 'Ihuriro Manager', 'admin.ihuriro@rms.rw', adminPw, 'admin', ihuriroId, JSON.stringify(['branch.*']), 'active', superAdminId]);
  await run('INSERT INTO users (id, name, email, password, role, branch_id, permissions, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [managerUbId, 'Jean Manager', 'manager.ubumwe@rms.rw', mgrPw, 'manager', ubumweId, JSON.stringify(['tenants.*', 'payments.*']), 'active', adminUbumweId]);

  // Rooms for UBUMWE
  const roomData = [
    { num: '101', floor: 1, type: 'standard', rent: 150000 },
    { num: '102', floor: 1, type: 'standard', rent: 150000 },
    { num: '103', floor: 1, type: 'deluxe', rent: 200000 },
    { num: '201', floor: 2, type: 'standard', rent: 155000 },
    { num: '202', floor: 2, type: 'suite', rent: 280000 },
    { num: '301', floor: 3, type: 'studio', rent: 120000 },
  ];
  const roomIds: string[] = [];
  for (const r of roomData) {
    const rid = uuidv4();
    roomIds.push(rid);
    await run('INSERT INTO rooms (id, branch_id, room_number, floor, room_type, rent_amount, deposit_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [rid, ubumweId, r.num, r.floor, r.type, r.rent, r.rent, 'available']);
  }

  // Rooms for IHURIRO
  for (const r of [
    { num: 'A01', floor: 1, type: 'standard', rent: 130000 },
    { num: 'A02', floor: 1, type: 'standard', rent: 130000 },
    { num: 'B01', floor: 2, type: 'deluxe', rent: 180000 },
    { num: 'B02', floor: 2, type: 'studio', rent: 100000 },
  ]) {
    await run('INSERT INTO rooms (id, branch_id, room_number, floor, room_type, rent_amount, deposit_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), ihuriroId, r.num, r.floor, r.type, r.rent, r.rent, 'available']);
  }

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`;

  const tenantData = [
    { first: 'Alice', last: 'Mugisha', phone: '+250788111111', roomIdx: 0, rent: 150000 },
    { first: 'Bob', last: 'Nkusi', phone: '+250788222222', roomIdx: 1, rent: 150000 },
    { first: 'Claire', last: 'Uwase', phone: '+250788333333', roomIdx: 2, rent: 200000 },
  ];

  for (let i = 0; i < tenantData.length; i++) {
    const t = tenantData[i];
    const tid = uuidv4();
    await run('INSERT INTO tenants (id, branch_id, room_id, first_name, last_name, phone, move_in_date, rent_amount, deposit_paid, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tid, ubumweId, roomIds[t.roomIdx], t.first, t.last, t.phone, '2024-01-01', t.rent, t.rent, 'active', managerUbId]);
    await run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [roomIds[t.roomIdx]]);

    const isPaid = i < 2;
    await run('INSERT INTO payments (id, tenant_id, branch_id, room_id, amount, amount_due, payment_type, due_date, paid_date, month_year, status, receipt_number, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), tid, ubumweId, roomIds[t.roomIdx],
        isPaid ? t.rent : 0, t.rent, 'rent', dueDate,
        isPaid ? now.toISOString().split('T')[0] : null,
        monthYear, isPaid ? 'paid' : 'pending',
        isPaid ? `RCP-${Date.now()}-${i}` : null, managerUbId]);
  }

  // System settings
  for (const s of [
    { key: 'penalty_rate', value: '10', description: 'Late payment penalty percentage' },
    { key: 'penalty_grace_days', value: '5', description: 'Grace period before penalty applies (days)' },
    { key: 'reminder_days_before', value: '3', description: 'Days before due date to send reminder' },
    { key: 'system_currency', value: 'RWF', description: 'System currency' },
    { key: 'system_name', value: 'RENT MANAGEMENT SYSTEM', description: 'System name' },
  ]) {
    await run('INSERT INTO system_settings (`key`, value, description, updated_by) VALUES (?, ?, ?, ?)',
      [s.key, s.value, s.description, superAdminId]);
  }

  console.log('\n✅ Database seeded successfully!\n');
  console.log('Default Login Credentials:');
  console.log('─────────────────────────────────────────');
  console.log('Super Admin:      superadmin@rms.rw   / Admin@1234');
  console.log('Admin (UBUMWE):   admin.ubumwe@rms.rw / Admin@1234');
  console.log('Admin (IHURIRO):  admin.ihuriro@rms.rw/ Admin@1234');
  console.log('Manager (UBUMWE): manager.ubumwe@rms.rw / Manager@1234');
  console.log('─────────────────────────────────────────\n');
  process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
