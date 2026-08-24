// controllers/paymentController.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const paystackService = require('../services/paystackService');
const Transaction = require('../models/Transaction');
const { PAYSTACK_SECRET_KEY } = require('../config/paystack');

/**
 * POST /api/payments/deposit
 * body: { amountKES, phone }
 * Assumes req.user is set by your auth middleware.
 */
async function initiateDeposit(req, res) {
  try {
    const { amountKES, phone } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!amountKES || amountKES <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const reference = `DEP-${uuidv4()}`;

    const chargeResponse = await paystackService.initiateMpesaCharge({
      email: userEmail,
      amountKES,
      phone,
      metadata: { userId, reference },
    });

    if (!chargeResponse.status) {
      return res.status(400).json({ success: false, message: chargeResponse.message });
    }

    const paystackReference = chargeResponse.data.reference;

    await Transaction.create({
      user: userId,
      type: 'deposit',
      reference: paystackReference,
      phone,
      amountKES,
      status: 'pending',
      rawResponse: chargeResponse.data,
    });

    // data.status will typically be 'pay_offline' — customer needs to
    // enter PIN on their phone. Frontend should poll or wait for webhook.
    return res.status(200).json({
      success: true,
      reference: paystackReference,
      status: chargeResponse.data.status,
      displayText: chargeResponse.data.display_text || 'Check your phone to complete payment',
    });
  } catch (err) {
    console.error('[initiateDeposit] error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Deposit initiation failed' });
  }
}

/**
 * GET /api/payments/status/:reference
 * Frontend polls this while waiting for the M-Pesa PIN prompt to be completed.
 */
async function checkDepositStatus(req, res) {
  try {
    const { reference } = req.params;
    const tx = await Transaction.findOne({ reference, user: req.user.id });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });

    // Re-verify with Paystack directly rather than trusting only local DB state
    const verification = await paystackService.verifyTransaction(reference);
    const paystackStatus = verification.data.status;

    if (paystackStatus === 'success' && tx.status !== 'success') {
      tx.status = 'success';
      tx.rawResponse = verification.data;
      await tx.save();
      // TODO: credit user wallet here (idempotent — check tx.status wasn't already 'success')
    } else if (paystackStatus === 'failed' && tx.status !== 'failed') {
      tx.status = 'failed';
      tx.rawResponse = verification.data;
      await tx.save();
    }

    return res.status(200).json({ success: true, status: tx.status });
  } catch (err) {
    console.error('[checkDepositStatus] error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Status check failed' });
  }
}

/**
 * POST /api/payments/webhook
 * Paystack webhook — must verify the signature before trusting the payload.
 * IMPORTANT: register this route with express.raw() or capture rawBody,
 * since signature verification needs the exact byte payload Paystack sent.
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(req.rawBody) // see routes/payment.js for how rawBody is captured
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[webhook] signature mismatch — possible spoofed request');
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    // Acknowledge immediately, process after
    res.status(200).send('OK');

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const tx = await Transaction.findOne({ reference });
      if (tx && tx.status !== 'success') {
        tx.status = 'success';
        tx.rawResponse = event.data;
        await tx.save();
        // TODO: credit user wallet here (idempotent check above prevents double-credit)
      }
    } else if (event.event === 'charge.failed') {
      const reference = event.data.reference;
      const tx = await Transaction.findOne({ reference });
      if (tx && tx.status === 'pending') {
        tx.status = 'failed';
        tx.rawResponse = event.data;
        await tx.save();
      }
    }
    // Handle transfer.success / transfer.failed similarly for withdrawals
  } catch (err) {
    console.error('[handleWebhook] error:', err.message);
    // Response already sent above; just log.
  }
}

/**
 * POST /api/payments/withdraw
 * body: { amountKES, phone }
 * This only initiates the transfer request — actual wallet debit logic
 * (checking sufficient balance, locking funds) must live in your wallet service.
 */
async function initiateWithdrawal(req, res) {
  try {
    const { amountKES, phone } = req.body;
    const userId = req.user.id;

    if (!amountKES || amountKES <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // TODO: verify + deduct/lock user's wallet balance BEFORE calling Paystack.
    // If the transfer later fails, refund the locked amount.

    const recipient = await paystackService.createMobileMoneyRecipient({
      name: req.user.name || 'Wincrash User',
      phone,
    });

    if (!recipient.status) {
      return res.status(400).json({ success: false, message: recipient.message });
    }

    const reference = `WD-${uuidv4()}`;
    const transfer = await paystackService.initiateTransfer({
      amountKES,
      recipientCode: recipient.data.recipient_code,
      reference,
    });

    await Transaction.create({
      user: userId,
      type: 'withdrawal',
      reference,
      phone,
      amountKES,
      status: 'pending',
      rawResponse: transfer.data,
    });

    return res.status(200).json({ success: true, reference, status: transfer.data.status });
  } catch (err) {
    console.error('[initiateWithdrawal] error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Withdrawal initiation failed' });
  }
}

module.exports = {
  initiateDeposit,
  checkDepositStatus,
  handleWebhook,
  initiateWithdrawal,
};
