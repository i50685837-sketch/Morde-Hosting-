// config/paystack.js
require('dotenv').config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_SECRET_KEY) {
  console.warn('[paystack] WARNING: PAYSTACK_SECRET_KEY is not set in .env');
}

module.exports = {
  PAYSTACK_SECRET_KEY,
  PAYSTACK_BASE_URL,
};
