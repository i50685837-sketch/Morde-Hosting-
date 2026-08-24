// services/paystackService.js
const axios = require('axios');
const { PAYSTACK_SECRET_KEY, PAYSTACK_BASE_URL } = require('../config/paystack');

const client = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Normalize Kenyan phone numbers to the format Paystack expects: 07XXXXXXXX or 01XXXXXXXX
 * Accepts 2547XXXXXXXX, +2547XXXXXXXX, 07XXXXXXXX, 7XXXXXXXX
 */
function normalizeKenyanPhone(rawPhone) {
  let phone = String(rawPhone).trim().replace(/\s+/g, '');
  if (phone.startsWith('+254')) phone = phone.slice(1);
  if (phone.startsWith('254')) phone = '0' + phone.slice(3);
  if (/^[71]\d{8}$/.test(phone)) phone = '0' + phone;
  if (!/^0[71]\d{8}$/.test(phone)) {
    throw new Error(`Invalid Kenyan phone number: ${rawPhone}`);
  }
  return phone;
}

/**
 * Initiate an M-Pesa charge via Paystack.
 * amount is in KES (will be converted to lowest currency unit i.e. cents/kobo equivalent).
 * Paystack expects amount in the *subunit* of the currency; for KES that's cents (amount * 100).
 */
async function initiateMpesaCharge({ email, amountKES, phone, metadata = {} }) {
  const normalizedPhone = normalizeKenyanPhone(phone);

  const payload = {
    email,
    amount: Math.round(amountKES * 100), // KES -> cents
    currency: 'KES',
    mobile_money: {
      phone: normalizedPhone,
      provider: 'mpesa',
    },
    metadata,
  };

  const { data } = await client.post('/charge', payload);
  return data; // contains data.status ('pay_offline' / 'send_otp' / 'success' etc), data.reference
}

/**
 * Some M-Pesa charges require an OTP submission step (rare, but Paystack's API supports it).
 */
async function submitOtp({ otp, reference }) {
  const { data } = await client.post('/charge/submit_otp', { otp, reference });
  return data;
}

/**
 * Verify a transaction by its reference. Always re-verify server-side before
 * crediting a wallet — never trust client-side "success" callbacks alone.
 */
async function verifyTransaction(reference) {
  const { data } = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data; // data.data.status === 'success' means it's genuinely paid
}

/**
 * Initiate a payout (withdrawal) to a mobile money recipient.
 * Requires creating a Transfer Recipient first, then a Transfer.
 */
async function createMobileMoneyRecipient({ name, phone, bankCode = 'MPESA' }) {
  const normalizedPhone = normalizeKenyanPhone(phone);
  const payload = {
    type: 'mobile_money',
    name,
    account_number: normalizedPhone,
    bank_code: bankCode, // Paystack Kenya mobile money code, confirm via /bank?currency=KES
    currency: 'KES',
  };
  const { data } = await client.post('/transferrecipient', payload);
  return data;
}

async function initiateTransfer({ amountKES, recipientCode, reason = 'Withdrawal', reference }) {
  const payload = {
    source: 'balance',
    amount: Math.round(amountKES * 100),
    recipient: recipientCode,
    reason,
    reference,
  };
  const { data } = await client.post('/transfer', payload);
  return data;
}

module.exports = {
  normalizeKenyanPhone,
  initiateMpesaCharge,
  submitOtp,
  verifyTransaction,
  createMobileMoneyRecipient,
  initiateTransfer,
};
