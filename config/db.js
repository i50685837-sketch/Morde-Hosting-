const mongoose = require("mongoose");

async function connectDB() {

  try {

    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from .env"
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "✅ MongoDB Connected"
    );

  } catch (error) {

    console.error(
      "❌ MongoDB Connection Failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }

}

module.exports = connectDB;
