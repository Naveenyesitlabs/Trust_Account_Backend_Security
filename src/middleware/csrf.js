const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const normalizeOrigin = (value = "") => {
  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
};

const csrf = ({ allowedOrigins = new Set(), isLocalOrigin = () => false } = {}) => {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const requestOrigin = normalizeOrigin(req.headers.origin || req.headers.referer || "");
    if (!requestOrigin) {
      return next();
    }

    if (allowedOrigins.has(requestOrigin) || isLocalOrigin(requestOrigin)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      status: 403,
      message: "CSRF validation failed",
    });
  };
};

module.exports = csrf;
