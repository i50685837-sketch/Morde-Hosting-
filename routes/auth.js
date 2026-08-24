const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString()
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}


/* =========================
   REGISTER
========================= */

router.post("/register", async (req, res) => {
  try {

    const {
      name,
      username,
      email,
      password
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters."
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existing =
      await User.findOne({
        email: normalizedEmail
      });

    if (existing) {
      return res.status(409).json({
        message:
          "An account with this email already exists."
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 12);

    const user =
      await User.create({
        name: name.trim(),
        username: username
          ? username.trim().toLowerCase()
          : undefined,
        email: normalizedEmail,
        password: hashedPassword,
        plan: "Free",
        walletBalance: 0
      });

    const token =
      createToken(user);

    res.status(201).json({
      message:
        "Account created successfully.",

      token,

      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        plan: user.plan,
        walletBalance:
          user.walletBalance
      }
    });

  } catch (error) {

    console.error(
      "REGISTER ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Email or username is already in use."
      });
    }

    res.status(500).json({
      message:
        "Registration failed."
    });
  }
});


/* =========================
   LOGIN
========================= */

router.post("/login", async (req, res) => {
  try {

    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required."
      });
    }

    const user =
      await User.findOne({
        email:
          email.trim().toLowerCase()
      }).select("+password");

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "This account is disabled."
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!valid) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }

    const token =
      createToken(user);

    res.json({
      message:
        "Login successful.",

      token,

      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        plan: user.plan,
        walletBalance:
          user.walletBalance
      }
    });

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Login failed."
    });
  }
});


module.exports = router;
