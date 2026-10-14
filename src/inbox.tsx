import { useEffect, useState } from "react";
import { ArrowUpRight, Mail, RefreshCw, Unplug } from "lucide-react";
import { browserMode } from "./browser-store";

type Status = {
  configured: boolean; connected: boolean; ai_configured: boolean;
  syncing: boolean; account: string; last_sync: string; error: string;
  total: number; pending: number;
};
type Message = {
  id: string;
  original: { subject: string; body: string; sender: string; address: string;
    received: string; unread: boolean; link: string };
  brief: null | { subject: string; body: string; summary: string;
    category: string; priority: string; course: string; action: string; truncated: boolean };
};
const guide = "https://github.com/GinesN/NOTAS-CLASE/blob/main/docs/portal.md";

async function request<T>(path: string, method = "GET"): Promise<T> {
  const response = await fetch("/api/mail/" + path, { method });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo cargar el correo.");
  return result;
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function InboxPage({ courses }: { courses: string[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("All");
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");
  const [original, setOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const callbackFailed = window.location.hash.includes("outlook=failed");
  useEffect(() => {
    if (browserMode) return;
    let mounted = true;
    const load = async () => {
      try {
        const [next, result] = await Promise.all([
          request<Status>("status"), request<{ messages: Message[] }>("messages"),
        ]);
        if (mounted) { setStatus(next); setMessages(result.messages); setError(""); }
      } catch (e) {
        if (mounted) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 5_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  async function action(kind: "connect" | "sync" | "disconnect") {
    if (kind === "disconnect" && !window.confirm(
      "¿Desconectar Outlook y eliminar los correos de este portal? Los mensajes de Outlook se conservan.",
    )) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ url?: string }>(kind, "POST");
      if (kind === "connect" && result.url) { window.location.assign(result.url); return; }
      if (kind === "disconnect") { setMessages([]); setSelected(""); }
      setStatus(await request<Status>("status"));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const filtered = messages.filter((m) => {
    if (filter === "High priority" && m.brief?.priority !== "High") return false;
    if (filter === "Unread" && !m.original.unread) return false;
    if (filter === "Pending" && m.brief) return false;
    if (course && m.brief?.course !== course) return false;
    const text = [m.brief?.subject, m.brief?.summary, m.original.subject, m.original.sender].join(" ");
    return text.toLowerCase().includes(search.toLowerCase());
  });
  const message = messages.find((m) => m.id === selected);

  return <>
    <div className="page-heading">
      <div><h1>Emails</h1><p>Inbox · English summaries · Read only</p></div>
      {!browserMode && status?.connected && <button className="button secondary"
        disabled={busy || status.syncing} onClick={() => action("sync")}>
        <RefreshCw size={16} />{status.syncing ? "Syncing…" : "Refresh"}
      </button>}
    </div>
    {browserMode ? <section className="mail-setup">
      <Mail size={20} /><h2>Conecta Outlook en tu portal privado</h2>
      <p>Este apartado necesita la versión con servidor. GitHub Pages guarda los apuntes
        en este navegador y todavía no puede recibir tus correos.</p>
      <p>El portal privado está preparado para mostrar los asuntos y el texto en inglés,
        resumir los mensajes y ordenarlos por asignatura y prioridad.</p>
      <a className="button secondary" href={guide} target="_blank" rel="noreferrer">
        Guía de conexión <ArrowUpRight size={15} /></a>
    </section> : <>
      {!status && !error && <p role="status">Loading inbox…</p>}
      {status && !status.connected && <section className="mail-setup">
        <Mail size={20} /><h2>Conecta tu Outlook personal</h2>
        <p>Al conectar, se importan los últimos 30 días de tu bandeja de entrada.
          Después se comprueban los mensajes nuevos cada cinco minutos mientras el servidor está activo.</p>
        <p>La autorización se hace en Microsoft. Aula puede leer el correo;
          no envía mensajes ni cambia su estado en Outlook.</p>
        {status.configured ? <button className="button primary" disabled={busy}
          onClick={() => action("connect")}>Conectar con Microsoft</button>
          : <p className="mail-note">Pendiente: desplegar el servidor con HTTPS y configurar
              la aplicación de Microsoft. La cuenta todavía no está conectada.</p>}
        <a className="text-button" href={guide} target="_blank" rel="noreferrer">
          Ver los pasos de configuración <ArrowUpRight size={14} /></a>
      </section>}
      {status?.connected && <>
        <div className="mail-connection">
          <span>{status.account} · {status.last_sync ? "Last sync: " + date(status.last_sync) : "Initial sync pending"}</span>
          <button className="text-button" disabled={busy} onClick={() => action("connect")}>Reconnect</button>
          <button className="text-button" disabled={busy} onClick={() => action("disconnect")}>
            <Unplug size={14} /> Disconnect</button>
        </div>
        {!status.ai_configured && <p className="mail-note">Translation is not configured yet.
          Emails remain in their original language until the server's translation API key is added.</p>}
        {status.ai_configured && status.pending > 0 && <p className="help-text" role="status">
          {status.pending} emails awaiting English translation and summary. Batches are processed automatically.
        </p>}
        <div className="mail-toolbar">
          <input type="search" aria-label="Search emails" placeholder="Search emails…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Filter emails" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["All", "High priority", "Unread", "Pending"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All courses</option>{courses.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="mail-list" aria-label="Inbox messages">
          {filtered.map((m) => <button key={m.id} className={"mail-row " + (m.original.unread ? "unread" : "")}
            onClick={() => { setSelected(m.id); setOriginal(false); }}>
            <div className="mail-subject">
              <strong>{m.brief?.subject || m.original.subject}</strong>
              <span>{m.original.sender} · {date(m.original.received)}</span>
              <div className="mail-tags">
                {m.brief ? <><span className={"mail-priority " + m.brief.priority.toLowerCase()}>{m.brief.priority}</span>
                  <span>{m.brief.category}</span>{m.brief.course && <span>{m.brief.course}</span>}</>
                  : <span>Original · Translation pending</span>}
              </div>
            </div>
            <p>{m.brief?.summary || "English summary pending. Open to read the original email."}</p>
          </button>)}
          {!filtered.length && <p className="mail-empty">{messages.length
            ? "No emails match these filters." : "Your inbox will appear here after synchronization."}</p>}
        </div>
        <p className="help-text">Latest {messages.length} of {status.total} imported emails (maximum 300 shown).
          Summaries and priorities are suggestions; check the original for important dates. Attachments stay in Outlook.</p>
      </>}
      {(error || status?.error || callbackFailed) && <p role="alert" className="form-error">
        {error || status?.error || "No se completó la autorización en Microsoft. Vuelve a conectar Outlook."}</p>}
      {message && <div className="mail-detail" role="dialog" aria-modal="true" aria-labelledby="email-title">
        <div className="mail-detail-inner">
          <button className="button secondary" onClick={() => setSelected("")}>Close email</button>
          <h2 id="email-title">{original ? message.original.subject : message.brief?.subject || message.original.subject}</h2>
          <p>{message.original.sender} &lt;{message.original.address}&gt; · {date(message.original.received)}</p>
          {message.brief && <>
            <p className="mail-summary">{message.brief.summary}</p>
            {message.brief.action && <p><strong>Suggested action:</strong> {message.brief.action}</p>}
            <button className="text-button" onClick={() => setOriginal(!original)}>
              {original ? "Show English translation" : "Show original"}</button>
            {message.brief.truncated && <p className="mail-note">Long email: only the first 40,000 characters were translated.</p>}
          </>}
          <pre className="mail-body">{original ? message.original.body : message.brief?.body || message.original.body}</pre>
          {message.original.link && <a className="button secondary" href={message.original.link}
            target="_blank" rel="noreferrer">Open in Outlook <ArrowUpRight size={15} /></a>}
        </div>
      </div>}
    </>}
  </>;
}
