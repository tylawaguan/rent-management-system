import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendResetEmail(to: string, name: string, resetLink: string) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"Rent Management System" <${from}>`,
    to,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#1e40af;margin:0;">Rent Management System</h2>
          <p style="color:#6b7280;margin:4px 0 0;">Password Reset</p>
        </div>
        <div style="background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 8px;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 24px;">We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Reset My Password</a>
          </div>
          <p style="color:#6b7280;font-size:12px;margin:0;">If you did not request this, ignore this email — your password will not change.</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Rent Management System &mdash; Do not reply to this email.</p>
      </div>
    `,
  });
}

export async function sendOtpEmail(to: string, name: string, code: string) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"Rent Management System" <${from}>`,
    to,
    subject: `Your Login Code: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#1e40af;margin:0;">Rent Management System</h2>
          <p style="color:#6b7280;margin:4px 0 0;">Two-Factor Authentication</p>
        </div>
        <div style="background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 8px;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 24px;">Use the code below to complete your login. This code expires in <strong>10 minutes</strong>.</p>
          <div style="text-align:center;background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1d4ed8;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;margin:0;">If you did not request this code, someone may be trying to access your account. Please contact your administrator immediately.</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Rent Management System &mdash; Do not reply to this email.</p>
      </div>
    `,
  });
}
