const { z } = require("zod");
z.config(z.locales.pt());
const text = (min, max) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(
      /^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/u,
      "Caracteres de controle não são permitidos.",
    );
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z
  .string()
  .min(10, "Use pelo menos 10 caracteres, com letra e número.")
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "A senha deve ter até 72 bytes.",
  )
  .refine(
    (value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value),
    "Inclua pelo menos uma letra e um número.",
  );
const id = z.uuid();
const permissions = z
  .object({
    viewFinance: z.boolean(),
    createIncome: z.boolean(),
    createExpense: z.boolean(),
    manageTransactions: z.boolean(),
    manageCategories: z.boolean(),
    attachments: z.boolean(),
  })
  .strict();
const ownerPermissions = Object.fromEntries(
  Object.keys(permissions.shape).map((key) => [key, true]),
);
const childPermissions = {
  viewFinance: true,
  createIncome: false,
  createExpense: false,
  manageTransactions: false,
  manageCategories: false,
  attachments: false,
};
const register = z.object({ name: text(3, 100), email, password }).strict();
const login = z
  .object({ email, password: z.string().min(1).max(200) })
  .strict();
const money = z
  .union([z.number().finite(), z.string()])
  .transform((value) => String(value))
  .pipe(
    z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        "Informe um valor positivo com até duas casas decimais.",
      ),
  )
  .refine((value) => Number(value) > 0, "O valor deve ser maior que zero.");
const date = z.iso
  .date()
  .refine(
    (value) => value >= "1900-01-01" && value <= "2100-12-31",
    "Use uma data entre 1900 e 2100.",
  );
const transaction = z
  .object({
    title: text(1, 120),
    amount: money,
    type: z.enum(["INCOME", "EXPENSE"]),
    categoryId: id,
    date: date,
    description: text(0, 255).default(""),
    status: z.enum(["PENDENTE", "PAGA"]),
  })
  .strict();
const category = z
  .object({ name: text(1, 80), description: text(0, 255).default("") })
  .strict();
const accountQuery = z.object({ accountId: id.optional() }).strict();
const filters = accountQuery
  .extend({
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    status: z.enum(["PENDENTE", "PAGA"]).optional(),
    categoryId: id.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    minAmount: z
      .string()
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
      .optional(),
    maxAmount: z
      .string()
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
    "O início deve ser anterior ao fim.",
  )
  .refine(
    (value) =>
      value.minAmount === undefined ||
      value.maxAmount === undefined ||
      Number(value.minAmount) <= Number(value.maxAmount),
    "O valor mínimo deve ser menor ou igual ao máximo.",
  );
const childCreate = register
  .extend({ permissions: permissions.default(childPermissions) })
  .strict();
const childUpdate = z
  .object({
    name: text(3, 100).optional(),
    permissions: permissions.optional(),
    active: z.boolean().optional(),
    password: password.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Informe pelo menos uma alteração.",
  );
module.exports = {
  z,
  id,
  register,
  login,
  transaction,
  category,
  filters,
  accountQuery,
  childCreate,
  childUpdate,
  permissions,
  ownerPermissions,
  childPermissions,
  password,
};
