const router = require("express").Router();
const controller = require("../controllers/auth");
const { validate } = require("../middleware/validation");
const { authenticate } = require("../middleware/auth");
const {
  csrfGuard,
  loginLimiter,
  registrationLimiter,
} = require("../middleware/security");
const { register, login, password, z } = require("../lib/schemas");
router.post(
  "/users",
  registrationLimiter,
  validate({ body: register }),
  controller.register,
);
router.post(
  "/auth/login",
  loginLimiter,
  validate({ body: login }),
  controller.login,
);
router.get("/auth/session", authenticate, controller.current);
router.post("/auth/logout", authenticate, csrfGuard, controller.logout);
router.put(
  "/auth/password",
  authenticate,
  csrfGuard,
  validate({
    body: z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: password,
      })
      .strict(),
  }),
  controller.changePassword,
);
module.exports = router;
