const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");
// A tabela original é preservada para migrar as despesas existentes.
const Transaction = sequelize.define("expense", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  type: {
    type: DataTypes.ENUM("INCOME", "EXPENSE"),
    allowNull: false,
    defaultValue: "EXPENSE",
  },
  categoryId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: "",
  },
  status: {
    type: DataTypes.ENUM("PENDENTE", "PAGA"),
    allowNull: false,
    defaultValue: "PENDENTE",
  },
});
module.exports = { Transaction };
