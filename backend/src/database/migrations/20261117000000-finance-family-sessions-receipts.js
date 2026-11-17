module.exports = {
  async up(q, S) {
    await q.addColumn("users", "parentId", {
      type: S.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    await q.addColumn("users", "permissions", {
      type: S.JSON,
      allowNull: true,
    });
    await q.addColumn("users", "active", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await q.addColumn("expenses", "type", {
      type: S.ENUM("INCOME", "EXPENSE"),
      allowNull: false,
      defaultValue: "EXPENSE",
    });
    await q.changeColumn("expenses", "amount", {
      type: S.DECIMAL(12, 2),
      allowNull: false,
    });
    await q.addIndex("expenses", ["userId", "date", "type"], {
      name: "finance_history",
    });
    const timestamps = {
      createdAt: { type: S.DATE, allowNull: false },
      updatedAt: { type: S.DATE, allowNull: false },
    };
    await q.createTable("sessions", {
      id: { type: S.UUID, primaryKey: true, allowNull: false },
      userId: {
        type: S.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      tokenHash: { type: S.STRING(64), unique: true, allowNull: false },
      csrfToken: { type: S.STRING(64), allowNull: false },
      expiresAt: { type: S.DATE, allowNull: false },
      lastSeenAt: { type: S.DATE, allowNull: false },
      ...timestamps,
    });
    await q.addIndex("sessions", ["expiresAt"]);
    await q.createTable("receipts", {
      id: { type: S.UUID, primaryKey: true, allowNull: false },
      expenseId: {
        type: S.UUID,
        unique: true,
        allowNull: false,
        references: { model: "expenses", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      name: { type: S.STRING(120), allowNull: false },
      mimeType: { type: S.STRING(40), allowNull: false },
      size: { type: S.INTEGER, allowNull: false },
      data: { type: S.BLOB("medium"), allowNull: false },
      ...timestamps,
    });
  },
  async down(q, S) {
    await q.dropTable("receipts");
    await q.dropTable("sessions");
    await q.removeIndex("expenses", "finance_history");
    await q.removeColumn("expenses", "type");
    await q.changeColumn("expenses", "amount", {
      type: S.FLOAT,
      allowNull: false,
    });
    await q.removeColumn("users", "active");
    await q.removeColumn("users", "permissions");
    await q.removeColumn("users", "parentId");
  },
};
