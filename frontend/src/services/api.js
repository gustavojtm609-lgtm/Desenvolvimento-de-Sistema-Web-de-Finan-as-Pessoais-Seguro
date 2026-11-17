import axios from "axios";
let csrfToken = null;
export const setCsrfToken = (value) => {
  csrfToken = value;
};
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  if (csrfToken && !["get", "head", "options"].includes(config.method || "get"))
    config.headers["X-CSRF-Token"] = csrfToken;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    ) {
      csrfToken = null;
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  },
);
export function getError(error) {
  const data = error.response?.data;
  return (
    data?.details?.[0]?.message ||
    data?.error ||
    "Não foi possível conectar ao servidor. Tente novamente."
  );
}
export default api;
