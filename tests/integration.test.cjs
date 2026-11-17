const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const app = require("../backend/src/app");
const { User } = require("../backend/src/models/user");
const { Session } = require("../backend/src/models/session");
const { Receipt } = require("../backend/src/models/receipt");
const { sequelize } = require("../backend/src/models/database");
const { childPermissions } = require("../backend/src/lib/schemas");
const bcrypt = require("bcrypt");

// O teste usa registros exclusivos e os apaga ao final. Execute em banco de teste.
test("Finanças, família e segurança com MySQL real", async (t) => {
  await sequelize.authenticate();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const emails = [];
  const password = "Teste-Seguro-12345";
  const origin = "http://localhost:3000";
  const userData = (label) => {
    const email = `${label}-${randomUUID()}@example.com`;
    emails.push(email);
    return { name: `Teste ${label}`, email, password };
  };
  const owner = { data: userData("responsavel") },
    stranger = { data: userData("outra-conta") };
  const child = { data: userData("filho") };
  let category, otherCategory, expense, income, childCategory, childExpense;
  let capturedCookie;
  const day = "2026-01-05";
  const fixture = {
    title: "Mercado",
    amount: "25.50",
    type: "EXPENSE",
    date: day,
    description: "",
    status: "PAGA",
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
    "base64",
  );
  async function call(actor, method, route, body, options = {}) {
    const headers = {
      Origin: origin,
      ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
      ...(actor?.csrf ? { "X-CSRF-Token": actor.csrf } : {}),
      ...options.headers,
    };
    if (body && !(body instanceof FormData))
      headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      ...(body
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
    const data = options.binary
      ? Buffer.from(await response.arrayBuffer())
      : response.status === 204
        ? null
        : await response.json();
    return { status: response.status, data, response };
  }
  async function login(actor) {
    const result = await call(null, "POST", "/api/auth/login", {
      email: actor.data.email,
      password: actor.data.password,
    });
    assert.equal(result.status, 200);
    actor.cookie = result.response.headers.get("set-cookie").split(";")[0];
    actor.csrf = result.data.csrfToken;
    actor.id = result.data.user.id;
    return result;
  }
  function uploadBody(data, name, type) {
    const body = new FormData();
    body.append("receipt", new Blob([data], { type }), name);
    return body;
  }
  try {
    await t.test(
      "health, CSP, anti-iframe, nosniff e cache privado",
      async () => {
        const health = await call(null, "GET", "/api/health");
        assert.equal(health.status, 200);
        assert.equal(health.data.database, "connected");
        const csp = health.response.headers.get("content-security-policy");
        assert.match(csp, /script-src 'self'/);
        assert.match(csp, /object-src 'none'/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
        assert.equal(
          health.response.headers.get("x-content-type-options"),
          "nosniff",
        );
        assert.equal(health.response.headers.get("cache-control"), "no-store");
        assert.equal(health.response.headers.get("x-powered-by"), null);
      },
    );
    await t.test(
      "cadastro valida senha e rejeita mass assignment",
      async () => {
        const injection = {
          ...owner.data,
          role: "admin",
          parentId: randomUUID(),
          permissions: { viewFinance: true },
        };
        assert.equal(
          (await call(null, "POST", "/api/users", injection)).status,
          400,
        );
        assert.equal(
          (
            await call(null, "POST", "/api/users", {
              ...owner.data,
              password: "123",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call(null, "POST", "/api/users", {
              ...owner.data,
              email: "' OR 1=1 --",
            })
          ).status,
          400,
        );
        for (const actor of [owner, stranger]) {
          const created = await call(null, "POST", "/api/users", actor.data);
          assert.equal(created.status, 201);
          assert.equal(created.data.user.isChild, false);
          assert.equal(created.data.user.password, undefined);
          const stored = await User.unscoped().findByPk(created.data.user.id);
          assert.notEqual(stored.password, password);
          assert.ok(await bcrypt.compare(password, stored.password));
        }
      },
    );
    await t.test(
      "login cria cookie HttpOnly/SameSite, sessão revogável e hash no banco",
      async () => {
        const result = await login(owner);
        await login(stranger);
        const cookie = result.response.headers.get("set-cookie");
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.match(cookie, /Path=\/api/i);
        assert.equal(result.data.token, undefined);
        const raw = owner.cookie.split("=")[1];
        const session = await Session.findOne({ where: { userId: owner.id } });
        assert.notEqual(session.tokenHash, raw);
        assert.equal(session.tokenHash.length, 64);
        const current = await call(owner, "GET", "/api/auth/session");
        assert.equal(current.data.user.id, owner.id);
        assert.equal(current.data.csrfToken, owner.csrf);
      },
    );
    await t.test(
      "CSRF, origem indevida e login CSRF são bloqueados",
      async () => {
        assert.equal(
          (
            await call(
              owner,
              "POST",
              "/api/categories",
              { name: "Bloqueado" },
              { headers: { "X-CSRF-Token": "" } },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              "/api/categories",
              { name: "Bloqueado" },
              { headers: { "X-CSRF-Token": "é".repeat(64) } },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              "/api/categories",
              { name: "Bloqueado" },
              { headers: { Origin: "https://site-invasor.example" } },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              "/api/categories",
              { name: "Bloqueado" },
              { headers: { Origin: "" } },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(null, "POST", "/api/auth/login", owner.data, {
              headers: { Origin: "https://site-invasor.example" },
            })
          ).status,
          403,
        );
        const deniedCors = await call(owner, "GET", "/api/auth/session", null, {
          headers: { Origin: "https://site-invasor.example" },
        });
        assert.equal(
          deniedCors.response.headers.get("access-control-allow-origin"),
          null,
        );
      },
    );
    await t.test(
      "categorias isoladas por conta e nomes iguais entre contas",
      async () => {
        const name = `Categoria ${randomUUID()}`;
        category = await call(owner, "POST", "/api/categories", { name });
        assert.equal(category.status, 201);
        category = category.data;
        otherCategory = await call(stranger, "POST", "/api/categories", {
          name,
        });
        assert.equal(otherCategory.status, 201);
        otherCategory = otherCategory.data;
        assert.equal(
          (
            await call(stranger, "PUT", `/api/categories/${category.id}`, {
              name: "Outra",
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await call(owner, "POST", "/api/categories", {
              name,
              userId: stranger.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (await call(owner, "GET", "/api/categories")).data.length,
          1,
        );
      },
    );
    await t.test(
      "receitas e despesas geram saldo exato com DECIMAL",
      async () => {
        expense = await call(owner, "POST", "/api/transactions", {
          ...fixture,
          categoryId: category.id,
        });
        assert.equal(expense.status, 201);
        expense = expense.data;
        income = await call(owner, "POST", "/api/transactions", {
          ...fixture,
          title: "Salário",
          type: "INCOME",
          amount: "100.10",
          categoryId: category.id,
        });
        assert.equal(income.status, 201);
        income = income.data;
        const pending = await call(owner, "POST", "/api/transactions", {
          ...fixture,
          title: "Conta prevista",
          status: "PENDENTE",
          amount: "10.01",
          date: "2026-02-01",
          categoryId: category.id,
        });
        assert.equal(pending.status, 201);
        const summary = await call(owner, "GET", "/api/dashboard/summary");
        assert.equal(summary.status, 200);
        assert.equal(summary.data.income, "100.10");
        assert.equal(summary.data.expenses, "25.50");
        assert.equal(summary.data.balance, "74.60");
        assert.equal(summary.data.projectedBalance, "64.59");
        assert.equal(summary.data.pendingExpenses, "10.01");
        assert.equal(
          (await call(owner, "DELETE", `/api/categories/${category.id}`))
            .status,
          409,
        );
      },
    );
    await t.test(
      "histórico paginado e filtros inclusivos por data, tipo e valor",
      async () => {
        const list = await call(
          owner,
          "GET",
          "/api/transactions?pageSize=1&page=1",
        );
        assert.equal(list.data.items.length, 1);
        assert.equal(list.data.total, 3);
        assert.equal(list.data.pages, 3);
        const filtered = await call(
          owner,
          "GET",
          `/api/transactions?type=EXPENSE&status=PAGA&categoryId=${category.id}&startDate=${day}&endDate=${day}&minAmount=25.50&maxAmount=25.50`,
        );
        assert.equal(filtered.data.total, 1);
        assert.equal(filtered.data.items[0].id, expense.id);
        assert.equal(
          (
            await call(
              owner,
              "GET",
              "/api/transactions?startDate=2026-02-01&endDate=2026-01-01",
            )
          ).status,
          400,
        );
        assert.equal(
          (await call(owner, "GET", "/api/transactions?pageSize=100000"))
            .status,
          400,
        );
        assert.equal(
          (
            await call(
              owner,
              "GET",
              "/api/transactions?type=%27%20OR%201%3D1--",
            )
          ).status,
          400,
        );
        assert.equal(
          (await call(owner, "GET", "/api/transactions?where[userId]=1"))
            .status,
          400,
        );
      },
    );
    await t.test(
      "IDOR, mudança de proprietário e referência a categoria alheia são bloqueados",
      async () => {
        assert.equal(
          (
            await call(
              stranger,
              "GET",
              `/api/transactions?accountId=${owner.id}`,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call(stranger, "DELETE", `/api/transactions/${expense.id}`))
            .status,
          404,
        );
        assert.equal(
          (
            await call(owner, "POST", "/api/transactions", {
              ...fixture,
              categoryId: otherCategory.id,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await call(owner, "PUT", `/api/transactions/${expense.id}`, {
              ...fixture,
              categoryId: category.id,
              userId: stranger.id,
            })
          ).status,
          400,
        );
        for (const amount of ["NaN", "-10", "1.001", "1e5", "99999999999"])
          assert.equal(
            (
              await call(owner, "POST", "/api/transactions", {
                ...fixture,
                categoryId: category.id,
                amount,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await call(owner, "POST", "/api/transactions", {
              ...fixture,
              categoryId: category.id,
              date: "2026-02-30",
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "XSS é devolvido como dados JSON, sem HTML executável",
      async () => {
        const payload = '<img src=x onerror="window.__xss=true">';
        const result = await call(
          owner,
          "PUT",
          `/api/transactions/${expense.id}`,
          { ...fixture, categoryId: category.id, title: payload },
        );
        assert.equal(result.status, 200);
        assert.equal(result.data.title, payload);
        assert.match(
          result.response.headers.get("content-type"),
          /application\/json/,
        );
        await call(owner, "PUT", `/api/transactions/${expense.id}`, {
          ...fixture,
          categoryId: category.id,
        });
      },
    );
    await t.test(
      "comprovante PNG válido, download autenticado e exclusão",
      async () => {
        const result = await call(
          owner,
          "POST",
          `/api/transactions/${expense.id}/receipt`,
          uploadBody(png, "cupom.png", "image/png"),
        );
        assert.equal(result.status, 201);
        assert.equal(result.data.mimeType, "image/png");
        assert.equal(result.data.data, undefined);
        const download = await call(
          owner,
          "GET",
          `/api/transactions/${expense.id}/receipt`,
          null,
          { binary: true },
        );
        assert.equal(download.status, 200);
        assert.deepEqual(download.data, png);
        assert.match(
          download.response.headers.get("content-disposition"),
          /^attachment;/,
        );
        assert.equal(
          download.response.headers.get("cache-control"),
          "no-store",
        );
        assert.equal(
          (
            await call(
              stranger,
              "GET",
              `/api/transactions/${expense.id}/receipt`,
            )
          ).status,
          404,
        );
        assert.equal(
          (await call(null, "GET", `/api/transactions/${expense.id}/receipt`))
            .status,
          401,
        );
        assert.equal(
          (await call(owner, "GET", "/api/transactions")).data.items.find(
            (item) => item.id === expense.id,
          ).receipt.mimeType,
          "image/png",
        );
        assert.equal(
          (
            await call(
              owner,
              "DELETE",
              `/api/transactions/${expense.id}/receipt`,
            )
          ).status,
          204,
        );
      },
    );
    await t.test(
      "PDF aceito; SVG, HTML disfarçado, MIME incoerente e arquivo grande rejeitados",
      async () => {
        const pdf = Buffer.from(
          "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody(pdf, "cupom.pdf", "application/pdf"),
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody("<script>alert(1)</script>", "cupom.png", "image/png"),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody(
                '<svg onload="alert(1)"/>',
                "cupom.svg",
                "image/svg+xml",
              ),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody(png, "cupom.pdf", "application/pdf"),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody(png, "cupom.html", "image/png"),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              owner,
              "POST",
              `/api/transactions/${expense.id}/receipt`,
              uploadBody(
                Buffer.alloc(5 * 1024 * 1024 + 1),
                "grande.png",
                "image/png",
              ),
            )
          ).status,
          400,
        );
        assert.equal(
          (await Receipt.findOne({ where: { expenseId: expense.id } }))
            .mimeType,
          "application/pdf",
        );
      },
    );
    await t.test(
      "responsável cria filho com acesso mínimo e sem escalar privilégios",
      async () => {
        const created = await call(
          owner,
          "POST",
          "/api/family/children",
          child.data,
        );
        assert.equal(created.status, 201);
        child.id = created.data.id;
        assert.equal(created.data.isChild, true);
        assert.deepEqual(created.data.permissions, childPermissions);
        await login(child);
        assert.equal(
          (await call(child, "GET", "/api/family/children")).status,
          403,
        );
        assert.equal(
          (
            await call(stranger, "PATCH", `/api/family/children/${child.id}`, {
              active: false,
            })
          ).status,
          404,
        );
        assert.equal(
          (await call(child, "GET", `/api/transactions?accountId=${owner.id}`))
            .status,
          403,
        );
        assert.equal(
          (
            await call(child, "POST", "/api/categories", {
              name: "Sem permissão",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call(owner, "PATCH", `/api/family/children/${child.id}`, {
              role: "admin",
              parentId: null,
            })
          ).status,
          400,
        );
        childCategory = await call(
          owner,
          "POST",
          `/api/categories?accountId=${child.id}`,
          { name: "Mesada" },
        );
        assert.equal(childCategory.status, 201);
        childCategory = childCategory.data;
        assert.equal(
          (
            await call(child, "POST", "/api/transactions", {
              ...fixture,
              categoryId: childCategory.id,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "permissões são aplicadas imediatamente e não podem ser contornadas por edição",
      async () => {
        const permissions = {
          ...childPermissions,
          createExpense: true,
          manageTransactions: true,
          attachments: true,
        };
        assert.equal(
          (
            await call(owner, "PATCH", `/api/family/children/${child.id}`, {
              permissions,
            })
          ).status,
          200,
        );
        childExpense = await call(child, "POST", "/api/transactions", {
          ...fixture,
          categoryId: childCategory.id,
        });
        assert.equal(childExpense.status, 201);
        childExpense = childExpense.data;
        assert.equal(
          (
            await call(child, "POST", "/api/transactions", {
              ...fixture,
              type: "INCOME",
              categoryId: childCategory.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call(child, "PUT", `/api/transactions/${childExpense.id}`, {
              ...fixture,
              type: "INCOME",
              categoryId: childCategory.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (await call(owner, "GET", `/api/transactions?accountId=${child.id}`))
            .data.total,
          1,
        );
        assert.equal(
          (
            await call(
              child,
              "POST",
              `/api/transactions/${childExpense.id}/receipt`,
              uploadBody(png, "cupom.png", "image/png"),
            )
          ).status,
          201,
        );
        await call(owner, "PATCH", `/api/family/children/${child.id}`, {
          permissions: childPermissions,
        });
        assert.equal(
          (await call(child, "DELETE", `/api/transactions/${childExpense.id}`))
            .status,
          403,
        );
        assert.equal(
          (
            await call(
              child,
              "GET",
              `/api/transactions/${childExpense.id}/receipt`,
            )
          ).status,
          403,
        );
        await call(owner, "PATCH", `/api/family/children/${child.id}`, {
          permissions: { ...childPermissions, viewFinance: false },
        });
        assert.equal(
          (await call(child, "GET", "/api/dashboard/summary")).status,
          403,
        );
      },
    );
    await t.test(
      "desativar filho revoga sessões existentes e impede novo login",
      async () => {
        assert.equal(
          (
            await call(owner, "PATCH", `/api/family/children/${child.id}`, {
              active: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(child, "GET", "/api/auth/session")).status,
          401,
        );
        assert.equal(
          (
            await call(null, "POST", "/api/auth/login", {
              email: child.data.email,
              password,
            })
          ).status,
          401,
        );
        assert.equal(await Session.count({ where: { userId: child.id } }), 0);
      },
    );
    await t.test(
      "troca de senha encerra todas as sessões da conta",
      async () => {
        const copy = { data: stranger.data };
        await login(copy);
        assert.equal(
          (
            await call(stranger, "PUT", "/api/auth/password", {
              currentPassword: password,
              newPassword: "Nova-Senha-12345",
            })
          ).status,
          204,
        );
        assert.equal(
          (await call(copy, "GET", "/api/auth/session")).status,
          401,
        );
        assert.equal(
          (
            await call(null, "POST", "/api/auth/login", {
              email: stranger.data.email,
              password,
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "logout revoga cookie capturado e login sempre gera outro identificador",
      async () => {
        capturedCookie = owner.cookie;
        assert.equal(
          (await call(owner, "POST", "/api/auth/logout")).status,
          204,
        );
        assert.equal(
          (await call(owner, "GET", "/api/auth/session")).status,
          401,
        );
        await login(owner);
        assert.notEqual(owner.cookie, capturedCookie);
        assert.equal(
          (await call({ cookie: capturedCookie }, "GET", "/api/auth/session"))
            .status,
          401,
        );
      },
    );
    await t.test(
      "expiração absoluta e inatividade encerram a sessão",
      async () => {
        await Session.update(
          { lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) },
          { where: { userId: owner.id } },
        );
        assert.equal(
          (await call(owner, "GET", "/api/auth/session")).status,
          401,
        );
        await login(owner);
        await Session.update(
          { expiresAt: new Date(Date.now() - 1000) },
          { where: { userId: owner.id } },
        );
        assert.equal(
          (await call(owner, "GET", "/api/auth/session")).status,
          401,
        );
      },
    );
    await t.test(
      "limite de tentativas bloqueia força bruta com 429",
      async () => {
        const email = `ausente-${randomUUID()}@example.com`;
        let result;
        for (let attempt = 0; attempt < 11; attempt++)
          result = await call(null, "POST", "/api/auth/login", {
            email,
            password: "invalida",
          });
        assert.equal(result.status, 429);
        assert.ok(result.response.headers.get("retry-after"));
      },
    );
    await t.test(
      "frontend é servido com navegação direta em português",
      async () => {
        for (const route of ["/", "/login", "/register"]) {
          const response = await fetch(`${base}${route}`);
          assert.equal(response.status, 200);
          const html = await response.text();
          assert.match(html, /id="root"/);
          assert.match(html, /lang="pt-BR"/);
        }
        assert.equal((await fetch(`${base}/assets/ausente.js`)).status, 404);
      },
    );
  } finally {
    try {
      for (const email of emails.reverse())
        await User.destroy({ where: { email } });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await sequelize.close();
    }
  }
});
