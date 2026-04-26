import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initDb, query, queryOne, run } from './database/db';
import { v4 as uuidv4 } from 'uuid';

import authRoutes from './routes/auth';
import branchRoutes from './routes/branches';
import userRoutes from './routes/users';
import roomRoutes from './routes/rooms';
import tenantRoutes from './routes/tenants';
import paymentRoutes from './routes/payments';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import settingsRoutes from './routes/settings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use('/uploads', express.static(path.resolve('./uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests' });
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

// Daily cron: mark overdue payments and send reminders
cron.schedule('0 8 * * *', async () => {
  try {
    const graceSetting = await queryOne<any>('SELECT value FROM system_settings WHERE `key` = ?', ['penalty_grace_days']);
    const graceDays = parseInt(graceSetting?.value || '5');
    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() - graceDays);
    const graceDateStr = graceDate.toISOString().split('T')[0];

    const overdueResult = await run(
      "UPDATE payments SET status = 'overdue' WHERE status = 'pending' AND due_date < ? AND payment_type = 'rent'",
      [graceDateStr]
    );

    const reminderSetting = await queryOne<any>('SELECT value FROM system_settings WHERE `key` = ?', ['reminder_days_before']);
    const reminderDays = parseInt(reminderSetting?.value || '3');
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + reminderDays);
    const reminderStr = reminderDate.toISOString().split('T')[0];

    const upcoming = await query<any>(`
      SELECT p.tenant_id, p.branch_id, p.month_year, p.amount_due,
        CONCAT(t.first_name, ' ', t.last_name) as name
      FROM payments p JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'pending' AND p.due_date = ? AND p.payment_type = 'rent'
    `, [reminderStr]);

    for (const p of upcoming) {
      const exists = await queryOne(
        "SELECT id FROM notifications WHERE tenant_id = ? AND type = 'reminder'",
        [p.tenant_id]
      );
      if (!exists) {
        await run(
          'INSERT INTO notifications (id, tenant_id, branch_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), p.tenant_id, p.branch_id, 'reminder',
            `Rent Reminder - ${p.month_year}`,
            `Dear ${p.name}, your rent of ${p.amount_due.toLocaleString()} RWF for ${p.month_year} is due in ${reminderDays} days.`]
        );
      }
    }

    console.log(`[CRON] Marked ${overdueResult.affectedRows} payments as overdue, checked ${upcoming.length} reminders`);
  } catch (e) {
    console.error('[CRON] Error:', e);
  }
});

async function start() {
  try {
    await initDb();
    console.log('✅ Database connected and schema ready');
    app.listen(PORT, () => {
      console.log(`\n🏢 RENT MANAGEMENT SYSTEM - API Server`);
      console.log(`✅ Running on http://localhost:${PORT}`);
      console.log(`📊 API health: http://localhost:${PORT}/api/health\n`);
    });
  } catch (e) {
    console.error('❌ Failed to start server:', e);
    process.exit(1);
  }
}

start();

export default app;
