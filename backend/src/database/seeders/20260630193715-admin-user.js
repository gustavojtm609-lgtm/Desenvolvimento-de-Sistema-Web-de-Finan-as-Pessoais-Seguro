const bcrypt = require("bcrypt");
const { User } = require("../../models/user");
const { password } = require("../../lib/schemas");
module.exports = {
  async up() {
    if (await User.findOne({ where: { email: "admin@expensescontrol.com" } }))
      return;
    const plain = password.parse(process.env.DEMO_PASSWORD);
    await User.create({
      name: "Conta de demonstração",
      email: "admin@expensescontrol.com",
      password: await bcrypt.hash(plain, 12),
      role: "user",
      active: true,
      permissions: {},
    });
  },
  async down() {
    await User.destroy({ where: { email: "admin@expensescontrol.com" } });
  },
};
