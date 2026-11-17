const { User } = require("../../models/user");
const { Category } = require("../../models/category");
module.exports = {
  async up() {
    const user = await User.findOne({
      where: { email: "admin@expensescontrol.com" },
    });
    if (!user) throw new Error("Crie primeiro a conta de demonstração.");
    for (const [name, description] of [
      ["Alimentação", "Mercado e refeições."],
      ["Transporte", "Deslocamentos e manutenção."],
      ["Rendimentos", "Salário e outras receitas."],
    ]) {
      await Category.findOrCreate({
        where: { userId: user.id, name },
        defaults: { description },
      });
    }
  },
  async down() {
    const user = await User.findOne({
      where: { email: "admin@expensescontrol.com" },
    });
    if (user) await Category.destroy({ where: { userId: user.id } });
  },
};
