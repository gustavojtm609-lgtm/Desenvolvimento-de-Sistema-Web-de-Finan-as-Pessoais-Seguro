require("./env");
const config = {
  username: process.env.MYSQL_USER || "expenses",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "expenses_control",
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  dialect: "mysql",
  logging: false,
  seederStorage: "sequelize",
};
module.exports = { development: config, test: config, production: config };
