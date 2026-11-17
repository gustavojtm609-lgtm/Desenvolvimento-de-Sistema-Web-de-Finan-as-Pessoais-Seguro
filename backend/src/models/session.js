const { DataTypes } = require("sequelize");
const { sequelize } = require("./database");
const Session = sequelize.define("session", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  userId: { type: DataTypes.UUID, allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  csrfToken: { type: DataTypes.STRING(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  lastSeenAt: { type: DataTypes.DATE, allowNull: false },
});
module.exports = { Session };
