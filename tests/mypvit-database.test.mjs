import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

// Isolated PostgreSQL engine; no connection to the deployed Supabase project.
const { PGlite } = await import(process.env.MYPVIT_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const user = randomUUID();
const other = randomUUID();
const migration = new URL('../supabase/migrations/20260908120000_mypvit_payments.sql', import.meta.url);
before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    SELECT set_config('request.jwt.claim.role', 'service_role', false);
    CREATE TYPE reservation_status AS ENUM ('PENDING_PAYMENT','CONFIRMED','CANCELLED');
    CREATE TYPE payment_status AS ENUM ('PENDING','VALIDATED','REJECTED');
    CREATE TYPE vtc_recharge_method AS ENUM ('airtel_money','moov_money');
    CREATE TABLE reservations(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users,
      total_amount integer NOT NULL, paid_amount integer DEFAULT 0, coins_used integer DEFAULT 0,
      paiement_valide boolean DEFAULT false, status reservation_status DEFAULT 'PENDING_PAYMENT', service_type text DEFAULT 'BILLET', details jsonb);
    CREATE TABLE payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid REFERENCES reservations,
      user_id uuid, amount integer, method text, transaction_ref text UNIQUE, status payment_status DEFAULT 'PENDING');
    CREATE TABLE vtc_wallets(user_id uuid PRIMARY KEY, balance_points integer DEFAULT 0, total_recharged integer DEFAULT 0, updated_at timestamptz);
    CREATE TABLE vtc_wallet_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, amount_points integer,
      balance_after integer, reference_code text, related_type text, related_id uuid, note text);
    CREATE TABLE vtc_recharge_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, amount_points integer, amount_fcfa integer,
      payment_method vtc_recharge_method, payment_reference text, agent_code text, status text, validated_at timestamptz, admin_note text);
  `);
  await db.query('INSERT INTO auth.users VALUES ($1), ($2)', [user, other]);
  await db.exec(await readFile(migration, 'utf8'));
});
after(() => db.close());

async function prepare({ uid = user, request = randomUUID(), purpose = 'wallet_recharge', reservation = null, amount = 500 } = {}) {
  const result = await db.query('SELECT * FROM mypvit_prepare($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [uid, request, purpose, reservation, amount, 'airtel_money', '077123456', 'AIRTEL_MONEY', 'ACC_TEST']);
  return result.rows[0];
}
async function settle(tx, status = 'SUCCESS', provider = randomUUID()) {
  return db.query('SELECT * FROM mypvit_settle($1,$2,$3)', [tx.id, status, provider]);
}
async function reservation(amount = 1000) {
  const id = randomUUID();
  await db.query('INSERT INTO reservations(id,user_id,total_amount) VALUES ($1,$2,$3)', [id, user, amount]);
  return id;
}

test('secret renewal has one owner and a shared cached result', async () => {
  assert.deepEqual((await db.query("SELECT mypvit_claim_secret('ACC_TEST') AS result")).rows[0].result, { renew: true });
  assert.deepEqual((await db.query("SELECT mypvit_claim_secret('ACC_TEST') AS result")).rows[0].result, { wait: true });
  await db.exec("UPDATE mypvit_secrets SET secret='test-secret', expires_at=now()+interval '1 hour', lease_until=null");
  assert.deepEqual((await db.query("SELECT mypvit_claim_secret('ACC_TEST') AS result")).rows[0].result, { secret: 'test-secret' });
});
test('duplicate starts and notifications credit the wallet exactly once', async () => {
  const request = randomUUID();
  const tx = await prepare({ request });
  assert.equal((await prepare({ request })).id, tx.id);
  assert.equal((await prepare()).id, tx.id);
  const provider = randomUUID();
  await Promise.all([settle(tx, 'SUCCESS', provider), settle(tx, 'SUCCESS', provider)]);
  assert.equal((await db.query('SELECT balance_points FROM vtc_wallets WHERE user_id=$1', [user])).rows[0].balance_points, 500);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM vtc_wallet_transactions')).rows[0].n, 1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM vtc_recharge_requests WHERE status='approved'")).rows[0].n, 1);
  await assert.rejects(settle(tx, 'FAILED', provider), /STATUS_CONFLICT/);
  await assert.rejects(settle(tx, 'SUCCESS', 'different'), /PROVIDER_MISMATCH/);
});
test('a definite rejection can be retried without adding money', async () => {
  const tx = await prepare();
  await settle(tx, 'FAILED', null);
  const retry = await prepare();
  assert.notEqual(retry.id, tx.id);
  await settle(retry, 'FAILED', randomUUID());
  assert.equal((await db.query('SELECT balance_points FROM vtc_wallets WHERE user_id=$1', [user])).rows[0].balance_points, 500);
});
test('reservation ownership, amount and existing manual payments are checked', async () => {
  const id = await reservation();
  await assert.rejects(prepare({ uid: other, purpose: 'reservation', reservation: id, amount: 1000 }), /FORBIDDEN/);
  await assert.rejects(prepare({ purpose: 'reservation', reservation: id, amount: 1 }), /AMOUNT_CHANGED/);
  await db.query('INSERT INTO payments(reservation_id,user_id,amount) VALUES ($1,$2,1000)', [id, user]);
  await assert.rejects(prepare({ purpose: 'reservation', reservation: id, amount: 1000 }), /PAYMENT_ALREADY_PENDING/);
});
test('pending debits freeze reservation payment fields and block other payment channels', async () => {
  const id = await reservation();
  const tx = await prepare({ purpose: 'reservation', reservation: id, amount: 1000 });
  await assert.rejects(db.query('UPDATE reservations SET paid_amount=1000 WHERE id=$1', [id]), /MYPVIT_PAYMENT_PENDING/);
  await assert.rejects(db.query("UPDATE reservations SET status='CANCELLED' WHERE id=$1", [id]), /MYPVIT_PAYMENT_PENDING/);
  await assert.rejects(db.query('INSERT INTO payments(reservation_id,user_id,amount) VALUES ($1,$2,1000)', [id, user]), /MYPVIT_PAYMENT_PENDING/);
  const provider = randomUUID();
  await settle(tx, 'SUCCESS', provider);
  await settle(tx, 'SUCCESS', provider);
  const r = (await db.query('SELECT * FROM reservations WHERE id=$1', [id])).rows[0];
  assert.equal(r.paid_amount, 1000);
  assert.equal(r.paiement_valide, true);
  assert.equal((await db.query('SELECT status FROM payments WHERE id=$1', [tx.payment_id])).rows[0].status, 'VALIDATED');
});
test('already spent coins are subtracted from the server-owned balance due', async () => {
  const id = await reservation();
  await db.query('UPDATE reservations SET coins_used=100,paid_amount=200 WHERE id=$1', [id]);
  const tx = await prepare({ purpose: 'reservation', reservation: id, amount: 700 });
  await settle(tx);
  assert.equal((await db.query('SELECT paid_amount FROM reservations WHERE id=$1', [id])).rows[0].paid_amount, 900);
});
test('clients cannot read secrets, create transactions, or call settlement RPCs', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(db.query('SELECT * FROM mypvit_secrets'), /permission denied/);
      await assert.rejects(db.query('SELECT * FROM mypvit_transactions'), /permission denied/);
      await assert.rejects(db.query('SELECT mypvit_settle($1,$2,$3)', [randomUUID(), 'SUCCESS', 'FAKE']), /permission denied/);
      await assert.rejects(db.query("SELECT mypvit_claim_secret('ACC_TEST')"), /permission denied/);
    } finally { await db.exec('RESET ROLE'); }
  }
});
