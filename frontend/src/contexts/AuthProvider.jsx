import { useEffect, useState } from "react";
import { AuthContext } from "./auth-context";
import api, { setCsrfToken } from "../services/api";
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    localStorage.removeItem("@ExpensesControl:token");
    localStorage.removeItem("@ExpensesControl:user");
    const expired = () => {
      setUser(null);
      setCsrfToken(null);
    };
    window.addEventListener("auth:expired", expired);
    api
      .get("/auth/session")
      .then(({ data }) => {
        if (active) {
          setCsrfToken(data.csrfToken);
          setUser(data.user);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("auth:expired", expired);
    };
  }, []);
  async function signIn(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
  }
  function finishSession() {
    setCsrfToken(null);
    setUser(null);
  }
  async function signOut() {
    await api.post("/auth/logout");
    finishSession();
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        signed: Boolean(user),
        loading,
        signIn,
        signOut,
        finishSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
