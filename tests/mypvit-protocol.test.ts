import { describe, expect, it } from 'vitest';
import { normalizePhone, paymentPayload, publicTransaction, verifiedStatus, type Transaction } from '../supabase/functions/_shared/mypvit-protocol';

const tx: Transaction = {
  id: 'id', user_id: 'user', reference: 'WINA1234567890123456', amount: 500,
  purpose: 'wallet_recharge', reservation_id: null, channel: 'airtel_money',
  phone: '077123456', account_code: 'ACC_TEST', operator_code: 'AIRTEL_MONEY',
  provider_id: 'PAY1', status: 'PENDING', submitted_at: null, checked_at: null, created_at: '',
};
const valid = {
  status: 'SUCCESS', merchant_reference_id: tx.reference, amount: 500,
  merchant_operation_account_code: 'ACC_TEST', operator: 'AIRTEL_MONEY', customer_account_number: '+24177123456',
};

describe('MyPVit protocol', () => {
  it.each(['077123456', '077 12 34 56', '+241 77 12 34 56', '0024177123456', '241077123456'])('normalizes %s', phone => {
    expect(normalizePhone(phone)).toBe('077123456');
  });
  it.each(['', '+237677123456', '077123456789', 'abc077123456', null])('rejects invalid phone %s', phone => {
    expect(() => normalizePhone(phone)).toThrow('INVALID_PHONE');
  });
  it('builds the documented REST payment, with server-owned fields', () => {
    expect(paymentPayload(tx, { callback: 'CALLBACK', owner: 'MERCHANT', operatorOwner: 'CUSTOMER' })).toMatchObject({
      reference: tx.reference, service: 'RESTFUL', transaction_type: 'PAYMENT',
      amount: 500, callback_url_code: 'CALLBACK', operator_code: 'AIRTEL_MONEY', owner_charge: 'MERCHANT',
    });
  });
  it('accepts only a matching status response', () => expect(verifiedStatus(valid, tx)).toBe('SUCCESS'));
  it.each([
    { amount: 501 }, { amount: '500' }, { merchant_reference_id: 'OTHER' },
    { merchant_operation_account_code: 'OTHER' }, { operator: 'MOOV_MONEY' }, { customer_account_number: '066123456' },
  ])('rejects mismatched transaction details %j', change => {
    expect(() => verifiedStatus({ ...valid, ...change }, tx)).toThrow('PROVIDER_MISMATCH');
  });
  it.each(['PENDING', 'AMBIGUOUS'])('does not treat %s as a final result', status => {
    expect(verifiedStatus({ ...valid, status }, tx)).toBe('PENDING');
  });
  it('rejects unknown status', () => expect(() => verifiedStatus({ ...valid, status: 'PAID' }, tx)).toThrow('INVALID_STATUS'));
  it('does not expose phone, account or provider credentials to the client', () => {
    expect(Object.keys(publicTransaction(tx)).sort()).toEqual(['amount', 'channel', 'created_at', 'id', 'reference', 'status']);
  });
});
