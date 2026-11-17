const { createHash } = require("node:crypto");
const { Session } = require("../models/session");
const { User } = require("../models/user");
const config = require("../config/security");
const { HttpError } = require("../lib/errors");
const { id } = require("../lib/schemas");
const hashToken = (value) => createHash("sha256").update(value).digest("hex");
async function authenticate(req, res, next) {
  const raw = req.cookies[config.cookieName];
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw))
    throw new HttpError(401, "Faça login para continuar.");
  const session = await Session.findOne({
    where: { tokenHash: hashToken(raw) },
    include: [{ model: User, as: "user" }],
  });
  const now = Date.now();
  if (
    !session ||
    !session.user?.active ||
    +session.expiresAt <= now ||
    now - +session.lastSeenAt > config.idleMs
  ) {
    if (session) await session.destroy();
    res.clearCookie(config.cookieName, config.cookieOptions);
    throw new HttpError(401, "Sua sessão expirou. Faça login novamente.");
  }
  req.user = session.user;
  req.session = session;
  await session.update({ lastSeenAt: new Date() });
  res.set("Cache-Control", "no-store");
  next();
}
function ownerOnly(req, res, next) {
  if (req.user.parentId)
    throw new HttpError(403, "Apenas o responsável pode gerenciar a família.");
  next();
}
async function accountScope(req, res, next) {
  const target =
    req.query.accountId === undefined
      ? req.user.id
      : id.parse(req.query.accountId);
  if (target !== req.user.id) {
    if (
      req.user.parentId ||
      !(await User.findOne({ where: { id: target, parentId: req.user.id } }))
    ) {
      throw new HttpError(403, "Você não tem acesso a esta conta.");
    }
  }
  req.accountId = target;
  next();
}
function requirePermission(permission) {
  return (req, res, next) => {
    if (
      req.user.parentId &&
      (!req.user.permissions?.viewFinance ||
        !req.user.permissions?.[permission])
    ) {
      throw new HttpError(
        403,
        "O responsável não liberou esta funcionalidade.",
      );
    }
    next();
  };
}
module.exports = {
  authenticate,
  ownerOnly,
  accountScope,
  requirePermission,
  hashToken,
};
