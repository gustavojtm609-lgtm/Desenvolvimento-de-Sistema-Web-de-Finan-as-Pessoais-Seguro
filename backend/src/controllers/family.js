const bcrypt = require("bcrypt");
const { User } = require("../models/user");
const { Session } = require("../models/session");
const { sequelize } = require("../models/database");
const { publicUser } = require("./auth");
const { HttpError } = require("../lib/errors");
async function list(req, res) {
  const children = await User.findAll({
    where: { parentId: req.user.id },
    order: [["name", "ASC"]],
  });
  res.json(children.map(publicUser));
}
async function create(req, res) {
  const { name, email, password, permissions } = req.input.body;
  const child = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    permissions,
    parentId: req.user.id,
    role: "child",
    active: true,
  });
  res.status(201).json(publicUser(child));
}
async function update(req, res) {
  const { name, permissions, active, password } = req.input.body;
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (permissions !== undefined) changes.permissions = permissions;
  if (active !== undefined) changes.active = active;
  if (password !== undefined)
    changes.password = await bcrypt.hash(password, 12);
  const child = await sequelize.transaction(async (transaction) => {
    const row = await User.findOne({
      where: { id: req.input.params.id, parentId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new HttpError(404, "Conta de filho não encontrada.");
    await row.update(changes, { transaction });
    if (active === false || password !== undefined)
      await Session.destroy({ where: { userId: row.id }, transaction });
    return row;
  });
  res.json(publicUser(child));
}
module.exports = { list, create, update };
