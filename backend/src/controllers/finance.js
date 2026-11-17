const { Op, fn, col } = require("sequelize");
const { sequelize } = require("../models/database");
const { Transaction } = require("../models/expense");
const { Category } = require("../models/category");
const { Receipt } = require("../models/receipt");
const { HttpError } = require("../lib/errors");
const includes = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  {
    model: Receipt,
    as: "receipt",
    attributes: ["id", "name", "mimeType", "size"],
  },
];
async function findTransaction(req, transaction) {
  const row = await Transaction.findOne({
    where: { id: req.input.params.id, userId: req.accountId },
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!row) throw new HttpError(404, "Lançamento não encontrado.");
  return row;
}
function whereFromFilters(userId, filters) {
  const where = { userId };
  for (const key of ["type", "status", "categoryId"])
    if (filters[key]) where[key] = filters[key];
  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined)
      where.amount[Op.gte] = filters.minAmount;
    if (filters.maxAmount !== undefined)
      where.amount[Op.lte] = filters.maxAmount;
  }
  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate)
      where.date[Op.gte] = new Date(`${filters.startDate}T00:00:00.000Z`);
    if (filters.endDate) {
      const nextDay = new Date(`${filters.endDate}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.date[Op.lt] = nextDay;
    }
  }
  return where;
}
function checkTypePermission(req, type) {
  const permission = type === "INCOME" ? "createIncome" : "createExpense";
  if (
    req.user.parentId &&
    (!req.user.permissions?.viewFinance || !req.user.permissions?.[permission])
  ) {
    throw new HttpError(
      403,
      "O responsável não liberou este tipo de lançamento.",
    );
  }
}
async function ownedCategory(req, categoryId, transaction) {
  const category = await Category.findOne({
    where: { id: categoryId, userId: req.accountId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!category)
    throw new HttpError(404, "Categoria não encontrada nesta conta.");
}
async function list(req, res) {
  const { page, pageSize } = req.input.query;
  const { rows, count } = await Transaction.findAndCountAll({
    where: whereFromFilters(req.accountId, req.input.query),
    include: includes,
    distinct: true,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [
      ["date", "DESC"],
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ],
  });
  res.json({
    items: rows,
    total: count,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(count / pageSize)),
  });
}
async function create(req, res) {
  const { title, amount, type, categoryId, date, description, status } =
    req.input.body;
  checkTypePermission(req, type);
  const row = await sequelize.transaction(async (transaction) => {
    await ownedCategory(req, categoryId, transaction);
    return Transaction.create(
      {
        userId: req.accountId,
        title,
        amount,
        type,
        categoryId,
        date: `${date}T00:00:00.000Z`,
        description,
        status,
      },
      { transaction },
    );
  });
  res.status(201).json(row);
}
async function update(req, res) {
  const { title, amount, type, categoryId, date, description, status } =
    req.input.body;
  const row = await sequelize.transaction(async (transaction) => {
    await ownedCategory(req, categoryId, transaction);
    const existing = await findTransaction(req, transaction);
    if (existing.type !== type) checkTypePermission(req, type);
    return existing.update(
      {
        title,
        amount,
        type,
        categoryId,
        date: `${date}T00:00:00.000Z`,
        description,
        status,
      },
      { transaction },
    );
  });
  res.json(row);
}
async function remove(req, res) {
  const row = await findTransaction(req);
  await row.destroy();
  res.status(204).end();
}
// Converte strings DECIMAL para centavos inteiros antes de calcular saldos.
const cents = (value) => {
  const [whole, fraction = ""] = String(value || "0").split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
};
const money = (value) => {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
};
async function summary(req, res) {
  const where = whereFromFilters(req.accountId, req.input.query);
  const groups = await Transaction.findAll({
    where,
    attributes: ["type", "status", [fn("SUM", col("amount")), "total"]],
    group: ["type", "status"],
    raw: true,
  });
  const totals = {
    INCOME: { PAGA: 0n, PENDENTE: 0n },
    EXPENSE: { PAGA: 0n, PENDENTE: 0n },
  };
  for (const row of groups) totals[row.type][row.status] = cents(row.total);
  const income = totals.INCOME.PAGA;
  const expenses = totals.EXPENSE.PAGA;
  const byCategory = await Transaction.findAll({
    where,
    attributes: ["categoryId", "type", [fn("SUM", col("amount")), "total"]],
    include: [{ model: Category, as: "category", attributes: ["name"] }],
    group: ["categoryId", "type", "category.id", "category.name"],
    order: [[fn("SUM", col("amount")), "DESC"]],
  });
  res.json({
    income: money(income),
    expenses: money(expenses),
    balance: money(income - expenses),
    pendingIncome: money(totals.INCOME.PENDENTE),
    pendingExpenses: money(totals.EXPENSE.PENDENTE),
    projectedBalance: money(
      income + totals.INCOME.PENDENTE - expenses - totals.EXPENSE.PENDENTE,
    ),
    byCategory,
  });
}
async function listCategories(req, res) {
  res.json(
    await Category.findAll({
      where: { userId: req.accountId },
      order: [["name", "ASC"]],
    }),
  );
}
async function createCategory(req, res) {
  const { name, description } = req.input.body;
  res
    .status(201)
    .json(await Category.create({ name, description, userId: req.accountId }));
}
async function updateCategory(req, res) {
  const row = await Category.findOne({
    where: { id: req.input.params.id, userId: req.accountId },
  });
  if (!row) throw new HttpError(404, "Categoria não encontrada.");
  const { name, description } = req.input.body;
  res.json(await row.update({ name, description }));
}
async function removeCategory(req, res) {
  await sequelize.transaction(async (transaction) => {
    const row = await Category.findOne({
      where: { id: req.input.params.id, userId: req.accountId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new HttpError(404, "Categoria não encontrada.");
    if (await Transaction.count({ where: { categoryId: row.id }, transaction }))
      throw new HttpError(
        409,
        "Exclua ou recategorize os lançamentos antes de excluir a categoria.",
      );
    await row.destroy({ transaction });
  });
  res.status(204).end();
}
module.exports = {
  list,
  create,
  update,
  remove,
  summary,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  findTransaction,
};
