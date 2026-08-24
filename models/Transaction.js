// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
    provider: { type: String, default: 'paystack' },
    reference: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    amountKES: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'reversed'],
      default: 'pending',
      index: true,
    },
    rawResponse: { type: mongoose.Schema.Types.Mixed }, // last known Paystack payload
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
