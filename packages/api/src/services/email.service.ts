/**
 * CyberGuard AI — Email Service
 *
 * Sends transactional emails via Azure Communication Services Email.
 * Uses connection string (stored in Key Vault, injected via App Settings).
 *
 * Sprint 2.5: Email verification + Password reset
 *
 * @see Azure Communication Services Email SDK
 */

import { EmailClient, type EmailMessage } from '@azure/communication-email';
import { config } from '../config/env';
import { logger } from '../core/observability/logger';

// ─── Client singleton ─────────────────────────────────────────────────────────

let _emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (_emailClient) return _emailClient;

  const connectionString = config.acs.connectionString;
  if (!connectionString) {
    throw new Error('ACS_CONNECTION_STRING not configured. Email sending is unavailable.');
  }

  _emailClient = new EmailClient(connectionString);
  return _emailClient;
}

// ─── Send helper ──────────────────────────────────────────────────────────────

async function sendEmail(message: EmailMessage): Promise<void> {
  const client = getEmailClient();

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      logger.info('Email sent', {
        to: (message.recipients.to ?? []).map((r: any) => r.address),
        subject: message.content.subject,
        messageId: result.id,
      });
    } else {
      throw new Error(`Email send failed with status: ${result.status}`);
    }
  } catch (err: any) {
    logger.error('Email send failed', {
      error: err.message,
      subject: message.content.subject,
    });
    throw err;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export async function sendEmailVerification(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${config.app.baseUrl}/verify-email?token=${token}`;

  await sendEmail({
    senderAddress: config.acs.senderAddress,
    recipients: { to: [{ address: to, displayName: name }] },
    content: {
      subject: 'Verify your CyberGuard AI email address',
      plainText: `Hi ${name},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create a CyberGuard AI account, please ignore this email.\n\nThe CyberGuard AI Team`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f1e; color: #e2e8f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #111827; border: 1px solid #1e2d45; border-radius: 12px; padding: 40px;">
    <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px;">🛡️ CyberGuard AI</div>
    <h1 style="font-size: 1.25rem; margin: 0 0 12px;">Verify your email address</h1>
    <p style="color: #64748b; margin: 0 0 24px;">Hi ${name}, click the button below to verify your email and activate your account.</p>
    <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Verify email address</a>
    <p style="color: #64748b; font-size: 0.875rem; margin: 24px 0 0;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    <p style="color: #64748b; font-size: 0.75rem; margin: 8px 0 0;">Or copy this URL: ${verifyUrl}</p>
  </div>
</body>
</html>`,
    },
  });
}

export async function sendPasswordReset(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const resetUrl = `${config.app.baseUrl}/reset-password?token=${token}`;

  await sendEmail({
    senderAddress: config.acs.senderAddress,
    recipients: { to: [{ address: to, displayName: name }] },
    content: {
      subject: 'Reset your CyberGuard AI password',
      plainText: `Hi ${name},\n\nYou requested a password reset. Visit this link to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email and your password will remain unchanged.\n\nThe CyberGuard AI Team`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f1e; color: #e2e8f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #111827; border: 1px solid #1e2d45; border-radius: 12px; padding: 40px;">
    <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px;">🛡️ CyberGuard AI</div>
    <h1 style="font-size: 1.25rem; margin: 0 0 12px;">Reset your password</h1>
    <p style="color: #64748b; margin: 0 0 24px;">Hi ${name}, click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reset password</a>
    <p style="color: #64748b; font-size: 0.875rem; margin: 24px 0 0;">If you didn't request a password reset, ignore this email. Your password will not change.</p>
    <p style="color: #64748b; font-size: 0.75rem; margin: 8px 0 0;">Or copy this URL: ${resetUrl}</p>
  </div>
</body>
</html>`,
    },
  });
}
