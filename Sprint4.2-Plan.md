# Sprint 4.2 — Plan
**Project:** CyberGuard AI (CloudSecure Solutions Ltd)
**Objective:** Enterprise Features — team invitations, role-based access, org settings, member management, audit log
**Status:** Scoped against confirmed current codebase state — ready to build

---

## What Discovery Confirmed (not guesses — read directly from the code)

**Exists today:**
- `POST /api/v1/organizations` — creates an org, makes the creator `org_admin` (one-time only; blocked if user already has an org)
- `GET /api/v1/organizations` — fetch the caller's own org
- `Organisation` type: `id, name, plan, ownerId, createdAt, updatedAt, memberCount, settings {country, industry, timezone}`
- `UserRole = 'super_admin' | 'org_admin' | 'standard'`, `requireRole(...roles)` middleware already used once (knowledge ingestion gate)
- `registerUser()` always creates a user with `organizationId: null, role: 'standard'` — registration and org-joining are currently the same one-shot flow with no branch for "join an existing org"

**Confirmed missing — nothing exists for any of these:**
- No way to update an org's name/settings after creation (no `PATCH /organizations`)
- No way to list who belongs to an org (`memberCount` is a bare number, no member-listing endpoint)
- No invitation system whatsoever — no invite type, no invite endpoint, no way for a second person to ever join an existing org
- No role management (promote/demote) beyond the one-time auto-assignment at org creation
- No audit log infrastructure — no container, no event type, nothing
- No frontend page for settings or team management — confirmed via file search, neither exists even as a stub

This is a genuine from-scratch build, not an extension of partial work — sizing this sprint accordingly.

---

## Build Sequence

```
4.2.1 — Team Invitations        (the actual blocking gap: today, a second person can never join an org)
    ↓
4.2.2 — Member Management        (list/remove/role-change — needs invitations done first to have >1 member to manage)
    ↓
4.2.3 — Organization Settings     (edit org profile — independent, could run in parallel, sequenced after for focus)
    ↓
4.2.4 — Role-Based Access Control (gate AI tools/admin actions by role — needs a product decision first, see below)
    ↓
4.2.5 — Audit Log                 (touches every existing service to log events — done last since it depends on 4.2.1-4.2.3 existing to have something to log)
```

---

## 4.2.1 — Team Invitations

**Backend:**
- New Cosmos container `invitations` (partition key `/organizationId`)
- `invitations.types.ts` — `Invitation { id, organizationId, invitedEmail, invitedByUserId, role: 'org_admin' | 'standard', status: 'pending' | 'accepted' | 'expired' | 'revoked', createdAt, expiresAt }`
- `invitations.repository.ts` — create, find by token, list by org, update status
- `invitations.service.ts` — `sendInvitation()` (generate token, save, email via the existing ACS pattern already used for verification emails), `acceptInvitation()`
- `invitations.router.ts`:
  - `POST /api/v1/organizations/invitations` (org_admin only) — invite by email + role
  - `GET /api/v1/organizations/invitations` (org_admin only) — list pending invites
  - `DELETE /api/v1/organizations/invitations/:id` (org_admin only) — revoke
  - `POST /api/v1/invitations/:token/accept` — the actual join step
- **Modify `auth.service.ts`'s `registerUser()`** to accept an optional invite token: if present, skip the `organizationId: null` default entirely — set org/role from the invitation, mark it accepted, increment `memberCount`, and skip the separate org-creation step this new user would otherwise need

**Frontend:**
- `TeamPage.tsx` — pending invitations list, "Invite teammate" form (email + role, org_admin only)
- `RegisterPage` (in `AuthPages.tsx`) — accept `?invite=<token>` in the URL, pre-fill/lock the email field, route through the invite-acceptance path instead of standalone registration

---

## 4.2.2 — Member Management

**Backend:**
- `GET /api/v1/organizations/members` — list all users in the caller's org
- `PATCH /api/v1/organizations/members/:userId/role` (org_admin only) — change a member's role
- `DELETE /api/v1/organizations/members/:userId` (org_admin only) — remove a member
- Edge case to handle explicitly: block removing/demoting the last remaining `org_admin` — an org should never end up with zero admins

**Frontend:** member list + role dropdown + remove button, part of `TeamPage.tsx`

---

## 4.2.3 — Organization Settings

**Backend:** `PATCH /api/v1/organizations` (org_admin only) — update name, country, industry, timezone

**Frontend:** `SettingsPage.tsx` — simple edit form, same field set as org creation

---

## 4.2.4 — Role-Based Access Control — NEEDS A DECISION BEFORE BUILDING

Right now every authenticated org member has identical access to chat, phishing analysis, and policy generation — `requireRole` exists but nothing beyond the one knowledge-ingestion gate actually uses it. Before gating anything, I need your call on the actual policy:

- Should `standard` members be able to **use** all three AI tools (chat/phishing/policies) the same as `org_admin`, with the role distinction only controlling **org management** (invites, settings, member removal)? — this is the common SaaS default and my recommendation absent other requirements
- Or should some AI tools be `org_admin`-only (e.g. policy generation, since generated policies are official-looking documents)?

I'd default to the first (role only gates org management, not AI tool usage) unless you want something stricter — flagging rather than assuming.

---

## 4.2.5 — Audit Log

**Backend:**
- New Cosmos container `audit_log` (partition key `/organizationId`)
- `audit.types.ts` — `AuditEvent { id, organizationId, userId, action, targetId?, metadata?, createdAt }`
- `audit.repository.ts` — `logEvent()`, `listEvents(orgId, page, limit)`
- Hook `logEvent()` calls into: `organizations.service.ts` (settings updated), `invitations.service.ts` (member invited/removed/role changed), `policies.service.ts` (policy generated), `phishing.service.ts` (analysis run) — touches multiple existing files, broader-reaching than the other items here

**Frontend:** a simple chronological event feed, likely a tab within `TeamPage.tsx` rather than a fully separate page

---

## Definition of Done — Sprint 4.2

- [ ] An org_admin can invite a teammate by email; that person can register via the invite link and lands directly in the right org with the right role
- [ ] Org_admin can view, remove, and change the role of existing members; cannot leave an org with zero admins
- [ ] Org_admin can edit org name/country/industry/timezone after creation
- [ ] Role-based access decision made and enforced consistently
- [ ] Audit log captures at minimum: invitations sent/accepted, member removed, role changed, settings updated, policy generated, phishing analysis run
- [ ] No regression in existing Sprint 3/4.1 functionality
