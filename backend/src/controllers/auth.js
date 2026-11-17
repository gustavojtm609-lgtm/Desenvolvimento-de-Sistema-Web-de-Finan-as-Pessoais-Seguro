const bcrypt = require("bcrypt");
const { randomBytes } = require("node:crypto");
const { Op } = require("sequelize");
const { User } = require("../models/user");
const { Session } = require("../models/session");
const { sequelize } = require("../models/database");
const { hashToken } = require("../middleware/auth");
const config = require("../config/security");
const { ownerPermissions, childPermissions } = require("../lib/schemas");
const { HttpError } = require("../lib/errors");
const dummyHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isChild: Boolean(user.parentId),
    active: user.active,
    permissions: user.parentId
      ? { ...childPermissions, ...user.permissions }
      : ownerPermissions,
  };
}
async function register(req, res) {
  const { name, email, password } = req.input.body;
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "user",
    parentId: null,
    permissions: {},
    active: true,
  });
  res.status(201).json({ user: publicUser(user) });
}
async function login(req, res) {
  const { email, password } = req.input.body;
  const user = await User.unscoped().findOne({ where: { email } });
  const valid = await bcrypt.compare(password, user?.password || dummyHash);
  if (!user || !valid || !user.active)
    throw new HttpError(401, "E-mail ou senha inválidos, ou conta desativada.");
  const raw = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + config.sessionMs);
  await sequelize.transaction(async (transaction) => {
    const previous = req.cookies[config.cookieName];
    if (typeof previous === "string")
      await Session.destroy({
        where: { tokenHash: hashToken(previous) },
        transaction,
      });
    await Session.destroy({
      where: { expiresAt: { [Op.lt]: new Date() } },
      transaction,
    });
    await Session.create(
      {
        userId: user.id,
        tokenHash: hashToken(raw),
        csrfToken,
        expiresAt,
        lastSeenAt: new Date(),
      },
      { transaction },
    );
  });
  res.cookie(config.cookieName, raw, {
    ...config.cookieOptions,
    maxAge: config.sessionMs,
  });
  res.json({ user: publicUser(user), csrfToken });
}
async function current(req, res) {
  res.json({ user: publicUser(req.user), csrfToken: req.session.csrfToken });
}
async function logout(req, res) {
  await req.session.destroy();
  res.clearCookie(config.cookieName, config.cookieOptions);
  res.status(204).end();
}
async function changePassword(req, res) {
  const user = await User.unscoped().findByPk(req.user.id);
  if (!(await bcrypt.compare(req.input.body.currentPassword, user.password)))
    throw new HttpError(400, "Senha atual incorreta.");
  const hashed = await bcrypt.hash(req.input.body.newPassword, 12);
  await sequelize.transaction(async (transaction) => {
    await User.update(
      { password: hashed },
      { where: { id: user.id }, transaction },
    );
    await Session.destroy({ where: { userId: user.id }, transaction });
  });
  res.clearCookie(config.cookieName, config.cookieOptions);
  res.status(204).end();
}
module.exports = {
  publicUser,
  register,
  login,
  current,
  logout,
  changePassword,
};
