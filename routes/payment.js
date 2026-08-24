// routes/payment.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth'); // adjust path to your existing auth middleware

// Regular JSON routes (require login)
router.post('/deposit', authMiddleware, paymentController.initiateDeposit);
router.get('/status/:reference', authMiddleware, paymentController.checkDepositStatus);
router.post('/withdraw', authMiddleware, paymentController.initiateWithdrawal);

// Webhook route — Paystack calls this directly, no auth middleware.
// Must capture the raw body BEFORE express.json() parses it, since the
// signature is computed over the exact raw bytes.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body; // Buffer
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }
    next();
  },
  paymentController.handleWebhook
);

module.exports = router;
