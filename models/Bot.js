const mongoose = require("mongoose");

const botSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    runtime: {
      type: String,
      default: "Node.js"
    },

    status: {
      type: String,
      enum: [
        "online",
        "offline",
        "running",
        "stopped"
      ],
      default: "offline"
    },

    uptime: {
      type: String,
      default: "—"
    },

    memory: {
      type: String,
      default: "—"
    },

    description: {
      type: String,
      default: ""
    },

    repository: {
      type: String,
      default: ""
    },

    lastStartedAt: {
      type: Date,
      default: null
    },

    lastStoppedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.model(
    "Bot",
    botSchema
  );
