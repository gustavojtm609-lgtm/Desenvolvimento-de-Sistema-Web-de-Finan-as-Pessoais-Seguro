import { useState, useContext } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/auth-context";
import api, { getError } from "../../services/api";
import styles from "../Auth/Auth.module.css";
export default function Register() {
  const { signed } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/users", { name, email, password });
      navigate("/login");
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
        <h1>Comece a organizar suas finanças.</h1>
        <p>
          Crie sua conta. Depois, você poderá adicionar os filhos e escolher
          suas permissões.
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            required
            minLength={3}
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            maxLength={254}
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,72}"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="password-help"
          />
          <small id="password-help">
            Use pelo menos 10 caracteres, incluindo letra e número.
          </small>
          <button disabled={busy}>
            {busy ? "Criando conta…" : "Cadastrar"}
          </button>
        </form>
        <p className={styles.switch}>
          Já tem uma conta? <Link to="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
