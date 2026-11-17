const router = require("express").Router();
const multer = require("multer");
const finance = require("../controllers/finance");
const receipts = require("../controllers/receipts");
const { validate } = require("../middleware/validation");
const {
  accountScope,
  requirePermission: allow,
} = require("../middleware/auth");
const {
  transaction,
  category,
  filters,
  accountQuery,
  z,
  id,
} = require("../lib/schemas");
const params = z.object({ id });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});
router.use(accountScope, allow("viewFinance"));
router.get("/transactions", validate({ query: filters }), finance.list);
router.post(
  "/transactions",
  validate({ body: transaction, query: accountQuery }),
  finance.create,
);
router.put(
  "/transactions/:id",
  allow("manageTransactions"),
  validate({ body: transaction, query: accountQuery, params }),
  finance.update,
);
router.delete(
  "/transactions/:id",
  allow("manageTransactions"),
  validate({ query: accountQuery, params }),
  finance.remove,
);
router.get("/dashboard/summary", validate({ query: filters }), finance.summary);
router.get(
  "/categories",
  validate({ query: accountQuery }),
  finance.listCategories,
);
router.post(
  "/categories",
  allow("manageCategories"),
  validate({ body: category, query: accountQuery }),
  finance.createCategory,
);
router.put(
  "/categories/:id",
  allow("manageCategories"),
  validate({ body: category, query: accountQuery, params }),
  finance.updateCategory,
);
router.delete(
  "/categories/:id",
  allow("manageCategories"),
  validate({ query: accountQuery, params }),
  finance.removeCategory,
);
router.post(
  "/transactions/:id/receipt",
  allow("attachments"),
  validate({ query: accountQuery, params }),
  upload.single("receipt"),
  receipts.upload,
);
router.get(
  "/transactions/:id/receipt",
  allow("attachments"),
  validate({ query: accountQuery, params }),
  receipts.download,
);
router.delete(
  "/transactions/:id/receipt",
  allow("attachments"),
  validate({ query: accountQuery, params }),
  receipts.remove,
);
module.exports = router;
