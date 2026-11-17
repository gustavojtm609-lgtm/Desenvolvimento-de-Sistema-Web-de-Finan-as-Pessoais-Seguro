const router = require("express").Router();
const controller = require("../controllers/family");
const { validate } = require("../middleware/validation");
const { ownerOnly } = require("../middleware/auth");
const { childCreate, childUpdate, z, id } = require("../lib/schemas");
router.use(ownerOnly);
router.get(
  "/children",
  validate({ query: z.object({}).strict() }),
  controller.list,
);
router.post(
  "/children",
  validate({ body: childCreate, query: z.object({}).strict() }),
  controller.create,
);
router.patch(
  "/children/:id",
  validate({
    body: childUpdate,
    params: z.object({ id }),
    query: z.object({}).strict(),
  }),
  controller.update,
);
module.exports = router;
