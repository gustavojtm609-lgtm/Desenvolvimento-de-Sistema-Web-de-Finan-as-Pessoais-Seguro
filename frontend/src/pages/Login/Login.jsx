import { useState, useContext } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthContext } from "../../contexts/auth-context";
import { getError } from "../../services/api";
import styles from "../Auth/Auth.module.css";
export default function Login() {
  const { signIn, signed, loading: checking } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (failure) {
      setError(getError(failure));
    } finally {
      setBusy(false);
    }
  }
  if (signed) return <Navigate to="/" replace />;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link to="/" className={styles.brand}>
          Expenses <i>Control</i>
        </Link>
        <h1>Suas finanças, em ordem.</h1>
        <p>Entre para acompanhar seu saldo, seus planos e sua família.</p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button disabled={busy || checking}>
            {busy ? "Entrando…" : checking ? "Verificando sessão…" : "Entrar"}
          </button>
        </form>
        <p className={styles.switch}>
          Ainda não tem conta? <Link to="/register">Cadastre-se aqui</Link>
        </p>
        <p className={styles.note}>
          Se você é filho, use a conta criada pelo seu responsável.
        </p>
      </section>
    </main>
  );
}
