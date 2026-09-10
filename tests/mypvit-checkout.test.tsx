import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyPvitCheckout } from '@/components/payment/MyPvitCheckout';
import { mypvitRequest } from '@/lib/mypvit';

vi.mock('@/lib/mypvit', () => ({ mypvitRequest: vi.fn() }));
vi.mock('@/lib/vtc-wallet', () => ({ formatXAF: (n: number) => `${n} FCFA` }));
const request = vi.mocked(mypvitRequest);
const pending = { id: 'tx1', reference: 'WINA123', amount: 500, status: 'PENDING' as const, channel: 'airtel_money' as const, created_at: '' };

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.clearAllMocks(); });

describe('MyPVit checkout', () => {
  it('sends a phone payment without a receipt and disables resubmission while pending', async () => {
    request.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);
    const success = vi.fn();
    render(<MyPvitCheckout purpose="wallet_recharge" channel="airtel_money" amount={500} onSuccess={success} />);
    fireEvent.change(await screen.findByLabelText('Numéro Airtel Money'), { target: { value: '077123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Payer 500 FCFA' }));
    await screen.findByText('En attente de confirmation');
    expect(request.mock.calls[1][0]).toMatchObject({ action: 'start', amount: 500, phone: '077123456' });
    expect(screen.queryByRole('button', { name: /Payer/ })).toBeNull();
    expect(success).not.toHaveBeenCalled();
  });
  it('restores a pending transaction and confirms only after a verified success', async () => {
    request.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ...pending, status: 'SUCCESS' });
    const success = vi.fn();
    render(<MyPvitCheckout purpose="wallet_recharge" channel="moov_money" amount={10000} onSuccess={success} />);
    await screen.findByText('En attente de confirmation');
    expect(screen.getByText('500 FCFA')).toBeTruthy();
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1), { timeout: 4000 });
  });
  it('keeps a connection failure from enabling another debit', async () => {
    request.mockRejectedValue(new Error('Connexion indisponible'));
    render(<MyPvitCheckout purpose="wallet_recharge" channel="airtel_money" amount={500} onSuccess={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Payer/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
  it('allows a new attempt only after a confirmed failure', async () => {
    request.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...pending, status: 'FAILED' });
    render(<MyPvitCheckout purpose="wallet_recharge" channel="airtel_money" amount={500} onSuccess={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Numéro Airtel Money'), { target: { value: '077123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Payer 500 FCFA' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle tentative' }));
    expect(screen.getByRole('button', { name: 'Payer 500 FCFA' })).toBeTruthy();
  });
});
