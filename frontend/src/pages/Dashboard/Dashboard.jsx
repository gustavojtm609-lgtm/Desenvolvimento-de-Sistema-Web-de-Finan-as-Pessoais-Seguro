import {
  Children,
  cloneElement,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AuthContext } from "../../contexts/auth-context";
import api, { getError } from "../../services/api";
import styles from "./Finance.module.css";

const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
const formatDate = (value) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const emptyFilters = {
  type: "",
  status: "",
  categoryId: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
};
const permissionLabels = {
  viewFinance: "Ver finanças",
  createIncome: "Registrar receitas",
  createExpense: "Registrar despesas",
  manageTransactions: "Editar e excluir lançamentos",
  manageCategories: "Gerenciar categorias",
  attachments: "Enviar e baixar comprovantes",
};
const defaultPermissions = Object.fromEntries(
  Object.keys(permissionLabels).map((key) => [key, key === "viewFinance"]),
);
function paramsFor(accountId, filters = {}) {
  return Object.fromEntries(
    Object.entries({ accountId, ...filters }).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  );
}
function Field({ label, children }) {
  const id = useId();
  const elements = Children.toArray(children);
  const hasHelp = elements.some(
    (child) => isValidElement(child) && child.type === "small",
  );
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {elements.map((child) => {
        if (
          isValidElement(child) &&
          ["input", "select", "textarea"].includes(child.type)
        )
          return cloneElement(child, {
            id,
            ...(hasHelp ? { "aria-describedby": `${id}-help` } : {}),
          });
        if (isValidElement(child) && child.type === "small")
          return cloneElement(child, { id: `${id}-help` });
        return child;
      })}
    </div>
  );
}
function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="modal-title"
      onCancel={onClose}
    >
      <div className={styles.dialogHeading}>
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Fechar janela"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function TransactionForm({
  initial,
  categories,
  canAttach,
  canIncome,
  canExpense,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(
    initial?.id
      ? {
          ...initial,
          date: initial.date.slice(0, 10),
          amount: initial.amount,
          description: initial.description || "",
        }
      : {
          title: "",
          amount: "",
          type: initial.type,
          categoryId: "",
          date: today(),
          description: "",
          status: "PAGA",
        },
  );
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (file && file.size > 5 * 1024 * 1024)
        throw new Error("O comprovante deve ter até 5 MB.");
      await onSave(form, file);
    } catch (failure) {
      setError(failure.response ? getError(failure) : failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        initial.id
          ? "Editar lançamento"
          : form.type === "INCOME"
            ? "Nova receita"
            : "Nova despesa"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className={styles.form}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Field label="Descrição">
          <input
            name="title"
            required
            maxLength={120}
            value={form.title}
            onChange={change}
            placeholder="Ex.: Salário ou compra no mercado"
          />
        </Field>
        <div className={styles.formColumns}>
          <Field label="Tipo">
            <select name="type" value={form.type} onChange={change}>
              {(canIncome || form.type === "INCOME") && (
                <option value="INCOME">Receita</option>
              )}
              {(canExpense || form.type === "EXPENSE") && (
                <option value="EXPENSE">Despesa</option>
              )}
            </select>
          </Field>
          <Field label="Valor (R$)">
            <input
              name="amount"
              type="number"
              required
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={form.amount}
              onChange={change}
            />
          </Field>
        </div>
        <div className={styles.formColumns}>
          <Field label="Data">
            <input
              name="date"
              type="date"
              required
              value={form.date}
              onChange={change}
            />
          </Field>
          <Field label="Situação">
            <select name="status" value={form.status} onChange={change}>
              <option value="PAGA">
                {form.type === "INCOME" ? "Recebida" : "Paga"}
              </option>
              <option value="PENDENTE">
                {form.type === "INCOME" ? "Prevista" : "Pendente"}
              </option>
            </select>
          </Field>
        </div>
        <Field label="Categoria">
          <select
            name="categoryId"
            required
            value={form.categoryId}
            onChange={change}
          >
            <option value="" disabled>
              Selecione uma categoria
            </option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observações">
          <textarea
            name="description"
            maxLength={255}
            value={form.description}
            onChange={change}
            rows={3}
          />
        </Field>
        {canAttach && (
          <Field label="Comprovante (opcional)">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files[0] || null)}
            />
            <small>
              PDF, JPG, PNG ou WebP, até 5 MB. Um comprovante por lançamento.
            </small>
          </Field>
        )}
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Salvando…" : "Salvar lançamento"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function CategoryForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || "");
  const [description, setDescription] = useState(initial.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ name, description });
    } catch (failure) {
      setError(getError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={initial.id ? "Editar categoria" : "Nova categoria"}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Field label="Nome da categoria">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Descrição da categoria">
          <textarea
            maxLength={255}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Salvando…" : "Salvar categoria"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ChildForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState(
    initial.permissions || defaultPermissions,
  );
  const [active, setActive] = useState(initial.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(
        initial.id
          ? { name, permissions, active, ...(password ? { password } : {}) }
          : { name, email, password, permissions },
      );
    } catch (failure) {
      setError(getError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={initial.id ? "Permissões do filho" : "Adicionar filho"}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Field label="Nome do filho">
          <input
            required
            minLength={3}
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="E-mail do filho">
          <input
            type="email"
            required
            maxLength={254}
            disabled={Boolean(initial.id)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={initial.id ? "Nova senha (opcional)" : "Senha inicial"}>
          <input
            type="password"
            required={!initial.id}
            minLength={10}
            maxLength={72}
            pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,72}"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <small>
            Ao redefinir a senha, as sessões atuais do filho são encerradas.
          </small>
        </Field>
        <fieldset className={styles.permissions}>
          <legend>Funções permitidas</legend>
          {Object.entries(permissionLabels).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(permissions[key])}
                onChange={(event) =>
                  setPermissions({
                    ...permissions,
                    [key]: event.target.checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        {!permissions.viewFinance && (
          <p className={styles.muted}>
            Sem “Ver finanças”, os recursos financeiros ficam bloqueados.
          </p>
        )}
        {initial.id && (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Conta ativa
          </label>
        )}
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Salvando…" : "Salvar filho"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ReceiptForm({ transaction, onSave, onClose }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!file || file.size > 5 * 1024 * 1024)
        throw new Error("Selecione um comprovante de até 5 MB.");
      await onSave(file);
    } catch (failure) {
      setError(failure.response ? getError(failure) : failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Comprovante" onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        <p>{transaction.title}</p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Field label="Arquivo do comprovante">
          <input
            type="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => setFile(event.target.files[0] || null)}
          />
          <small>
            PDF, JPG, PNG ou WebP. Até 5 MB. O novo arquivo substitui o
            anterior.
          </small>
        </Field>
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Enviando…" : "Enviar comprovante"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function PasswordForm() {
  const { finishSession } = useContext(AuthContext);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      finishSession();
    } catch (failure) {
      setError(getError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Field label="Senha atual">
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Field label="Nova senha">
        <input
          type="password"
          minLength={10}
          maxLength={72}
          pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,72}"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
        />
        <small>
          Pelo menos 10 caracteres, com letra e número. Após salvar, faça login
          novamente.
        </small>
      </Field>
      <button className={styles.primary} disabled={busy}>
        {busy ? "Alterando…" : "Alterar senha e encerrar sessões"}
      </button>
    </form>
  );
}
export default function Dashboard() {
  const { user, signOut } = useContext(AuthContext);
  const permissions = user.permissions;
  const [tab, setTab] = useState("overview");
  const [accountId, setAccountId] = useState("");
  const [children, setChildren] = useState([]);
  const [familyVersion, setFamilyVersion] = useState(0);
  const [filters, setFilters] = useState({ ...emptyFilters, page: 1 });
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({
    key: "",
    categories: [],
    items: [],
    pages: 1,
    total: 0,
    summary: {},
    error: "",
  });
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(null);
  const [working, setWorking] = useState(false);
  const queryKey = JSON.stringify({ accountId, filters, version });
  useEffect(() => {
    if (user.isChild) return;
    let active = true;
    api
      .get("/family/children")
      .then(({ data }) => {
        if (active) setChildren(data);
      })
      .catch((error) => {
        if (active) setMessage({ error: true, text: getError(error) });
      });
    return () => {
      active = false;
    };
  }, [user.isChild, familyVersion]);
  useEffect(() => {
    if (!permissions.viewFinance) return;
    let active = true;
    const { accountId: target, filters: selected } = JSON.parse(queryKey);
    Promise.all([
      api.get("/categories", { params: paramsFor(target) }),
      api.get("/transactions", { params: paramsFor(target, selected) }),
      api.get("/dashboard/summary", { params: paramsFor(target, selected) }),
    ])
      .then(([categories, transactions, summary]) => {
        if (active)
          setResult({
            key: queryKey,
            categories: categories.data,
            ...transactions.data,
            summary: summary.data,
            error: "",
          });
      })
      .catch((error) => {
        if (active)
          setResult({
            key: queryKey,
            categories: [],
            items: [],
            pages: 1,
            total: 0,
            summary: {},
            error: getError(error),
          });
      });
    return () => {
      active = false;
    };
  }, [queryKey, permissions.viewFinance]);
  const loading = permissions.viewFinance && result.key !== queryKey;
  const refresh = () => setVersion((value) => value + 1);
  const params = paramsFor(accountId);
  const close = () => setModal(null);
  async function perform(action, text) {
    setWorking(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text });
      refresh();
    } catch (error) {
      setMessage({ error: true, text: getError(error) });
    } finally {
      setWorking(false);
    }
  }
  async function uploadReceipt(id, file) {
    const body = new FormData();
    body.append("receipt", file);
    await api.post(`/transactions/${id}/receipt`, body, { params });
  }
  async function saveTransaction(form, file) {
    const body = Object.fromEntries(
      [
        "title",
        "amount",
        "type",
        "categoryId",
        "date",
        "description",
        "status",
      ].map((key) => [key, form[key]]),
    );
    const { data } = form.id
      ? await api.put(`/transactions/${form.id}`, body, { params })
      : await api.post("/transactions", body, { params });
    let notice = { text: "Lançamento salvo." };
    if (file) {
      try {
        await uploadReceipt(data.id, file);
      } catch (error) {
        notice = {
          error: true,
          text: `Lançamento salvo. O comprovante não foi anexado: ${getError(error)} Use “Anexar” para tentar novamente.`,
        };
      }
    }
    close();
    setMessage(notice);
    refresh();
  }
  async function saveCategory(body) {
    if (modal.data.id)
      await api.put(`/categories/${modal.data.id}`, body, { params });
    else await api.post("/categories", body, { params });
    close();
    setMessage({ text: "Categoria salva." });
    refresh();
  }
  async function saveChild(body) {
    if (modal.data.id)
      await api.patch(`/family/children/${modal.data.id}`, body);
    else await api.post("/family/children", body);
    close();
    setMessage({ text: "Conta e permissões salvas." });
    setFamilyVersion((value) => value + 1);
  }
  async function downloadReceipt(item) {
    await perform(async () => {
      const response = await api.get(`/transactions/${item.id}/receipt`, {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.receipt.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Download do comprovante iniciado.");
  }
  function selectAccount(value) {
    setAccountId(value);
    setFilters({ ...emptyFilters, page: 1 });
    setDraftFilters(emptyFilters);
  }
  const activeName =
    children.find((child) => child.id === accountId)?.name || user.name;
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>
          Expenses <i>Control</i>
        </a>
        <div className={styles.headerRight}>
          <span>
            {user.name}
            {user.isChild ? " · Filho" : " · Responsável"}
          </span>
          <button
            className={styles.secondary}
            onClick={() => perform(signOut, "Sessão encerrada.")}
            disabled={working}
          >
            Sair
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <nav className={styles.tabs} aria-label="Navegação principal">
          <button
            aria-current={tab === "overview" ? "page" : undefined}
            onClick={() => setTab("overview")}
          >
            Visão geral
          </button>
          {permissions.viewFinance && (
            <button
              aria-current={tab === "categories" ? "page" : undefined}
              onClick={() => setTab("categories")}
            >
              Categorias
            </button>
          )}
          {!user.isChild && (
            <button
              aria-current={tab === "family" ? "page" : undefined}
              onClick={() => setTab("family")}
            >
              Família
            </button>
          )}
          <button
            aria-current={tab === "account" ? "page" : undefined}
            onClick={() => setTab("account")}
          >
            Minha conta
          </button>
        </nav>
        {message && (
          <div
            role={message.error ? "alert" : "status"}
            className={message.error ? styles.error : styles.success}
          >
            {message.text}
            <button
              aria-label="Fechar mensagem"
              className={styles.iconButton}
              onClick={() => setMessage(null)}
            >
              ×
            </button>
          </div>
        )}
        {(tab === "overview" || tab === "categories") && !user.isChild && (
          <div className={styles.accountSelector}>
            <Field label="Conta em acompanhamento">
              <select
                value={accountId}
                onChange={(event) => selectAccount(event.target.value)}
              >
                <option value="">Minha conta</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                    {child.active ? "" : " (desativada)"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {tab === "overview" && (
          <>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>CONTROLE FINANCEIRO</p>
                <h1>Seu dinheiro, com clareza.</h1>
                <p className={styles.muted}>
                  {accountId
                    ? `Acompanhando a conta de ${activeName}.`
                    : "Receitas, despesas e comprovantes em um só lugar."}
                </p>
              </div>
              {permissions.viewFinance && (
                <div className={styles.actions}>
                  {permissions.createIncome && (
                    <button
                      className={styles.secondary}
                      disabled={loading}
                      onClick={() =>
                        setModal({
                          kind: "transaction",
                          data: { type: "INCOME" },
                        })
                      }
                    >
                      + Nova receita
                    </button>
                  )}
                  {permissions.createExpense && (
                    <button
                      className={styles.primary}
                      disabled={loading}
                      onClick={() =>
                        setModal({
                          kind: "transaction",
                          data: { type: "EXPENSE" },
                        })
                      }
                    >
                      + Nova despesa
                    </button>
                  )}
                </div>
              )}
            </div>
            {!permissions.viewFinance ? (
              <section className={styles.panel}>
                <h2>Acesso financeiro não liberado</h2>
                <p className={styles.muted}>
                  Seu responsável pode ajustar as funções disponíveis para sua
                  conta.
                </p>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <form
                    className={styles.filters}
                    onSubmit={(event) => {
                      event.preventDefault();
                      setFilters({ ...draftFilters, page: 1 });
                    }}
                  >
                    <Field label="Tipo de lançamento">
                      <select
                        value={draftFilters.type}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            type: event.target.value,
                          })
                        }
                      >
                        <option value="">Todos</option>
                        <option value="INCOME">Receitas</option>
                        <option value="EXPENSE">Despesas</option>
                      </select>
                    </Field>
                    <Field label="Categoria do filtro">
                      <select
                        value={draftFilters.categoryId}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            categoryId: event.target.value,
                          })
                        }
                      >
                        <option value="">Todas</option>
                        {result.categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Situação do filtro">
                      <select
                        value={draftFilters.status}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            status: event.target.value,
                          })
                        }
                      >
                        <option value="">Todas</option>
                        <option value="PAGA">Efetivadas</option>
                        <option value="PENDENTE">Pendentes</option>
                      </select>
                    </Field>
                    <Field label="De">
                      <input
                        type="date"
                        value={draftFilters.startDate}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            startDate: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Até">
                      <input
                        type="date"
                        value={draftFilters.endDate}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            endDate: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Valor mínimo">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftFilters.minAmount}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            minAmount: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Valor máximo">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftFilters.maxAmount}
                        onChange={(event) =>
                          setDraftFilters({
                            ...draftFilters,
                            maxAmount: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className={styles.actions}>
                      <button className={styles.primary}>
                        Aplicar filtros
                      </button>
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={() => {
                          setDraftFilters(emptyFilters);
                          setFilters({ ...emptyFilters, page: 1 });
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </form>
                </section>
                {result.error && (
                  <p role="alert" className={styles.error}>
                    {result.error}
                  </p>
                )}
                {loading ? (
                  <p role="status" className={styles.loading}>
                    Atualizando suas finanças…
                  </p>
                ) : (
                  <>
                    <section
                      className={styles.cards}
                      aria-label="Resumo financeiro"
                    >
                      <article>
                        <p>Receitas recebidas</p>
                        <h2 className={styles.income}>
                          {money(result.summary.income)}
                        </h2>
                        <small>Nos filtros selecionados</small>
                      </article>
                      <article>
                        <p>Despesas pagas</p>
                        <h2 className={styles.expense}>
                          {money(result.summary.expenses)}
                        </h2>
                        <small>Nos filtros selecionados</small>
                      </article>
                      <article className={styles.balance}>
                        <p>Saldo realizado</p>
                        <h2>{money(result.summary.balance)}</h2>
                        <small>Recebido menos pago</small>
                      </article>
                    </section>
                    <div className={styles.forecast}>
                      <span>
                        A receber{" "}
                        <strong>{money(result.summary.pendingIncome)}</strong>
                      </span>
                      <span>
                        A pagar{" "}
                        <strong>{money(result.summary.pendingExpenses)}</strong>
                      </span>
                      <span>
                        Saldo projetado{" "}
                        <strong>
                          {money(result.summary.projectedBalance)}
                        </strong>
                      </span>
                    </div>
                    <section className={styles.panel}>
                      <div className={styles.sectionHeading}>
                        <h2>Histórico financeiro</h2>
                        <span className={styles.muted}>
                          {result.total} lançamento(s)
                        </span>
                      </div>
                      {result.items.length === 0 ? (
                        <div className={styles.empty}>
                          <h3>Nenhum lançamento por aqui.</h3>
                          <p>
                            Crie uma categoria e registre sua primeira receita
                            ou despesa, ou ajuste os filtros.
                          </p>
                        </div>
                      ) : (
                        <div className={styles.tableWrapper}>
                          <table>
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Situação</th>
                                <th>Valor</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.items.map((item) => (
                                <tr key={item.id}>
                                  <td>{formatDate(item.date)}</td>
                                  <td>
                                    <strong>{item.title}</strong>
                                    <small>
                                      {item.type === "INCOME"
                                        ? "Receita"
                                        : "Despesa"}
                                      {item.description
                                        ? ` · ${item.description}`
                                        : ""}
                                    </small>
                                  </td>
                                  <td>{item.category?.name}</td>
                                  <td>
                                    <span
                                      className={
                                        item.status === "PAGA"
                                          ? styles.paid
                                          : styles.pending
                                      }
                                    >
                                      {item.status === "PENDENTE"
                                        ? item.type === "INCOME"
                                          ? "Prevista"
                                          : "Pendente"
                                        : item.type === "INCOME"
                                          ? "Recebida"
                                          : "Paga"}
                                    </span>
                                  </td>
                                  <td
                                    className={
                                      item.type === "INCOME"
                                        ? styles.income
                                        : styles.expense
                                    }
                                  >
                                    {item.type === "INCOME" ? "+" : "−"}{" "}
                                    {money(item.amount)}
                                  </td>
                                  <td>
                                    <div className={styles.rowActions}>
                                      {permissions.manageTransactions && (
                                        <>
                                          <button
                                            disabled={working}
                                            onClick={() =>
                                              setModal({
                                                kind: "transaction",
                                                data: item,
                                              })
                                            }
                                            aria-label={`Editar ${item.title}`}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            disabled={working}
                                            onClick={() => {
                                              if (
                                                window.confirm(
                                                  `Excluir o lançamento “${item.title}” e seu comprovante?`,
                                                )
                                              )
                                                perform(
                                                  () =>
                                                    api.delete(
                                                      `/transactions/${item.id}`,
                                                      { params },
                                                    ),
                                                  "Lançamento excluído.",
                                                );
                                            }}
                                            aria-label={`Excluir ${item.title}`}
                                          >
                                            Excluir
                                          </button>
                                        </>
                                      )}
                                      {permissions.attachments && (
                                        <>
                                          <button
                                            onClick={() =>
                                              setModal({
                                                kind: "receipt",
                                                data: item,
                                              })
                                            }
                                            aria-label={`Comprovante de ${item.title}`}
                                          >
                                            {item.receipt
                                              ? "Trocar anexo"
                                              : "Anexar"}
                                          </button>
                                          {item.receipt && (
                                            <>
                                              <button
                                                disabled={working}
                                                onClick={() =>
                                                  downloadReceipt(item)
                                                }
                                                aria-label={`Baixar comprovante de ${item.title}`}
                                              >
                                                Baixar
                                              </button>
                                              <button
                                                disabled={working}
                                                onClick={() => {
                                                  if (
                                                    window.confirm(
                                                      "Remover somente o comprovante?",
                                                    )
                                                  )
                                                    perform(
                                                      () =>
                                                        api.delete(
                                                          `/transactions/${item.id}/receipt`,
                                                          { params },
                                                        ),
                                                      "Comprovante removido.",
                                                    );
                                                }}
                                                aria-label={`Remover comprovante de ${item.title}`}
                                              >
                                                Remover anexo
                                              </button>
                                            </>
                                          )}
                                        </>
                                      )}
                                      {!permissions.manageTransactions &&
                                        !permissions.attachments && (
                                          <span className={styles.muted}>
                                            Somente leitura
                                          </span>
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className={styles.pagination}>
                        <button
                          className={styles.secondary}
                          disabled={filters.page <= 1}
                          onClick={() =>
                            setFilters({ ...filters, page: filters.page - 1 })
                          }
                        >
                          Anterior
                        </button>
                        <span>
                          Página {filters.page} de {result.pages}
                        </span>
                        <button
                          className={styles.secondary}
                          disabled={filters.page >= result.pages}
                          onClick={() =>
                            setFilters({ ...filters, page: filters.page + 1 })
                          }
                        >
                          Próxima
                        </button>
                      </div>
                    </section>
                    {result.summary.byCategory?.length > 0 && (
                      <section className={styles.panel}>
                        <h2>Totais por categoria</h2>
                        <p className={styles.muted}>
                          Inclui lançamentos realizados e pendentes dentro dos
                          filtros.
                        </p>
                        <div className={styles.categoryTotals}>
                          {result.summary.byCategory.map((item) => (
                            <div key={`${item.categoryId}-${item.type}`}>
                              <span>
                                {item.category?.name}
                                <small>
                                  {item.type === "INCOME"
                                    ? "Receitas"
                                    : "Despesas"}
                                </small>
                              </span>
                              <strong>{money(item.total)}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {tab === "categories" && permissions.viewFinance && (
          <>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>ORGANIZAÇÃO</p>
                <h1>Categorias</h1>
                <p className={styles.muted}>
                  Agrupe os lançamentos da conta de {activeName}.
                </p>
              </div>
              {permissions.manageCategories && (
                <button
                  className={styles.primary}
                  disabled={loading}
                  onClick={() => setModal({ kind: "category", data: {} })}
                >
                  + Nova categoria
                </button>
              )}
            </div>
            <section className={styles.panel}>
              {result.error && (
                <p role="alert" className={styles.error}>
                  {result.error}
                </p>
              )}
              {loading ? (
                <p role="status">Carregando…</p>
              ) : result.categories.length === 0 ? (
                <p className={styles.empty}>
                  Nenhuma categoria criada para esta conta.
                </p>
              ) : (
                <ul className={styles.categoryList}>
                  {result.categories.map((item) => (
                    <li key={item.id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p className={styles.muted}>{item.description}</p>
                      </div>
                      {permissions.manageCategories && (
                        <div className={styles.actions}>
                          <button
                            className={styles.secondary}
                            onClick={() =>
                              setModal({ kind: "category", data: item })
                            }
                            aria-label={`Editar categoria ${item.name}`}
                          >
                            Editar
                          </button>
                          <button
                            className={styles.danger}
                            disabled={working}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir a categoria “${item.name}”?`,
                                )
                              )
                                perform(
                                  () =>
                                    api.delete(`/categories/${item.id}`, {
                                      params,
                                    }),
                                  "Categoria excluída.",
                                );
                            }}
                            aria-label={`Excluir categoria ${item.name}`}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        {tab === "family" && !user.isChild && (
          <>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>CONTROLE PARENTAL</p>
                <h1>Finanças em família.</h1>
                <p className={styles.muted}>
                  Cada filho tem seu próprio acesso. Você decide o que ele pode
                  fazer.
                </p>
              </div>
              <button
                className={styles.primary}
                onClick={() => setModal({ kind: "child", data: {} })}
              >
                + Adicionar filho
              </button>
            </div>
            <section className={styles.panel}>
              {children.length === 0 ? (
                <p className={styles.empty}>
                  Você ainda não adicionou contas de filhos.
                </p>
              ) : (
                <ul className={styles.children}>
                  {children.map((child) => (
                    <li key={child.id}>
                      <div>
                        <h2>
                          {child.name}{" "}
                          <span
                            className={
                              child.active ? styles.paid : styles.pending
                            }
                          >
                            {child.active ? "Ativa" : "Desativada"}
                          </span>
                        </h2>
                        <p className={styles.muted}>{child.email}</p>
                        <div className={styles.badges}>
                          {Object.entries(permissionLabels)
                            .filter(
                              ([key]) =>
                                child.permissions[key] &&
                                child.permissions.viewFinance,
                            )
                            .map(([key, label]) => (
                              <span key={key}>{label}</span>
                            ))}
                          {!child.permissions.viewFinance && (
                            <span>Finanças bloqueadas</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.actions}>
                        <button
                          className={styles.secondary}
                          onClick={() => {
                            selectAccount(child.id);
                            setTab("overview");
                          }}
                          aria-label={`Ver finanças de ${child.name}`}
                        >
                          Ver finanças
                        </button>
                        <button
                          className={styles.secondary}
                          onClick={() =>
                            setModal({ kind: "child", data: child })
                          }
                          aria-label={`Permissões de ${child.name}`}
                        >
                          Permissões
                        </button>
                        <button
                          className={styles.danger}
                          disabled={working}
                          onClick={() => {
                            if (
                              window.confirm(
                                `${child.active ? "Desativar e encerrar as sessões" : "Reativar a conta"} de ${child.name}?`,
                              )
                            )
                              perform(async () => {
                                await api.patch(
                                  `/family/children/${child.id}`,
                                  { active: !child.active },
                                );
                                setFamilyVersion((value) => value + 1);
                              }, "Acesso atualizado.");
                          }}
                        >
                          {child.active ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        {tab === "account" && (
          <>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>SEU ACESSO</p>
                <h1>Minha conta</h1>
                <p className={styles.muted}>
                  {user.name} · {user.email}
                </p>
              </div>
            </div>
            <section className={`${styles.panel} ${styles.settings}`}>
              <h2>Alterar senha</h2>
              <PasswordForm />
            </section>
          </>
        )}
      </main>
      <footer className={styles.footer}>
        Expenses Control · Controle de finanças pessoais e familiares
      </footer>
      {modal?.kind === "transaction" && (
        <TransactionForm
          initial={modal.data}
          categories={result.categories}
          canAttach={permissions.attachments}
          canIncome={permissions.createIncome}
          canExpense={permissions.createExpense}
          onSave={saveTransaction}
          onClose={close}
        />
      )}
      {modal?.kind === "category" && (
        <CategoryForm
          initial={modal.data}
          onSave={saveCategory}
          onClose={close}
        />
      )}
      {modal?.kind === "child" && (
        <ChildForm initial={modal.data} onSave={saveChild} onClose={close} />
      )}
      {modal?.kind === "receipt" && (
        <ReceiptForm
          transaction={modal.data}
          onSave={async (file) => {
            await uploadReceipt(modal.data.id, file);
            close();
            refresh();
            setMessage({ text: "Comprovante anexado." });
          }}
          onClose={close}
        />
      )}
    </div>
  );
}
