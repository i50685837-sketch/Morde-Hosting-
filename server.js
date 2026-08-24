require("dotenv").config();

const express =
  require("express");

const mongoose =
  require("mongoose");

const cors =
  require("cors");

const path =
  require("path");


const app =
  express();


const PORT =
  process.env.PORT || 3000;


const MONGO_URI =
  process.env.MONGO_URI;


if (!MONGO_URI) {

  console.error(
    "❌ MONGO_URI is missing."
  );

  process.exit(1);

}


if (!process.env.JWT_SECRET) {

  console.error(
    "❌ JWT_SECRET is missing."
  );

  process.exit(1);

}


/*
================================
MIDDLEWARE
================================
*/

app.use(
  cors({
    origin:
      process.env.CLIENT_URL === "*"
        ? true
        : process.env.CLIENT_URL,

    credentials: true
  })
);


app.use(
  express.json({
    limit: "2mb"
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/*
================================
HEALTH
================================
*/

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      status: "ok",

      service:
        "MordeHost API",

      database:
        mongoose.connection
          .readyState === 1
          ? "connected"
          : "disconnected",

      paystack:
        process.env.PAYSTACK_SECRET_KEY
          ? "configured"
          : "not configured"

    });

  }
);


/*
================================
ROUTES
================================
*/

const authRoutes =
  require("./routes/auth");

const userRoutes =
  require("./routes/user");

const botRoutes =
  require("./routes/bots");

const walletRoutes =
  require("./routes/wallet");


app.use(
  "/api/auth",
  authRoutes
);


app.use(
  "/api/user",
  userRoutes
);


app.use(
  "/api/bots",
  botRoutes
);


app.use(
  "/api/wallet",
  walletRoutes
);


/*
================================
STATIC FRONTEND
================================
*/

const publicPath =
  path.join(
    __dirname,
    "public"
  );


app.use(
  express.static(
    publicPath
  )
);


app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        publicPath,
        "index.html"
      )
    );

  }
);


/*
================================
API 404
================================
*/

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({

      message:
        "API endpoint not found.",

      path:
        req.originalUrl

    });

  }
);


/*
================================
ERROR HANDLER
================================
*/

app.use(
  (error, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(
      error.status || 500
    ).json({

      message:
        error.message ||
        "Internal server error."

    });

  }
);


/*
================================
MONGODB
================================
*/

async function start() {

  try {

    console.log(
      "⏳ Connecting to MongoDB..."
    );


    await mongoose.connect(
      MONGO_URI
    );


    console.log(
      "✅ MongoDB Connected"
    );


    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log("");
        console.log(
          "================================"
        );
        console.log(
          "          MORDEHOST"
        );
        console.log(
          "================================"
        );
        console.log(
          `🚀 Server: ${PORT}`
        );
        console.log(
          "🔐 JWT: ON"
        );
        console.log(
          "🤖 Bots API: ON"
        );
        console.log(
          "💰 Wallet: ON"
        );
        console.log(
          process.env.PAYSTACK_SECRET_KEY
            ? "💳 Paystack: ON"
            : "⚠️ Paystack: NOT CONFIGURED"
        );
        console.log(
          "================================"
        );
        console.log("");

      }
    );


  } catch (error) {

    console.error(
      "❌ MongoDB connection failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);

  }

}


start();


/*
================================
GRACEFUL SHUTDOWN
================================
*/

process.on(
  "SIGTERM",
  async () => {

    await mongoose.connection.close();

    process.exit(0);

  }
);


process.on(
  "SIGINT",
  async () => {

    await mongoose.connection.close();

    process.exit(0);

  }
);
