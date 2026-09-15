# Operator runbook — Stripe activation for books-platform

Checkout is not currently active. This runbook covers the operator
steps to bring books-platform from "code deployed, no money flow"
to "test mode checkout working" and then to "live mode checkout
working".

## Current state (2026-09-15)

- **Code:** `apps/stripe-api/` is deployed
  (`books-platform-stripe-api-1-1` on forge-app-2, host port 3624,
  public at `https://stripe.questbooks.blueforge.studio`).
- **Container health:** `/api/health` returns 200 (verified).
- **Stripe dashboard:** no account set up for books-platform yet
  (this is the operator's task — see Step 1 below).
- **`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`:** unset in
  `books-platform/apps/stripe-api/.env` (deployed copy on forge-app-2).
- **Entitlement flow:** implemented in books-api
  (`apps/books-api/src/routes/entitlements/`) but never triggered
  because checkout returns 500 without Stripe keys.

## Step 1 — Create the Stripe account

The operator (not the agent) creates the Stripe account at
[https://dashboard.stripe.com/register](https://dashboard.stripe.com/register).
Use the books-platform operator email, not a personal one.

After registration, you will have:
- A **test mode** pair of keys (`sk_test_...`, `pk_test_...`).
- A **live mode** pair of keys (`sk_live_...`, `pk_live_...`).
- Account-level **Publishable Key** + **Secret Key** — keep the
  Secret Key inside the vault, not in `forge env list` directly.

For test mode, no further identity verification is needed. For
live mode, Stripe will request identity + bank account info before
the account can accept real payments.

## Step 2 — Wire up test mode

This is the section that brings checkout online in test mode. Once
test mode works, the live mode rollout is just key-swap + webhook
URL switch.

### 2.1. Set the test-mode keys

Operator-only step on forge-app-2:

```bash
ssh forge-app-2
cd /opt/books-platform

# Append (do NOT overwrite) Stripe keys to the stripe-api env file
# The deploy overlay expects these names — see apps/stripe-api/.env.example
cat >> stripe-api.env <<EOF
STRIPE_SECRET_KEY=sk_test_<from step 1>
STRIPE_PUBLISHABLE_KEY=pk_test_<from step 1>
STRIPE_WEBHOOK_SECRET=whsec_<will be set in step 2.4>
DATABASE_URL=<already configured — do not change>
CLIENT_URL=https://questbooks.blueforge.studio
BOOKS_API_URL=https://api.questbooks.blueforge.studio
INTERNAL_API_KEY=<same as books-api>
PORT=3001
EOF

# Restart the container so it picks up the new env
docker compose \
  -f stripe-api.docker-compose.yml -f stripe-api.override.yml \
  up -d --no-deps --build stripe-api-1

# Verify
curl -s https://stripe.questbooks.blueforge.studio/api/health
# Expect: {"status":"ok"}
```

### 2.2. Create products + prices

For each book being sold via the marketplace
(`apps/lq-book-marketplace/`), create a Stripe product + price pair
in the dashboard. Use the same price as the storefront's `priceCents`
field in the book manifest.

This step is mostly **click-ops** through the Stripe dashboard:
- Products → New → name = book title, description = book blurb
- Pricing → one-time payment, amount = `priceCents / 100`, currency = USD
- Save the generated `price_xxx` ID somewhere — the marketplace
  frontend needs to reference it. (`marketplace.service.ts` doesn't
  currently read a `stripePriceId` field from the manifest — see
  Step 2.5.)

### 2.3. Forward webhooks to the deployed environment

For test mode, run the Stripe CLI on the operator's laptop pointing
at the live stripe-api container:

```bash
stripe login  # first time only
stripe listen \
  --forward-to https://stripe.questbooks.blueforge.studio/api/webhooks/stripe
# Copy the printed `whsec_...` value back into stripe-api.env's
# STRIPE_WEBHOOK_SECRET, then restart the container.
```

For live mode, the webhook URL is set via the dashboard at
[Developers → Webhooks → Add endpoint](https://dashboard.stripe.com/webhooks):
- URL: `https://stripe.questbooks.blueforge.studio/api/webhooks/stripe`
- Events: `checkout.session.completed`,
  `payment_intent.succeeded`, `account.updated`
- Copy the displayed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

### 2.4. Smoke-test the purchase flow

Browse to `https://questbooks.blueforge.studio` and click through
to any book's purchase page. Use Stripe's test card
`4242 4242 4242 4242` (any CVC, any future expiry, any ZIP).

Expected:
- Checkout opens on stripe.com in test mode
- On completion, the user is redirected back to the marketplace
  with a "thank you" page
- The user's `entitlements` row in the books-api DB now grants the
  purchased book
- A subsequent load of the book from the storefront succeeds
  (entitlement gate passes) instead of redirecting to the purchase page

If entitlement doesn't fire, check:
- `apps/books-api/src/routes/webhooks/stripe.ts` signature verification
- The `INTERNAL_API_KEY` matches between stripe-api and books-api
- books-api's `entitlements` route is registered
  (check `apps/books-api/src/routes/index.ts`)

### 2.5. (Optional) Wire `stripePriceId` into book manifests

Today the marketplace has prices in cents but no reference to a
Stripe `price_xxx` ID — Stripe-API looks up the price by amount
when checkout starts. Cleaner to add a `stripePriceId?: string`
field to the book manifest and have the marketplace send it
through.

This is **a code change**, not just an env-var swap. File a follow-up
PR for it; not required for the activation smoke test.

## Step 3 — Promote to live mode

Once test mode is solid:

```bash
# 1. Switch the keys to live mode
ssh forge-app-2
cd /opt/books-platform
# Edit stripe-api.env: replace sk_test_... with sk_live_..., same for pk_

# 2. Switch the webhook to the live webhook URL
# (Add a new webhook endpoint in the dashboard per step 2.3's live-mode path)

# 3. Update STRIPE_WEBHOOK_SECRET to the live webhook's whsec_...

# 4. Restart
docker compose \
  -f stripe-api.docker-compose.yml -f stripe-api.override.yml \
  up -d --no-deps --build stripe-api-1

# 5. Smoke-test with a real card (refund immediately after)
```

## What this runbook deliberately does NOT do

- **No identity/KYB for the books-platform operator** — Stripe
  asks for this on account creation; the operator handles it
  directly through the dashboard.
- **No tax setup** — Stripe Tax is opt-in and not configured here.
  If the operator wants tax-inclusive pricing, file a follow-up.
- **No Refund/Cancellation UX in books-api** — there are routes
  for it but no marketplace UI wiring yet; out of scope for the
  activation milestone.
- **No Connect onboarding UX** — `apps/stripe-api/src/routes/connect/`
  is implemented for author payouts, but the marketplace author
  pages don't link to it yet. Out of scope for the activation
  milestone.

## Related runbooks

- `RUNBOOK-catalog-sync.md` — bring the catalog (manifest + projection)
  in sync with the storefront; required before any books are visible
  for purchase.
- `RUNBOOK-image-regen.md` — for re-generating any missing book
  imagery after activation.
