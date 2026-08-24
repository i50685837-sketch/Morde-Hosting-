const express = require("express");

const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();


/* =========================
   CURRENT USER
========================= */

router.get("/me", auth, async (req, res) => {

  try {

    const user =
      await User.findById(
        req.userId
      ).select("-password");

    if (!user) {
      return res.status(404).json({
        message:
          "User not found."
      });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        plan: user.plan,
        walletBalance:
          user.walletBalance,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });

  } catch (error) {

    console.error(
      "USER ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load user."
    });
  }
});


module.exports = router;
