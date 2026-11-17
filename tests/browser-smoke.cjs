const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { User } = require("../backend/src/models/user");
const { sequelize } = require("../backend/src/models/database");
const base = process.env.BASE_URL || "http://localhost:3000";
const email = `navegador-${randomUUID()}@example.com`;
const childEmail = `filho-${randomUUID()}@example.com`;
const password = "Teste-Navegador-123";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
  "base64",
);
const output = process.env.SCREENSHOT_DIR;
async function screenshot(page, name) {
  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, name), fullPage: true });
  }
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  function watch(target) {
    target.setDefaultTimeout(15000);
    target.on("pageerror", (error) => errors.push(error.message));
    target.on("console", (message) => {
      if (/Content Security Policy|violates.*directive/i.test(message.text()))
        errors.push(message.text());
    });
    target.on("dialog", (dialog) => dialog.accept());
  }
  watch(page);
  async function login(target, loginEmail, loginPassword = password) {
    await target.goto(`${base}/login`);
    await target.getByLabel("E-mail", { exact: true }).fill(loginEmail);
    await target.getByLabel("Senha", { exact: true }).fill(loginPassword);
    await target.getByRole("button", { name: "Entrar", exact: true }).click();
    await target
      .getByRole("heading", { name: "Seu dinheiro, com clareza." })
      .waitFor();
    await target
      .getByRole("status")
      .filter({ hasText: "Atualizando suas finanças" })
      .waitFor({ state: "hidden" });
  }
  async function category(target, name) {
    await target
      .getByRole("button", { name: "Categorias", exact: true })
      .click();
    await target
      .getByRole("button", { name: "+ Nova categoria", exact: true })
      .click();
    await target.getByLabel("Nome da categoria", { exact: true }).fill(name);
    await target
      .getByLabel("Descrição da categoria", { exact: true })
      .fill("Categoria criada no teste de navegador.");
    await target
      .getByRole("button", { name: "Salvar categoria", exact: true })
      .click();
    await target.getByRole("dialog").waitFor({ state: "hidden" });
    await target.getByRole("heading", { name, exact: true }).waitFor();
    await target
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
  }
  async function transaction(target, type, title, amount, withReceipt = false) {
    await target
      .getByRole("button", {
        name: type === "INCOME" ? "+ Nova receita" : "+ Nova despesa",
        exact: true,
      })
      .click();
    const dialog = target.getByRole("dialog");
    await dialog.getByLabel("Descrição", { exact: true }).fill(title);
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill(amount);
    await dialog.getByLabel("Data", { exact: true }).fill("2026-01-05");
    await dialog
      .getByLabel("Categoria", { exact: true })
      .selectOption({ index: 1 });
    await dialog
      .getByLabel("Observações", { exact: true })
      .fill(
        type === "EXPENSE"
          ? '<img src=x onerror="window.__xss=true">'
          : "Salário mensal.",
      );
    if (withReceipt)
      await dialog
        .getByLabel("Comprovante (opcional)", { exact: true })
        .setInputFiles({
          name: "cupom.png",
          mimeType: "image/png",
          buffer: png,
        });
    await dialog
      .getByRole("button", { name: "Salvar lançamento", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    await target.getByRole("row").filter({ hasText: title }).waitFor();
  }
  try {
    await page.goto(`${base}/register`);
    await page.getByLabel("Nome", { exact: true }).fill("Responsável de teste");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
    await page.waitForURL("**/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.match(page.url(), /\/login$/);
    console.log("OK: cadastro e feedback de login inválido");
    await login(page, email);
    await category(page, "Despesas e rendimentos");
    await transaction(page, "INCOME", "Salário teste", "100.10");
    await transaction(page, "EXPENSE", "Mercado teste", "25.50", true);
    await page
      .getByRole("region", { name: "Resumo financeiro" })
      .getByRole("heading", { name: /74,60/ })
      .waitFor();
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.equal(await page.locator('img[src="x"]').count(), 0);
    console.log(
      "OK: receitas, despesas, comprovante e saldo; texto XSS não executado",
    );
    const cookies = await context.cookies(`${base}/api`);
    assert.ok(
      cookies.find(
        (cookie) =>
          cookie.name === "ec_session" &&
          cookie.httpOnly &&
          cookie.sameSite === "Strict",
      ),
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("@ExpensesControl:token")),
      null,
    );
    await page.reload();
    await page.getByRole("row").filter({ hasText: "Mercado teste" }).waitFor();
    console.log(
      "OK: sessão em cookie protegido, sem token no localStorage, e persistência após recarga",
    );
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Baixar comprovante de Mercado teste",
        exact: true,
      })
      .click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "cupom.png");
    assert.equal(await download.failure(), null);
    console.log("OK: download autenticado de comprovante");
    await page
      .getByRole("button", { name: "Editar Mercado teste", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Valor (R$)", { exact: true })
      .fill("30.10");
    await page
      .getByRole("dialog")
      .getByLabel("Observações", { exact: true })
      .fill("Compra do mês com comprovante.");
    await page
      .getByRole("button", { name: "Salvar lançamento", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Resumo financeiro" })
      .getByRole("heading", { name: /70,00/ })
      .waitFor();
    await page
      .getByLabel("Tipo de lançamento", { exact: true })
      .selectOption("INCOME");
    await page
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await page
      .getByRole("row")
      .filter({ hasText: "Mercado teste" })
      .waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Limpar", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "Mercado teste" }).waitFor();
    console.log("OK: edição, recálculo e filtros");
    await screenshot(page, "dashboard.png");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await screenshot(page, "dashboard-mobile.png");
    await page.setViewportSize({ width: 1440, height: 1050 });
    console.log("OK: interface móvel sem transbordamento horizontal da página");
    await page.getByRole("button", { name: "Família", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Adicionar filho", exact: true })
      .click();
    await page
      .getByLabel("Nome do filho", { exact: true })
      .fill("Filho de teste");
    await page.getByLabel("E-mail do filho", { exact: true }).fill(childEmail);
    await page.getByLabel("Senha inicial", { exact: true }).fill(password);
    await page
      .getByRole("checkbox", { name: "Registrar despesas", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Salvar filho", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: /Filho de teste/ }).waitFor();
    await screenshot(page, "familia.png");
    const child = await User.findOne({ where: { email: childEmail } });
    const owner = await User.findOne({ where: { email } });
    await page
      .getByRole("button", {
        name: "Ver finanças de Filho de teste",
        exact: true,
      })
      .click();
    await category(page, "Gastos do filho");
    const childContext = await browser.newContext();
    const childPage = await childContext.newPage();
    watch(childPage);
    await login(childPage, childEmail);
    assert.equal(
      await childPage
        .getByRole("button", { name: "Família", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await childPage
        .getByRole("button", { name: "+ Nova receita", exact: true })
        .count(),
      0,
    );
    await transaction(childPage, "EXPENSE", "Lanche filho", "8.50");
    assert.equal(
      await childPage
        .getByRole("button", { name: "Editar Lanche filho", exact: true })
        .count(),
      0,
    );
    const forbidden = await childPage.evaluate(
      async (ownerId) =>
        (await fetch(`/api/transactions?accountId=${ownerId}`)).status,
      owner.id,
    );
    assert.equal(forbidden, 403);
    console.log(
      "OK: filho registra apenas funções permitidas e não acessa a conta do responsável",
    );
    await page.reload();
    await page
      .getByLabel("Conta em acompanhamento", { exact: true })
      .selectOption(child.id);
    await page.getByRole("row").filter({ hasText: "Lanche filho" }).waitFor();
    console.log("OK: responsável acompanha as finanças do filho");
    await page.getByRole("button", { name: "Família", exact: true }).click();
    await page.getByRole("button", { name: "Desativar", exact: true }).click();
    await page.getByText("Desativada", { exact: true }).waitFor();
    await childPage.reload();
    await childPage
      .getByRole("button", { name: "Entrar", exact: true })
      .waitFor();
    console.log("OK: desativação encerra a sessão do filho");
    await childContext.close();
    await page
      .getByRole("button", { name: "Minha conta", exact: true })
      .click();
    await page.getByLabel("Senha atual", { exact: true }).fill(password);
    await page
      .getByLabel("Nova senha", { exact: true })
      .fill("Senha-Nova-Segura-123");
    await page
      .getByRole("button", {
        name: "Alterar senha e encerrar sessões",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    await login(page, email, "Senha-Nova-Segura-123");
    await page
      .getByRole("button", { name: "Excluir Mercado teste", exact: true })
      .click();
    await page
      .getByRole("row")
      .filter({ hasText: "Mercado teste" })
      .waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    console.log("OK: alteração de senha, exclusão e logout");
    assert.deepEqual(errors, []);
    console.log("OK: nenhum erro JavaScript ou violação da CSP no navegador");
  } catch (error) {
    await screenshot(page, "falha.png");
    console.error((await page.locator("body").innerText()).slice(0, 5000));
    throw error;
  } finally {
    await browser.close();
    await User.destroy({ where: { email: childEmail } });
    await User.destroy({ where: { email } });
    await sequelize.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
