const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal"
      ],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      default: "KES"
    },

    status: {
      type: String,
      enum: [
        "pending",
        "success",
        "failed"
      ],
      default: "pending"
    },

    gateway: {
      type: String,
      default: "paystack"
    },

    gatewayReference: {
      type: String,
      default: null
    },

    description: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.model(
    "Transaction",
    transactionSchema
  );
