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
