require("./env");
const origins = (process.env.APP_ORIGIN || "http://localhost:3000")
  .split(",")
  .concat(process.env.DEV_ORIGIN || "http://localhost:5173")
  .map((value) => new URL(value.trim()).origin);
const sessionHours = Number(process.env.SESSION_HOURS || 8);
const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES || 30);
if (
  !Number.isFinite(sessionHours) ||
  sessionHours <= 0 ||
  sessionHours > 168 ||
  !Number.isFinite(idleMinutes) ||
  idleMinutes <= 0
) {
  throw new Error("Confira SESSION_HOURS e SESSION_IDLE_MINUTES no .env.");
}
module.exports = {
  origins: [...new Set(origins)],
  cookieName: "ec_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/api",
  },
  sessionMs: sessionHours * 60 * 60 * 1000,
  idleMs: idleMinutes * 60 * 1000,
};
