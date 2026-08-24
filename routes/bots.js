// routes/bots.js

const express = require("express");
const router = express.Router();

const Bot = require("../models/Bot");

// Change this path if your auth middleware has a different name.
const auth = require("../middleware/auth");


/* =========================================================
   CREATE BOT / DEPLOYMENT
   POST /api/bots
========================================================= */

router.post("/", auth, async (req, res) => {

  try {

    const {
      name,
      sessionId,
      phoneNumber,
      repository,
      branch,
      startCommand,
      environmentVariables
    } = req.body;


    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!name || name.trim().length < 2) {

      return res.status(400).json({
        message: "Bot name is required."
      });

    }


    if (!sessionId || sessionId.trim().length < 3) {

      return res.status(400).json({
        message: "Session ID is required."
      });

    }


    if (!phoneNumber || phoneNumber.trim().length < 7) {

      return res.status(400).json({
        message: "Phone number is required."
      });

    }


    if (!repository) {

      return res.status(400).json({
        message: "GitHub repository is required."
      });

    }


    /* -----------------------------------------------------
       BASIC REPOSITORY VALIDATION
    ----------------------------------------------------- */

    let repoUrl;

    try {

      repoUrl = new URL(repository);

    } catch {

      return res.status(400).json({
        message: "Invalid repository URL."
      });

    }


    if (
      repoUrl.protocol !== "https:" ||
      !repoUrl.hostname.includes("github.com")
    ) {

      return res.status(400).json({
        message: "Repository must be a valid GitHub HTTPS URL."
      });

    }


    /* -----------------------------------------------------
       ENVIRONMENT VARIABLES
    ----------------------------------------------------- */

    let env = {};

    if (
      environmentVariables &&
      typeof environmentVariables === "object" &&
      !Array.isArray(environmentVariables)
    ) {

      env = environmentVariables;

    }


    /*
      Prevent obviously invalid environment-variable names.
    */

    const cleanedEnv = {};

    for (const [key, value] of Object.entries(env)) {

      const cleanKey = String(key).trim();

      if (!cleanKey) {
        continue;
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanKey)) {

        return res.status(400).json({
          message:
            `Invalid environment variable name: ${cleanKey}`
        });

      }

      cleanedEnv[cleanKey] =
        String(value ?? "");

    }


    /* -----------------------------------------------------
       CHECK DUPLICATE BOT
    ----------------------------------------------------- */

    const existingBot =
      await Bot.findOne({
        owner: req.user._id,
        name: name.trim()
      });


    if (existingBot) {

      return res.status(409).json({
        message:
          "You already have a bot with this name."
      });

    }


    /* -----------------------------------------------------
       CREATE BOT
    ----------------------------------------------------- */

    const bot =
      await Bot.create({

        owner:
          req.user._id,

        name:
          name.trim(),

        sessionId:
          sessionId.trim(),

        phoneNumber:
          phoneNumber.trim(),

        repository:
          repository.trim(),

        branch:
          branch?.trim() || "main",

        startCommand:
          startCommand?.trim() || "npm start",

        environmentVariables:
          cleanedEnv,

        status:
          "deploying"

      });


    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(201).json({

      success: true,

      message:
        "Bot deployment created successfully.",

      bot: {

        id:
          bot._id,

        name:
          bot.name,

        status:
          bot.status,

        repository:
          bot.repository,

        branch:
          bot.branch

      }

    });


  } catch (error) {

    console.error(
      "CREATE BOT ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Unable to create bot deployment."

    });

  }

});


/* =========================================================
   GET ALL USER BOTS
   GET /api/bots
========================================================= */

router.get("/", auth, async (req, res) => {

  try {

    const bots =
      await Bot.find({
        owner: req.user._id
      })
      .sort({
        createdAt: -1
      })
      .select(
        "-environmentVariables"
      );


    return res.json({

      success: true,

      bots

    });


  } catch (error) {

    console.error(
      "GET BOTS ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Unable to load bots."

    });

  }

});


/* =========================================================
   GET SINGLE BOT
   GET /api/bots/:id
========================================================= */

router.get("/:id", auth, async (req, res) => {

  try {

    const bot =
      await Bot.findOne({

        _id:
          req.params.id,

        owner:
          req.user._id

      });


    if (!bot) {

      return res.status(404).json({

        message:
          "Bot not found."

      });

    }


    return res.json({

      success: true,

      bot

    });


  } catch (error) {

    console.error(
      "GET BOT ERROR:",
      error
    );


    return res.status(500).json({

      message:
        "Unable to load bot."

    });

  }

});


/* =========================================================
   UPDATE BOT
   PUT /api/bots/:id
========================================================= */

router.put("/:id", auth, async (req, res) => {

  try {

    const {
      name,
      branch,
      startCommand,
      phoneNumber,
      environmentVariables
    } = req.body;


    const bot =
      await Bot.findOne({

        _id:
          req.params.id,

        owner:
          req.user._id

      });


    if (!bot) {

      return res.status(404).json({

        message:
          "Bot not found."

      });

    }


    if (name !== undefined) {

      if (
        typeof name !== "string" ||
        name.trim().length < 2
      ) {

        return res.status(400).json({

          message:
            "Invalid bot name."

        });

      }

      bot.name =
        name.trim();

    }


    if (branch !== undefined) {

      bot.branch =
        String(branch).trim() ||
        "main";

    }


    if (startCommand !== undefined) {

      bot.startCommand =
        String(startCommand).trim() ||
        "npm start";

    }


    if (phoneNumber !== undefined) {

      bot.phoneNumber =
        String(phoneNumber).trim();

    }


    if (
      environmentVariables !== undefined
    ) {

      if (
        typeof environmentVariables !== "object" ||
        Array.isArray(environmentVariables)
      ) {

        return res.status(400).json({

          message:
            "Invalid environment variables."

        });

      }


      bot.environmentVariables =
        environmentVariables;

    }


    await bot.save();


    return res.json({

      success: true,

      message:
        "Bot updated successfully.",

      bot

    });


  } catch (error) {

    console.error(
      "UPDATE BOT ERROR:",
      error
    );


    return res.status(500).json({

      message:
        "Unable to update bot."

    });

  }

});


/* =========================================================
   DELETE BOT
   DELETE /api/bots/:id
========================================================= */

router.delete("/:id", auth, async (req, res) => {

  try {

    const bot =
      await Bot.findOne({

        _id:
          req.params.id,

        owner:
          req.user._id

      });


    if (!bot) {

      return res.status(404).json({

        message:
          "Bot not found."

      });

    }


    await bot.deleteOne();


    return res.json({

      success: true,

      message:
        "Bot deleted successfully."

    });


  } catch (error) {

    console.error(
      "DELETE BOT ERROR:",
      error
    );


    return res.status(500).json({

      message:
        "Unable to delete bot."

    });

  }

});


/* =========================================================
   STOP BOT
   POST /api/bots/:id/stop
========================================================= */

router.post("/:id/stop", auth, async (req, res) => {

  try {

    const bot =
      await Bot.findOne({

        _id:
          req.params.id,

        owner:
          req.user._id

      });


    if (!bot) {

      return res.status(404).json({

        message:
          "Bot not found."

      });

    }


    bot.status =
      "stopped";


    await bot.save();


    return res.json({

      success: true,

      message:
        "Bot stopped.",

      bot

    });


  } catch (error) {

    console.error(
      "STOP BOT ERROR:",
      error
    );


    return res.status(500).json({

      message:
        "Unable to stop bot."

    });

  }

});


/* =========================================================
   START BOT
   POST /api/bots/:id/start
========================================================= */

router.post("/:id/start", auth, async (req, res) => {

  try {

    const bot =
      await Bot.findOne({

        _id:
          req.params.id,

        owner:
          req.user._id

      });


    if (!bot) {

      return res.status(404).json({

        message:
          "Bot not found."

      });

    }


    bot.status =
      "running";


    await bot.save();


    return res.json({

      success: true,

      message:
        "Bot started.",

      bot

    });


  } catch (error) {

    console.error(
      "START BOT ERROR:",
      error
    );


    return res.status(500).json({

      message:
        "Unable to start bot."

    });

  }

});


module.exports = router;
