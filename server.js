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
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Paystack requires raw body for webhook verification before JSON parsing
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

/**
 * 1. Initialize Deposit Route
 * POST /api/payments/deposit
 * Sends customer payload to Paystack and returns a payment authorization URL
 */
app.post('/api/payments/deposit', async (req, res) => {
    try {
        const { email, amount, metadata } = req.body;
        
        if (!email || !amount) {
            return res.status(400).json({ status: false, message: "Email and amount are required" });
        }

        // Paystack expects amounts in lowest subunits: kobo (NGN), pesewas (GHS), or cents (USD/ZAR)
        const amountInSubunits = Math.round(parseFloat(amount) * 100);

        const response = await fetch('https://paystack.co', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount: amountInSubunits,
                callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
                metadata
            })
        });

        const data = await response.json();
        
        if (!data.status) {
            return res.status(400).json({ status: false, message: data.message });
        }

        // Send payment details and authorization_url to client
        return res.status(200).json(data);
        
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
});

/**
 * 2. Verify Transaction Route
 * GET /api/payments/status/:reference
 * Uses URL route parameters instead of query strings to check payment state
 */
app.get('/api/payments/status/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        if (!reference) {
            return res.status(400).json({ status: false, message: "Reference parameter is required" });
        }

        const response = await fetch(`https://paystack.co{reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.status && data.data.status === 'success') {
            // Optional: Handle synchronous business logic here (e.g., credit user balances immediately)
            return res.status(200).json({ status: true, message: "Payment verified successfully", data: data.data });
        }

        return res.status(400).json({ status: false, message: "Transaction verification failed" });

    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
});

/**
 * 3. Secure Webhook Handler Route
 * Paystack server-to-server asynchronous notifications
 */
app.post('/api/payments/webhook', (req, res) => {
    // Validate signature to prove origin is Paystack
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(req.rawBody)
        .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).send('Invalid webhook signature');
    }

    // Return a 200 OK status immediately to prevent timeout retries
    res.sendStatus(200);

    // Process payment asynchronously
    const event = req.body;
    if (event.event === 'charge.success') {
        const paymentData = event.data;
        const reference = paymentData.reference;
        const customerEmail = paymentData.customer.email;
        const metadata = paymentData.metadata;

        console.log(`Async validation: Deposit completed for ${customerEmail}. Reference: ${reference}`);
        // TODO: Update your database status, credit user balance, or trigger notification emails here
    }
});

app.listen(PORT, () => console.log(`Server executing securely on port ${PORT}`));
      

// ============================================================
// APP
// ============================================================

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const NODE_ENV =
  process.env.NODE_ENV || "development";


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

app.use(
  express.json({
    limit: "1mb"
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

      return res.status(404)
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
              <p>Page not found.</p>
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
      message: "Not found."
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
