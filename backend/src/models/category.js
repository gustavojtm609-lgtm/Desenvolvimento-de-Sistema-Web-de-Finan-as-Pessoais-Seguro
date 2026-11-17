const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");
const Category = sequelize.define(
  "category",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: { type: DataTypes.STRING(80), allowNull: false },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    userId: { type: DataTypes.UUID, allowNull: false },
  },
  {
    indexes: [
      { unique: true, fields: ["name", "userId"], name: "user_category_name" },
    ],
  },
);
module.exports = { Category };
