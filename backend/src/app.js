require("./config/env");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("node:fs");
const path = require("node:path");
const { ZodError } = require("zod");
const { UniqueConstraintError, ValidationError } = require("sequelize");
const { MulterError } = require("multer");
const { sequelize } = require("./models/database");
const { authenticate } = require("./middleware/auth");
const { originGuard, csrfGuard, apiLimiter } = require("./middleware/security");
const config = require("./config/security");
require("./models/associations");
const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.cookieOptions.secure ? [] : null,
      },
    },
    strictTransportSecurity: config.cookieOptions.secure ? undefined : false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);
app.use(
  "/api",
  cors({
    origin(origin, callback) {
      callback(null, !origin || config.origins.includes(origin));
    },
    credentials: true,
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", apiLimiter, originGuard);
app.use(express.json({ limit: "32kb", strict: true }));
app.use(cookieParser());
app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "online", database: "connected" });
  } catch {
    res.status(503).json({ status: "offline" });
  }
});
app.use("/api", require("./routes/auth"));
app.use("/api", authenticate, csrfGuard);
app.use("/api/family", require("./routes/family"));
app.use("/api", require("./routes/finance"));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Rota da API não encontrada." }),
);
const dist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist, { index: false }));
  app.get("/{*path}", (req, res, next) => {
    if (path.extname(req.path)) return next();
    res
      .set("Cache-Control", "no-cache")
      .sendFile(path.join(dist, "index.html"));
  });
} else
  app.get("/", (req, res) =>
    res.json({
      projeto: "Expenses Control",
      interface: "http://localhost:5173",
    }),
  );
app.use((req, res) =>
  res.status(404).json({ error: "Recurso não encontrado." }),
);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError)
    return res
      .status(400)
      .json({
        error: "Confira os dados enviados.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
  if (error instanceof UniqueConstraintError)
    return res
      .status(409)
      .json({ error: "Já existe um cadastro com esses dados nesta conta." });
  if (error instanceof MulterError)
    return res
      .status(400)
      .json({
        error:
          "Envie somente um comprovante de até 5 MB, sem campos adicionais.",
      });
  if (error instanceof ValidationError)
    return res
      .status(400)
      .json({ error: "Dados inválidos para este cadastro." });
  const status = error.status || 500;
  if (status >= 500) console.error("Falha interna:", error.name);
  res
    .status(status)
    .json({
      error:
        status >= 500
          ? "Não foi possível concluir a operação."
          : error.type === "entity.parse.failed"
            ? "JSON inválido."
            : error.message,
    });
});
async function main() {
  try {
    await sequelize.authenticate();
    const port = Number(process.env.PORT || 3000);
    app.listen(port, "0.0.0.0", () =>
      console.log(`Expenses Control: http://localhost:${port}`),
    );
  } catch (error) {
    console.error(
      "Falha ao iniciar. Confira o MySQL e execute npm run db:migrate:",
      error.message,
    );
    await sequelize.close();
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = app;
