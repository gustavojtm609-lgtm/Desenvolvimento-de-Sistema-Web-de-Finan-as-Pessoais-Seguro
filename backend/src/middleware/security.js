const { timingSafeEqual, createHash } = require("node:crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("../config/security");
const { HttpError } = require("../lib/errors");
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
function originGuard(req, res, next) {
  if (safeMethods.has(req.method)) return next();
  if (
    !config.origins.includes(req.get("Origin")) ||
    req.get("Sec-Fetch-Site") === "cross-site"
  ) {
    throw new HttpError(403, "Origem da requisição não autorizada.");
  }
  next();
}
function csrfGuard(req, res, next) {
  if (safeMethods.has(req.method)) return next();
  const token = req.get("X-CSRF-Token") || "";
  const expected = req.session.csrfToken;
  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    throw new HttpError(
      403,
      "Token CSRF ausente ou inválido. Atualize a página.",
    );
  }
  next();
}
const options = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  },
};
const apiLimiter = rateLimit({
  ...options,
  windowMs: 15 * 60 * 1000,
  limit: 300,
});
const loginLimiter = rateLimit({
  ...options,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${createHash("sha256")
      .update(
        (typeof req.body?.email === "string" ? req.body.email : "")
          .trim()
          .toLowerCase(),
      )
      .digest("hex")}`,
});
const registrationLimiter = rateLimit({
  ...options,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});
module.exports = {
  originGuard,
  csrfGuard,
  apiLimiter,
  loginLimiter,
  registrationLimiter,
};
