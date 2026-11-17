const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");
const Receipt = sequelize.define(
  "receipt",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    expenseId: { type: DataTypes.UUID, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    mimeType: { type: DataTypes.STRING(40), allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    data: { type: DataTypes.BLOB("medium"), allowNull: false },
  },
  { defaultScope: { attributes: { exclude: ["data"] } } },
);
module.exports = { Receipt };
