/**
 * CyberGuard AI — Seed Script
 *
 * Creates a demo environment for testing and investor demos.
 * Run with: npm run seed (from project root or packages/api)
 *
 * Creates:
 * - Demo user: demo@cyberguard.ai / Demo2026!
 * - Demo organisation: CyberGuard Demo Corp
 * - 2 sample chat sessions with messages
 *
 * Safe to run multiple times — skips existing records.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { container } from './config/db';

const DEMO_USER_EMAIL = 'demo@cyberguard.ai';
const DEMO_PASSWORD = 'Demo2026!';
const DEMO_ORG_NAME = 'CyberGuard Demo Corp';

async function seed() {
  console.log('🌱 Seeding CyberGuard AI demo data...\n');

  // ── Check for existing demo user ──────────────────────────────────────────
  const { resources: existing } = await container('users')
    .items.query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: DEMO_USER_EMAIL }],
    })
    .fetchAll();

  if (existing.length > 0) {
    console.log('✅ Demo user already exists — skipping user/org creation');
    console.log(`   Email: ${DEMO_USER_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}\n`);
  } else {
    // ── Create demo user ──────────────────────────────────────────────────────
    const userId = uuidv4();
    const orgId = uuidv4();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    await container('organizations').items.create({
      id: orgId,
      name: DEMO_ORG_NAME,
      plan: 'free',
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      memberCount: 1,
      settings: { country: 'NG', industry: 'technology', timezone: 'Africa/Lagos' },
    });
    console.log(`✅ Created organisation: ${DEMO_ORG_NAME}`);

    await container('users').items.create({
      id: userId,
      email: DEMO_USER_EMAIL,
      name: 'Demo User',
      role: 'org_admin',
      organizationId: orgId,
      passwordHash,
      refreshTokenVersion: 0,
      createdAt: now,
      updatedAt: now,
      _partitionKey: orgId,
    });
    console.log(`✅ Created user: ${DEMO_USER_EMAIL} / ${DEMO_PASSWORD}`);

    // ── Create sample chat sessions ───────────────────────────────────────────
    const sessions = [
      {
        title: 'NDPR compliance checklist for SMEs',
        messages: [
          { role: 'user', content: 'Give me an NDPR compliance checklist for a Nigerian SME' },
          { role: 'assistant', content: 'Here is a practical NDPR compliance checklist for Nigerian SMEs:\n\n1. Appoint a Data Protection Officer (DPO)\n2. Create and publish a Privacy Policy\n3. Maintain a data inventory (what data you collect and why)\n4. Implement access controls and MFA\n5. Train staff on data protection\n6. Establish a breach response plan\n7. Sign data processing agreements with vendors\n8. Conduct annual NDPR compliance audits through a licensed DPCO\n\nThis covers the minimum requirements under the NDPR 2019 and the NDPA 2023.' },
        ],
      },
      {
        title: 'Protecting against phishing attacks',
        messages: [
          { role: 'user', content: 'What are the most effective ways to protect a Nigerian business from phishing?' },
          { role: 'assistant', content: 'The top protections against phishing for Nigerian businesses:\n\n1. Email security: Enable SPF, DKIM, and DMARC on your domain\n2. MFA everywhere: Especially email and banking portals\n3. Staff training: Run quarterly phishing simulations\n4. BEC awareness: Train staff to verify unusual financial requests via phone\n5. DNS filtering: Block known malicious domains\n6. Incident response: Establish a clear process for reporting suspicious emails\n\nNigerian businesses are particularly targeted by BEC (Business Email Compromise) — always verify payment instruction changes via a known phone number, never email alone.' },
        ],
      },
    ];

    for (const s of sessions) {
      const sessionId = uuidv4();
      const sessionNow = new Date().toISOString();

      await container('chat_sessions').items.create({
        id: sessionId,
        organizationId: orgId,
        userId,
        title: s.title,
        createdAt: sessionNow,
        updatedAt: sessionNow,
        messageCount: s.messages.length,
      });

      for (const m of s.messages) {
        await container('chat_messages').items.create({
          id: uuidv4(),
          sessionId,
          organizationId: orgId,
          userId,
          role: m.role,
          content: m.content,
          createdAt: new Date().toISOString(),
        });
      }

      console.log(`✅ Created session: "${s.title}"`);
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────');
  console.log(`Demo login: ${DEMO_USER_EMAIL}`);
  console.log(`Password:   ${DEMO_PASSWORD}`);
  console.log('─────────────────────────────────────\n');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
