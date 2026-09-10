import { test, expect } from '@playwright/test';

test.use({ channel: process.env.E2E_CHROME_CHANNEL });

const userId = '00000000-0000-4000-8000-000000000001';
const reservationId = '00000000-0000-4000-8000-000000000002';

for (const viewport of [{ width: 390, height: 844 }, { width: 1365, height: 900 }]) {
  test(`MyPVit checkout ${viewport.width}px (mock provider)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {} };
    await page.addInitScript(({ user }) => {
      localStorage.setItem('sb-ekpctxfdtuwrkjpsdxyk-auth-token', JSON.stringify({
        access_token: 'mock-session', refresh_token: 'mock-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer', user,
      }));
    }, { user });
    let state: 'PENDING' | 'SUCCESS' = 'PENDING';
    let started = false;
    let starts = 0;
    const transaction = () => ({ id: '00000000-0000-4000-8000-000000000003', reference: 'WINA1234567890123456', status: state,
      amount: 5000, channel: 'airtel_money', created_at: new Date().toISOString() });
    // All backend traffic is simulated; this test never starts a real debit.
    await page.route('**/*.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      let body: unknown = [];
      if (url.pathname.includes('/auth/')) body = user;
      else if (url.pathname.includes('/functions/v1/mypvit-payment')) {
        const request = route.request().postDataJSON();
        if (request.action === 'start') { starts++; started = true; }
        body = { transaction: started ? transaction() : null };
      } else if (url.pathname.includes('/user_roles')) body = { role: 'client' };
      else if (url.pathname.includes('/profiles')) body = { user_id: userId, full_name: 'Client Test', status: 'actif' };
      else if (url.pathname.includes('/reservations')) body = { id: reservationId, user_id: userId, total_amount: 5000, paid_amount: 0,
        coins_used: 0, status: 'PENDING_PAYMENT', service_type: 'BILLET', details: {} };
      else if (url.pathname.includes('/vtc_wallets')) body = { user_id: userId, balance_points: state === 'SUCCESS' ? 5000 : 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/wallet/recharger');
    await page.getByRole('button', { name: 'Essentiel uniquement' }).click();
    await page.getByRole('button', { name: /Airtel Money/ }).click();
    await page.getByLabel('Numéro Airtel Money').fill('077123456');
    await page.screenshot({ path: `/tmp/mypvit-wallet-${viewport.width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Payer 5\u202f000 FCFA' }).click();
    await expect(page.getByText('En attente de confirmation', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /Airtel Money/ }).click();
    await expect(page.getByText('En attente de confirmation', { exact: true })).toBeVisible();
    expect(starts).toBe(1);
    state = 'SUCCESS';
    await expect(page).toHaveURL(/\/wallet$/, { timeout: 20000 });

    started = false;
    state = 'PENDING';
    await page.goto(`/paiement/${reservationId}`);
    await page.getByRole('button', { name: /Moov Money/ }).click();
    await expect(page.getByLabel('Numéro Moov Money')).toBeVisible();
    await page.screenshot({ path: `/tmp/mypvit-reservation-${viewport.width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText('Justificatif de virement', { exact: true })).toHaveCount(0);
  });
}
