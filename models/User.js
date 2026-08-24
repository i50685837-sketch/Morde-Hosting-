const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    plan: {
      type: String,
      enum: [
        "Free",
        "Starter",
        "Pro",
        "Business"
      ],
      default: "Free"
    },

    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    githubId: {
      type: String,
      default: null
    },

    avatar: {
      type: String,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.model(
    "User",
    userSchema
  );
