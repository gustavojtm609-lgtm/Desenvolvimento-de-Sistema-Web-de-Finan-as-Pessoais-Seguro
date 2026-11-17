const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");
const User = sequelize.define(
  "user",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: "user" },
    parentId: { type: DataTypes.UUID, allowNull: true },
    permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { defaultScope: { attributes: { exclude: ["password"] } } },
);
module.exports = { User };
