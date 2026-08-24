// ============================================================
// MORDEHOST SERVER
// ============================================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

// ============================================================
// APP
// ============================================================

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const NODE_ENV =
  process.env.NODE_ENV || "development";

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;


// ============================================================
// SECURITY
// ============================================================

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      true,
    credentials: true
  })
);


// ============================================================
// BODY PARSING
// ============================================================

// Paystack webhook requires the raw request body
// for signature verification.

app.use(
  express.json({
    limit: "1mb",

    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);


// ============================================================
// LOGGING
// ============================================================

if (NODE_ENV !== "test") {
  app.use(morgan("dev"));
}


// ============================================================
// RATE LIMITING
// ============================================================

const generalLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
      message:
        "Too many requests. Please try again later."
    }
  });

app.use(
  "/api",
  generalLimiter
);


// ============================================================
// DATABASE
// ============================================================

async function connectDatabase() {

  if (!process.env.MONGO_URI) {

    throw new Error(
      "MONGO_URI is missing from .env"
    );

  }

  await mongoose.connect(
    process.env.MONGO_URI
  );

  console.log(
    "✅ MongoDB connected"
  );

}


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/health",
  (req, res) => {

    res.json({
      success: true,
      service: "MordeHost",
      status: "online",
      environment: NODE_ENV,
      timestamp:
        new Date().toISOString()
    });

  }
);


// ============================================================
// API ROOT
// ============================================================

app.get(
  "/api",
  (req, res) => {

    res.json({
      success: true,
      name: "MordeHost API",
      version: "1.0.0",
      status: "online"
    });

  }
);


// ============================================================
// PAYSTACK
// ============================================================

/**
 * 1. Initialize Deposit
 *
 * POST /api/payments/deposit
 */

app.post(
  "/api/payments/deposit",
  async (req, res) => {

    try {

      if (!PAYSTACK_SECRET_KEY) {

        return res.status(500).json({
          status: false,
          message:
            "PAYSTACK_SECRET_KEY is not configured."
        });

      }

      const {
        email,
        amount,
        metadata
      } = req.body;


      if (!email || !amount) {

        return res.status(400).json({
          status: false,
          message:
            "Email and amount are required"
        });

      }


      const numericAmount =
        Number(amount);


      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {

        return res.status(400).json({
          status: false,
          message:
            "Invalid amount"
        });

      }


      // Paystack expects the amount
      // in the smallest currency unit.

      const amountInSubunits =
        Math.round(
          numericAmount * 100
        );


      const response =
        await fetch(
          "https://api.paystack.co/transaction/initialize",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`,

              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              email,

              amount:
                amountInSubunits,

              callback_url:
                process.env.FRONTEND_URL ||
                process.env.CLIENT_URL,

              metadata
            })
          }
        );


      const data =
        await response.json();


      if (!response.ok || !data.status) {

        return res.status(400).json({
          status: false,

          message:
            data.message ||
            "Paystack initialization failed"
        });

      }


      return res.status(200).json(
        data
      );


    } catch (error) {

      console.error(
        "PAYSTACK INITIALIZATION ERROR:",
        error
      );

      return res.status(500).json({
        status: false,
        message:
          error.message
      });

    }

  }
);


/**
 * 2. Verify Transaction
 *
 * GET /api/payments/status/:reference
 */

app.get(
  "/api/payments/status/:reference",
  async (req, res) => {

    try {

      if (!PAYSTACK_SECRET_KEY) {

        return res.status(500).json({
          status: false,
          message:
            "PAYSTACK_SECRET_KEY is not configured."
        });

      }


      const {
        reference
      } = req.params;


      if (!reference) {

        return res.status(400).json({
          status: false,
          message:
            "Reference parameter is required"
        });

      }


      const response =
        await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`,

              "Content-Type":
                "application/json"
            }
          }
        );


      const data =
        await response.json();


      if (
        response.ok &&
        data.status &&
        data.data &&
        data.data.status === "success"
      ) {

        return res.status(200).json({
          status: true,

          message:
            "Payment verified successfully",

          data:
            data.data
        });

      }


      return res.status(400).json({
        status: false,

        message:
          data.message ||
          "Transaction verification failed"
      });


    } catch (error) {

      console.error(
        "PAYSTACK VERIFICATION ERROR:",
        error
      );

      return res.status(500).json({
        status: false,
        message:
          error.message
      });

    }

  }
);


/**
 * 3. Paystack Webhook
 *
 * POST /api/payments/webhook
 */

app.post(
  "/api/payments/webhook",
  (req, res) => {

    try {

      if (!PAYSTACK_SECRET_KEY) {

        return res
          .status(500)
          .send("PAYSTACK_SECRET_KEY is not configured");

      }


      if (!req.rawBody) {

        return res
          .status(400)
          .send("Raw request body unavailable");

      }


      const hash =
        crypto
          .createHmac(
            "sha512",
            PAYSTACK_SECRET_KEY
          )
          .update(req.rawBody)
          .digest("hex");


      const signature =
        req.headers[
          "x-paystack-signature"
        ];


      if (
        !signature ||
        hash !== signature
      ) {

        return res
          .status(401)
          .send("Invalid webhook signature");

      }


      const event =
        req.body;


      // Respond immediately so Paystack
      // does not unnecessarily retry.

      res.sendStatus(200);


      if (
        event &&
        event.event === "charge.success"
      ) {

        const paymentData =
          event.data || {};

        const reference =
          paymentData.reference;

        const customerEmail =
          paymentData.customer &&
          paymentData.customer.email;

        const metadata =
          paymentData.metadata;


        console.log(
          `Async validation: Deposit completed for ${customerEmail}. Reference: ${reference}`
        );


        // TODO:
        // Update database balance here.
        //
        // Example:
        // - Find user
        // - Check reference isn't already processed
        // - Credit wallet
        // - Save transaction
        //
        // Do NOT credit a wallet merely from
        // the frontend callback.


        console.log(
          "Webhook metadata:",
          metadata
        );

      }

    } catch (error) {

      console.error(
        "PAYSTACK WEBHOOK ERROR:",
        error
      );

      if (!res.headersSent) {

        return res
          .status(500)
          .send("Webhook processing error");

      }

    }

  }
);


// ============================================================
// ROUTES
// ============================================================

function loadRoutes() {

  const routes = {

    auth:
      "./routes/auth",

    github:
      "./routes/github",

    user:
      "./routes/user",

    bots:
      "./routes/bots",

    wallet:
      "./routes/wallet",

    payments:
      "./routes/payments",

    transactions:
      "./routes/transactions",

    logs:
      "./routes/logs",

    support:
      "./routes/support",

    settings:
      "./routes/settings"

  };


  for (
    const [name, file]
    of Object.entries(routes)
  ) {

    try {

      const router =
        require(file);


      app.use(
        `/api/${name}`,
        router
      );


      console.log(
        `✅ ${name} routes loaded`
      );


    } catch (error) {

      console.error(
        `⚠️ ${name} routes failed:`,
        error.message
      );

    }

  }

}

loadRoutes();


// ============================================================
// GITHUB OAUTH CALLBACK
// ============================================================

app.get(
  "/auth/github/callback",
  (req, res) => {

    res.redirect(
      "/api/github/callback" +
      (
        req.url.includes("?")
          ? req.url.substring(
              req.url.indexOf("?")
            )
          : ""
      )
    );

  }
);


// ============================================================
// STATIC FRONTEND
// ============================================================

const publicDir =
  path.join(
    __dirname,
    "public"
  );


app.use(
  express.static(
    publicDir
  )
);


// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        publicDir,
        "index.html"
      ),
      error => {

        if (error) {

          res.status(404).json({
            message:
              "MordeHost frontend not found."
          });

        }

      }
    );

  }
);


// ============================================================
// 404 API HANDLER
// ============================================================

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      success: false,
      message:
        "API endpoint not found."
    });

  }
);


// ============================================================
// GENERAL 404
// ============================================================

app.use(
  (req, res) => {

    if (
      req.accepts("html")
    ) {

      return res
        .status(404)
        .send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>404 · MordeHost</title>

            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >

            <style>
              body{
                margin:0;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#090909;
                color:#fff;
                font-family:Arial,sans-serif;
                text-align:center;
              }

              h1{
                font-size:70px;
                margin:0;
              }

              p{
                color:#888;
              }

              a{
                display:inline-block;
                margin-top:15px;
                padding:12px 18px;
                background:#fff;
                color:#000;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
              }
            </style>
          </head>

          <body>

            <div>

              <h1>404</h1>

              <p>
                Page not found.
              </p>

              <a href="/">
                Back Home
              </a>

            </div>

          </body>
          </html>
        `);

    }


    res.status(404).json({
      success: false,
      message:
        "Not found."
    });

  }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );


    if (
      res.headersSent
    ) {

      return next(error);

    }


    const status =
      error.statusCode ||
      error.status ||
      500;


    res.status(status).json({

      success: false,

      message:
        NODE_ENV === "production"
          ? "Internal server error."
          : (
              error.message ||
              "Internal server error."
            )

    });

  }
);


// ============================================================
// START SERVER
// ============================================================

async function startServer() {

  try {

    await connectDatabase();


    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log("");

        console.log(
          "======================================"
        );

        console.log(
          "       MORDEHOST SERVER"
        );

        console.log(
          "======================================"
        );

        console.log(
          `🚀 Port: ${PORT}`
        );

        console.log(
          `🌍 Environment: ${NODE_ENV}`
        );

        console.log(
          `📡 API: /api`
        );

        console.log(
          `❤️ Health: /health`
        );

        console.log(
          "======================================"
        );

        console.log("");

      }
    );


  } catch (error) {

    console.error(
      "❌ Server startup failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);

  }

}


// ============================================================
// PROCESS HANDLERS
// ============================================================

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "UNHANDLED REJECTION:",
      error
    );

  }
);


process.on(
  "uncaughtException",
  error => {

    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );

    process.exit(1);

  }
);


process.on(
  "SIGTERM",
  async () => {

    console.log(
      "SIGTERM received."
    );

    await mongoose.connection.close();

    process.exit(0);

  }
);


process.on(
  "SIGINT",
  async () => {

    console.log(
      "SIGINT received."
    );

    await mongoose.connection.close();

    process.exit(0);

  }
);


// ============================================================
// BOOT
// ============================================================

startServer();


// ============================================================
// EXPORT
// ============================================================

module.exports = app;
