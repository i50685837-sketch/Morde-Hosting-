const express = require("express");
const crypto = require("crypto");

const auth =
  require("../middleware/auth");

const User =
  require("../models/User");

const Transaction =
  require("../models/Transaction");

const router =
  express.Router();


const PAYSTACK_SECRET =
  process.env.PAYSTACK_SECRET_KEY;

const CURRENCY =
  process.env.PAYSTACK_CURRENCY || "KES";


/*
================================
INITIALIZE DEPOSIT
POST /api/wallet/deposit
================================
*/

router.post(
  "/deposit",
  auth,
  async (req, res) => {

    try {

      if (!PAYSTACK_SECRET) {

        return res.status(500).json({
          message:
            "Paystack is not configured."
        });

      }

      const amount =
        Number(req.body.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res.status(400).json({
          message:
            "Enter a valid deposit amount."
        });

      }

      const user =
        await User.findById(
          req.userId
        );

      if (!user) {

        return res.status(404).json({
          message:
            "User not found."
        });

      }

      /*
       * Paystack expects the amount
       * in the smallest currency unit.
       *
       * For KES:
       * 100 KES -> 10000.
       */

      const gatewayAmount =
        Math.round(amount * 100);

      const reference =
        `MORDE-${Date.now()}-${crypto
          .randomBytes(5)
          .toString("hex")
          .toUpperCase()}`;


      const transaction =
        await Transaction.create({

          user: user._id,

          reference,

          type: "deposit",

          amount,

          currency: CURRENCY,

          status: "pending",

          gateway: "paystack",

          description:
            "MordeHost wallet deposit"

        });


      const response =
        await fetch(
          "https://api.paystack.co/transaction/initialize",
          {

            method: "POST",

            headers: {
              "Authorization":
                `Bearer ${PAYSTACK_SECRET}`,

              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              email: user.email,

              amount:
                gatewayAmount,

              currency:
                CURRENCY,

              reference,

              callback_url:
                `${process.env.CLIENT_URL}/wallet.html`

            })

          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.status
      ) {

        transaction.status =
          "failed";

        await transaction.save();

        return res.status(400).json({
          message:
            data.message ||
            "Unable to initialize Paystack payment."
        });

      }


      return res.json({

        message:
          "Payment initialized.",

        reference,

        authorization_url:
          data.data.authorization_url,

        access_code:
          data.data.access_code

      });


    } catch (error) {

      console.error(
        "PAYSTACK INIT ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Payment initialization failed."
      });

    }

  }
);


/*
================================
VERIFY DEPOSIT
GET /api/wallet/verify/:reference
================================
*/

router.get(
  "/verify/:reference",
  auth,
  async (req, res) => {

    try {

      if (!PAYSTACK_SECRET) {

        return res.status(500).json({
          message:
            "Paystack is not configured."
        });

      }

      const reference =
        req.params.reference;


      const transaction =
        await Transaction.findOne({
          reference,
          user: req.userId
        });


      if (!transaction) {

        return res.status(404).json({
          message:
            "Transaction not found."
        });

      }


      /*
       * Don't credit the wallet twice.
       */

      if (
        transaction.status ===
        "success"
      ) {

        const user =
          await User.findById(
            req.userId
          );

        return res.json({

          status: "success",

          message:
            "Payment was already verified.",

          walletBalance:
            user.walletBalance

        });

      }


      const response =
        await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {

            method: "GET",

            headers: {
              "Authorization":
                `Bearer ${PAYSTACK_SECRET}`,

              "Content-Type":
                "application/json"
            }

          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.status
      ) {

        return res.status(400).json({
          message:
            data.message ||
            "Unable to verify payment."
        });

      }


      const payment =
        data.data;


      if (
        payment.status !==
        "success"
      ) {

        transaction.status =
          "failed";

        await transaction.save();

        return res.json({

          status:
            payment.status,

          message:
            "Payment has not completed."

        });

      }


      /*
       * Confirm amount before
       * crediting the wallet.
       */

      const paidAmount =
        Number(payment.amount) / 100;


      if (
        Math.abs(
          paidAmount -
          transaction.amount
        ) > 0.01
      ) {

        return res.status(400).json({
          message:
            "Payment amount mismatch."
        });

      }


      /*
       * Credit wallet.
       */

      const user =
        await User.findById(
          req.userId
        );


      if (!user) {

        return res.status(404).json({
          message:
            "User not found."
        });

      }


      user.walletBalance +=
        transaction.amount;


      await user.save();


      transaction.status =
        "success";

      transaction.gatewayReference =
        payment.reference;


      await transaction.save();


      return res.json({

        status: "success",

        message:
          "Wallet credited successfully.",

        amount:
          transaction.amount,

        walletBalance:
          user.walletBalance

      });


    } catch (error) {

      console.error(
        "PAYSTACK VERIFY ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Payment verification failed."
      });

    }

  }
);


/*
================================
WALLET BALANCE
GET /api/wallet
================================
*/

router.get(
  "/",
  auth,
  async (req, res) => {

    try {

      const user =
        await User.findById(
          req.userId
        ).select(
          "walletBalance"
        );


      if (!user) {

        return res.status(404).json({
          message:
            "User not found."
        });

      }


      return res.json({

        balance:
          user.walletBalance,

        currency:
          CURRENCY

      });

    } catch (error) {

      return res.status(500).json({
        message:
          "Unable to load wallet."
      });

    }

  }
);


/*
================================
TRANSACTIONS
GET /api/wallet/transactions
================================
*/

router.get(
  "/transactions",
  auth,
  async (req, res) => {

    try {

      const transactions =
        await Transaction.find({
          user: req.userId
        })
        .sort({
          createdAt: -1
        })
        .limit(100);


      return res.json({
        transactions
      });

    } catch (error) {

      return res.status(500).json({
        message:
          "Unable to load transactions."
      });

    }

  }
);


module.exports = router;
