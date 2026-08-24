const express = require("express");

const Bot = require("../models/Bot");
const auth = require("../middleware/auth");

const router = express.Router();


/* =========================
   GET BOTS
========================= */

router.get("/", auth, async (req, res) => {

  try {

    const bots =
      await Bot.find({
        user: req.userId
      }).sort({
        createdAt: -1
      });

    res.json({
      bots
    });

  } catch (error) {

    console.error(
      "GET BOTS ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load bots."
    });
  }
});


/* =========================
   CREATE BOT
========================= */

router.post("/", auth, async (req, res) => {

  try {

    const {
      name,
      runtime,
      description,
      repository
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message:
          "Bot name is required."
      });
    }

    const bot =
      await Bot.create({
        user: req.userId,
        name: name.trim(),
        runtime:
          runtime || "Node.js",
        description:
          description || "",
        repository:
          repository || "",
        status: "offline"
      });

    res.status(201).json({
      message:
        "Bot created successfully.",
      bot
    });

  } catch (error) {

    console.error(
      "CREATE BOT ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to create bot."
    });
  }
});


/* =========================
   START
========================= */

router.post(
  "/:id/start",
  auth,
  async (req, res) => {

    try {

      const bot =
        await Bot.findOne({
          _id: req.params.id,
          user: req.userId
        });

      if (!bot) {
        return res.status(404).json({
          message:
            "Bot not found."
        });
      }

      bot.status = "running";
      bot.lastStartedAt = new Date();

      await bot.save();

      res.json({
        message:
          "Bot started.",
        bot
      });

    } catch (error) {

      console.error(
        "START BOT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to start bot."
      });
    }
  }
);


/* =========================
   STOP
========================= */

router.post(
  "/:id/stop",
  auth,
  async (req, res) => {

    try {

      const bot =
        await Bot.findOne({
          _id: req.params.id,
          user: req.userId
        });

      if (!bot) {
        return res.status(404).json({
          message:
            "Bot not found."
        });
      }

      bot.status = "stopped";
      bot.lastStoppedAt = new Date();

      await bot.save();

      res.json({
        message:
          "Bot stopped.",
        bot
      });

    } catch (error) {

      console.error(
        "STOP BOT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to stop bot."
      });
    }
  }
);


/* =========================
   RESTART
========================= */

router.post(
  "/:id/restart",
  auth,
  async (req, res) => {

    try {

      const bot =
        await Bot.findOne({
          _id: req.params.id,
          user: req.userId
        });

      if (!bot) {
        return res.status(404).json({
          message:
            "Bot not found."
        });
      }

      bot.status = "running";
      bot.lastStartedAt = new Date();

      await bot.save();

      res.json({
        message:
          "Bot restarted.",
        bot
      });

    } catch (error) {

      console.error(
        "RESTART BOT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to restart bot."
      });
    }
  }
);


/* =========================
   DELETE
========================= */

router.delete(
  "/:id",
  auth,
  async (req, res) => {

    try {

      const bot =
        await Bot.findOneAndDelete({
          _id: req.params.id,
          user: req.userId
        });

      if (!bot) {
        return res.status(404).json({
          message:
            "Bot not found."
        });
      }

      res.json({
        message:
          "Bot deleted successfully."
      });

    } catch (error) {

      console.error(
        "DELETE BOT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to delete bot."
      });
    }
  }
);


module.exports = router;
