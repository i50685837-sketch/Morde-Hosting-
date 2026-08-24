const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {

  try {

    const header =
      req.headers.authorization;

    if (!header) {

      return res.status(401).json({
        message:
          "Authentication required."
      });

    }

    const [type, token] =
      header.split(" ");

    if (
      type !== "Bearer" ||
      !token
    ) {

      return res.status(401).json({
        message:
          "Invalid authorization format."
      });

    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    req.userId =
      decoded.userId;

    next();

  } catch (error) {

    return res.status(401).json({
      message:
        "Invalid or expired token."
    });

  }

};
