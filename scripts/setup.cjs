const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const target = path.join(root, ".env");
if (fs.existsSync(target)) {
  console.log(".env já existe; configurações preservadas.");
} else {
  const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  fs.writeFileSync(
    target,
    example
      .replace("GERAR_SENHA_MYSQL", randomBytes(24).toString("hex"))
      .replace("GERAR_SENHA_ROOT", randomBytes(24).toString("hex")),
    { flag: "wx", mode: 0o600 },
  );
  console.log(".env criado com senhas exclusivas para o MySQL.");
}
