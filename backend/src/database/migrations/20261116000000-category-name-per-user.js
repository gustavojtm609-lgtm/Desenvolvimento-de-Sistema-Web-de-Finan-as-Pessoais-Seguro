"use strict";

// Alinha o banco ao índice composto já definido no model Category.
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex("categories");
    for (const index of indexes) {
      if (
        index.unique &&
        !index.primary &&
        index.fields.length === 1 &&
        index.fields[0].attribute === "name"
      ) {
        await queryInterface.removeIndex("categories", index.name);
      }
    }
    if (!indexes.some((index) => index.name === "user_category_name")) {
      await queryInterface.addIndex("categories", ["name", "userId"], {
        name: "user_category_name",
        unique: true,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("categories", "user_category_name");
    await queryInterface.addIndex("categories", ["name"], {
      name: "name",
      unique: true,
    });
  },
};
