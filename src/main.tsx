import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  FileText,
  Folder,
  FolderPlus,
  Globe2,
  GraduationCap,
  History,
  KeyRound,
  Layers3,
  Leaf,
  LibraryBig,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
  CalendarDays,
  ChartNoAxesCombined,
  BrainCircuit,
  Network,
  Users,
  Building2,
  Pencil,
  Bold,
  List,
  Heading2,
  Link2,
  Copy,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./styles.css";

import type { Kind, Item, Activity, State, Auth } from "./model";
import { browserMode, browserApi } from "./browser-store";

const labels: Record<Kind, string> = {
  course: "Asignatura",
  folder: "Carpeta",
  note: "Apunte",
  exam: "Examen",
};
const colors = ["sage", "blue", "peach", "lavender", "yellow"];
const courseIcons: LucideIcon[] = [
  Globe2,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Network,
  Search,
  Layers3,
  BrainCircuit,
  Users,
  Building2,
];

async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (browserMode) return browserApi<T>(path, method, body);
  const response = await fetch("/api" + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  });
}
function fullPath(item: Item, nodes: Item[]) {
  const parts = [item.title];
  let parent = nodes.find((n) => n.id === item.parent_id);
  while (parent) {
    parts.unshift(parent.title);
    parent = nodes.find((n) => n.id === parent!.parent_id);
  }
  return parts.join(" / ");
}
function descendants(item: Item, nodes: Item[]): Item[] {
  const children = nodes.filter((n) => n.parent_id === item.id);
  return children.flatMap((n) => [n, ...descendants(n, nodes)]);
}
function itemIcon(kind: Kind) {
  return kind === "course"
    ? BookOpen
    : kind === "folder"
      ? Folder
      : kind === "exam"
        ? CalendarDays
        : FileText;
}
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea, a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "modal-wide" : "")}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BookIllustration() {
  return (
    <svg
      className="book-illustration"
      viewBox="0 0 300 210"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="158" cy="178" rx="95" ry="11" fill="#cbd6c1" opacity=".6" />
      <path
        d="M66 71 153 55 239 90 156 126Z"
        fill="#fdfef8"
        stroke="#56705d"
        strokeWidth="1.5"
      />
      <path
        d="m66 71 2 67 88 41 83-26V90l-83 36Z"
        fill="#eceddc"
        stroke="#56705d"
        strokeWidth="1.5"
      />
      <path
        d="m156 126 1 47M74 80l75 35M75 88l73 34M76 98l72 33M77 108l70 31M78 118l69 30M166 130l65-21M166 139l65-21M166 147l65-21M167 157l64-21"
        stroke="#99aa8e"
        strokeWidth="1.2"
      />
      <path
        d="M58 128v15l99 44 90-27v-14l-90 28Z"
        fill="#527754"
        stroke="#3e6549"
        strokeWidth="1.5"
      />
      <path d="m57 129 99 44 90-28" stroke="#3e6549" strokeWidth="2" />
      <path
        d="M76 54c22-8 48-7 77 5v60c-23-12-50-17-76-10Z"
        fill="#fafbf2"
        stroke="#56705d"
        strokeWidth="1.5"
      />
      <path
        d="M153 59c22-15 46-17 68-11l7 60c-29-3-48 2-75 11Z"
        fill="#fffef5"
        stroke="#56705d"
        strokeWidth="1.5"
      />
      <path
        d="m91 68 48 9m-48 1 48 9m-47 2 47 9m-47 1 28 5m46-29 42-12m-41 23 42-11m-41 21 43-11m-43 20 29-7"
        stroke="#b7c4a7"
        strokeWidth="2"
      />
      <path d="m194 49 7 33 7-8 8 4-7-32" fill="#d1ad70" />
      <path
        d="M242 45c-6-9-4-19 2-26 9 4 14 13 9 23-2 7-8 11-10 15m-1-13c-12 1-18-5-21-14 9-5 19-2 23 6"
        fill="#a4b690"
      />
      <path d="M244 56c4-13 1-21 1-29" stroke="#56705d" strokeWidth="1.5" />
      <path
        d="M55 41v15m-7-8h15m195 58v12m-6-6h12"
        stroke="#6f846b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="75" cy="168" r="3" fill="#b4a080" />
      <circle cx="199" cy="20" r="3" fill="#b4a080" />
      <path d="m41 93 4-7 4 7-4 7Z" fill="#b8cba5" />
    </svg>
  );
}

function Login({ auth, onLogin }: { auth: Auth; onLogin: () => void }) {
  const [name, setName] = useState("Ginés");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [template, setTemplate] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (auth.setup_required && password !== repeat)
      return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await api(auth.setup_required ? "/auth/setup" : "/auth/login", "POST", {
        name,
        password,
        template,
      });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <a className="brand" href="#">
          <span className="brand-icon">
            <BookOpen size={24} />
          </span>
          aula<span className="brand-dot">.</span>
        </a>
        <div className="login-story-copy">
          <div className="eyebrow">TU ESPACIO DE ESTUDIO</div>
          <h1>
            Una casa para
            <br />
            cada idea.
          </h1>
          <p>
            Las clases, los apuntes y todo lo que quieres recordar. Juntos, con
            espacio para crecer.
          </p>
          <BookIllustration />
          <div className="login-feature">
            <Layers3 size={18} /> Organiza sin límites de carpetas
          </div>
          <div className="login-feature">
            <ShieldCheck size={18} /> Privado, y siempre tuyo
          </div>
          <div className="login-feature">
            <ArrowLeftRight size={18} /> Llévalo contigo a otro ordenador
          </div>
        </div>
        <span className="login-bottom">
          HES-SO · Genève <span>Curso 2026 — 2027</span>
        </span>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="little-icon">
            <LockKeyhole size={23} />
          </div>
          <h2>
            {auth.setup_required ? "Hazlo tuyo." : "Qué bien verte de nuevo."}
          </h2>
          <p>
            {auth.setup_required
              ? "Prepara tu espacio privado. Esta contraseña protege todos tus apuntes."
              : "Entra en tu espacio y sigue donde lo dejaste."}
          </p>
          {auth.setup_required && (
            <label>
              ¿Cómo te llamas?
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="given-name"
              />
            </label>
          )}
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={auth.setup_required ? 12 : undefined}
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                auth.setup_required ? "new-password" : "current-password"
              }
              placeholder={
                auth.setup_required ? "Al menos 12 caracteres" : "Tu contraseña"
              }
            />
          </label>
          {auth.setup_required && (
            <>
              <label>
                Repite la contraseña
                <input
                  type="password"
                  required
                  minLength={12}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Una vez más"
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={template}
                  onChange={(e) => setTemplate(e.target.checked)}
                />
                <span>
                  Preparar mis nueve asignaturas de HES-SO
                  <small>
                    Temas, exámenes y recursos, listos para empezar.
                  </small>
                </span>
              </label>
            </>
          )}
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <button className="button primary full" disabled={busy}>
            {busy
              ? "Un momento…"
              : auth.setup_required
                ? "Crear mi espacio"
                : "Entrar en Aula"}
            <ArrowRight size={17} />
          </button>
          <div className="login-security">
            <ShieldCheck size={14} /> Sin publicidad. Sin analítica. Tus datos
            en tu servidor.
          </div>
        </form>
      </div>
    </div>
  );
}

function TreeRow({
  item,
  nodes,
  selected,
  navigate,
  depth = 0,
}: {
  item: Item;
  nodes: Item[];
  selected: string;
  navigate: (r: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const children = nodes.filter((n) => n.parent_id === item.id);
  const Icon = itemIcon(item.kind);
  return (
    <>
      <div
        className={
          "tree-row " + (selected === "node:" + item.id ? "selected" : "")
        }
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        <button
          className="tree-expand"
          aria-label={(open ? "Contraer " : "Expandir ") + item.title}
          onClick={() => setOpen(!open)}
          disabled={!children.length}
        >
          {children.length ? (
            open ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span />
          )}
        </button>
        <button
          className="tree-link"
          onClick={() => navigate("node:" + item.id)}
          title={item.title}
        >
          <Icon size={15} className={"text-" + item.color} />
          <span>{item.title}</span>
        </button>
      </div>
      {open &&
        children.map((n) => (
          <TreeRow
            key={n.id}
            item={n}
            nodes={nodes}
            selected={selected}
            navigate={navigate}
            depth={depth + 1}
          />
        ))}
    </>
  );
}

function CourseCard({
  item,
  index,
  nodes,
  navigate,
  pin,
}: {
  item: Item;
  index: number;
  nodes: Item[];
  navigate: (r: string) => void;
  pin: (item: Item) => void;
}) {
  const Icon = courseIcons[index % courseIcons.length];
  const notes = descendants(item, nodes).filter(
    (n) => n.kind === "note",
  ).length;
  const folders = nodes.filter(
    (n) => n.parent_id === item.id && n.kind === "folder",
  ).length;
  return (
    <article className={"course-card palette-" + item.color}>
      <div className="course-card-top">
        <span className="course-icon">
          <Icon size={23} strokeWidth={1.6} />
        </span>
        <button
          className={"icon-button favorite " + (item.pinned ? "is-pinned" : "")}
          aria-label={
            (item.pinned ? "Quitar de favoritos " : "Añadir a favoritos ") +
            item.title
          }
          onClick={() => pin(item)}
        >
          <Star size={16} fill={item.pinned ? "currentColor" : "none"} />
        </button>
      </div>
      <button
        className="course-card-link"
        onClick={() => navigate("node:" + item.id)}
      >
        <span className="course-code">
          ASIGNATURA {String(index + 1).padStart(2, "0")}
        </span>
        <h3>{item.title}</h3>
        <div className="course-card-footer">
          <span>
            <Folder size={13} /> {folders} apartados
            <span className="dot">·</span>
            {notes} {notes === 1 ? "apunte" : "apuntes"}
          </span>
          <ArrowUpRight size={17} />
        </div>
      </button>
    </article>
  );
}

function ItemRow({
  item,
  nodes,
  navigate,
  pin,
  toggleDone,
}: {
  item: Item;
  nodes: Item[];
  navigate: (r: string) => void;
  pin: (item: Item) => void;
  toggleDone?: (item: Item) => void;
}) {
  const Icon = itemIcon(item.kind);
  return (
    <div className={"item-row " + (item.done ? "completed" : "")}>
      {item.kind === "exam" && toggleDone ? (
        <button
          className={"exam-check " + (item.done ? "checked" : "")}
          onClick={() => toggleDone(item)}
          aria-label={
            (item.done ? "Marcar pendiente " : "Completar ") + item.title
          }
        >
          {item.done && <Check size={13} />}
        </button>
      ) : (
        <span className={"document-icon palette-" + item.color}>
          <Icon size={18} />
        </span>
      )}
      <button
        className="item-row-link"
        onClick={() => navigate("node:" + item.id)}
      >
        <strong>{item.title}</strong>
        <span>
          {item.parent_id
            ? fullPath(item, nodes).split(" / ").slice(0, -1).join(" / ")
            : "Mi espacio"}
          {item.kind === "exam" && item.due_date
            ? " · " + dateLabel(item.due_date + "T12:00:00")
            : ""}
        </span>
      </button>
      <span className="item-date">{dateLabel(item.updated_at)}</span>
      <button
        className={"icon-button " + (item.pinned ? "is-pinned" : "")}
        aria-label={
          (item.pinned ? "Quitar de favoritos " : "Añadir a favoritos ") +
          item.title
        }
        onClick={() => pin(item)}
      >
        <Star size={15} fill={item.pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function Empty({
  icon: Icon = FileText,
  title,
  text,
  action,
  onClick,
}: {
  icon?: LucideIcon;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={29} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button secondary" onClick={onClick}>
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}

function CreateModal({
  nodes,
  initialParent,
  initialKind,
  onClose,
  onCreated,
}: {
  nodes: Item[];
  initialParent: string | null;
  initialKind: Kind;
  onClose: () => void;
  onCreated: (item: Item) => void;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [parent, setParent] = useState(initialParent || "");
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(
    nodes.find((n) => n.id === initialParent)?.color || "sage",
  );
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api<Item>("/nodes", "POST", {
        kind,
        title,
        parent_id: kind === "course" ? null : parent || null,
        color,
        due_date: due,
      });
      onCreated(item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Un nuevo comienzo"
      subtitle="Dale un lugar a lo que estás aprendiendo."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="type-picker">
          {(["note", "folder", "exam", "course"] as Kind[]).map((k) => {
            const Icon = itemIcon(k);
            return (
              <button
                key={k}
                type="button"
                className={kind === k ? "active" : ""}
                onClick={() => setKind(k)}
              >
                <Icon size={19} />
                <span>{labels[k]}</span>
              </button>
            );
          })}
        </div>
        <label>
          Nombre
          <input
            autoFocus
            required
            maxLength={160}
            placeholder={
              kind === "course"
                ? "Nombre de la asignatura"
                : kind === "folder"
                  ? "Por ejemplo, Tema 2"
                  : kind === "exam"
                    ? "Por ejemplo, Examen final"
                    : "Por ejemplo, Resumen del tema 1"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {kind !== "course" && (
          <label>
            Guardar en
            <select
              value={parent}
              onChange={(e) => {
                setParent(e.target.value);
                setColor(
                  nodes.find((n) => n.id === e.target.value)?.color || "sage",
                );
              }}
            >
              <option value="">Mi espacio</option>
              {nodes
                .filter((n) => n.kind === "course" || n.kind === "folder")
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {fullPath(n, nodes)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {kind === "exam" && (
          <label>
            Fecha del examen <span className="optional">(opcional)</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        )}
        <label>Un toque de color</label>
        <div className="color-picker">
          {colors.map((c) => (
            <button
              type="button"
              key={c}
              className={
                "color-swatch palette-" + c + (color === c ? " chosen" : "")
              }
              aria-label={"Color " + c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
            >
              {color === c && <Check size={16} />}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Creando…" : "Crear " + labels[kind].toLowerCase()}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function inline(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i}>{part.slice(1, -1)}</code>;
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link)
        return (
          <a key={i} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      return part;
    });
}
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  function flush(i: number) {
    if (list.length) {
      elements.push(
        <ul key={"ul" + i}>
          {list.map((s, j) => (
            <li key={j}>{inline(s)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  }
  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      flush(i);
      if (code) {
        elements.push(
          <pre key={i}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else code = [];
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    if (/^[-*] /.test(line)) {
      list.push(line.slice(2));
      return;
    }
    flush(i);
    if (line.startsWith("### "))
      elements.push(<h3 key={i}>{inline(line.slice(4))}</h3>);
    else if (line.startsWith("## "))
      elements.push(<h2 key={i}>{inline(line.slice(3))}</h2>);
    else if (line.startsWith("# "))
      elements.push(<h1 key={i}>{inline(line.slice(2))}</h1>);
    else if (line.startsWith("> "))
      elements.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);
    else if (line.trim()) elements.push(<p key={i}>{inline(line)}</p>);
  });
  flush(lines.length);
  if (code)
    elements.push(
      <pre key="unfinished">
        <code>{(code as string[]).join("\n")}</code>
      </pre>,
    );
  return <div className="markdown">{elements}</div>;
}

function Editor({
  item,
  nodes,
  save,
  remove,
  pin,
  dirtyChange,
  toast,
}: {
  item: Item;
  nodes: Item[];
  save: (
    item: Item,
    changes: Partial<Item> & { expected_updated_at?: string },
  ) => Promise<void>;
  remove: (item: Item) => void;
  pin: (item: Item) => void;
  dirtyChange: (dirty: boolean) => void;
  toast: (message: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [parent, setParent] = useState(item.parent_id || "");
  const [due, setDue] = useState(item.due_date);
  const [editing, setEditing] = useState(!item.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const dirty =
    title !== item.title ||
    content !== item.content ||
    parent !== (item.parent_id || "") ||
    due !== item.due_date;
  useEffect(() => {
    dirtyChange(dirty);
    return () => dirtyChange(false);
  }, [dirty, dirtyChange]);
  async function commit() {
    setBusy(true);
    setError("");
    try {
      await save(item, {
        title,
        content,
        parent_id: parent || null,
        due_date: due,
        expected_updated_at: item.updated_at,
      });
      dirtyChange(false);
      toast("Apunte guardado");
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function format(before: string, after = "") {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const chosen = content.slice(start, end);
    setContent(
      content.slice(0, start) + before + chosen + after + content.slice(end),
    );
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }
  return (
    <div className="editor-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{labels[item.kind].toUpperCase()}</div>
          <h1>{item.title}</h1>
          <p>
            {fullPath(item, nodes).split(" / ").slice(0, -1).join(" / ") ||
              "Mi espacio"}{" "}
            · Editado el {dateLabel(item.updated_at)}
          </p>
        </div>
        <div className="heading-actions">
          <button
            className={"button secondary " + (item.pinned ? "is-pinned" : "")}
            onClick={() => pin(item)}
            aria-label="Marcar como favorito"
          >
            <Star size={16} fill={item.pinned ? "currentColor" : "none"} />
          </button>
          <button
            className="button secondary"
            onClick={() => {
              download(
                item.title.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 80) +
                  ".md",
                "# " + item.title + "\n\n" + content,
              );
              toast("Apunte exportado");
            }}
          >
            <ArrowDownToLine size={16} />
            <span>Exportar</span>
          </button>
          <button
            className="icon-button danger"
            aria-label="Eliminar documento"
            onClick={() => remove(item)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="editor-sheet">
        <div className="editor-tabs">
          <button
            className={!editing ? "active" : ""}
            onClick={() => setEditing(false)}
          >
            <BookOpen size={15} />
            Leer
          </button>
          <button
            className={editing ? "active" : ""}
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
            Editar
          </button>
          <span className={"save-state " + (dirty ? "unsaved" : "")}>
            {dirty ? (
              <>
                <span className="status-dot" />
                Cambios sin guardar
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                Guardado
              </>
            )}
          </span>
        </div>
        {editing ? (
          <div className="editor-form">
            <label>
              Título
              <input
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="editor-meta">
              <label>
                Carpeta
                <select
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">Mi espacio</option>
                  {nodes
                    .filter((n) => n.kind === "course" || n.kind === "folder")
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {fullPath(n, nodes)}
                      </option>
                    ))}
                </select>
              </label>
              {item.kind === "exam" && (
                <label>
                  Fecha del examen
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="format-bar">
              <button
                className="icon-button"
                aria-label="Negrita"
                onClick={() => format("**", "**")}
              >
                <Bold size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Encabezado"
                onClick={() => format("\n## ")}
              >
                <Heading2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Lista"
                onClick={() => format("\n- ")}
              >
                <List size={17} />
              </button>
              <span /> <small>Markdown · escribe a tu manera</small>
            </div>
            <textarea
              ref={textarea}
              className="note-textarea"
              aria-label="Contenido del apunte"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Las ideas importantes, las preguntas que te haces, lo que quieres recordar…"
              spellCheck
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : content ? (
          <div className="reading-content">
            <Markdown text={content} />
          </div>
        ) : (
          <Empty
            icon={NotebookPen}
            title="La primera idea va aquí"
            text="Empieza a escribir. Este espacio es tuyo."
            action="Escribir mi apunte"
            onClick={() => setEditing(true)}
          />
        )}
        <div className="editor-footer">
          <span>
            <LockKeyhole size={13} /> Solo en tu espacio privado
          </span>
          <button
            className="button primary"
            onClick={commit}
            disabled={busy || !dirty}
          >
            <Check size={16} />
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Integration({
  state,
  onClose,
  refresh,
  toast,
}: {
  state: State;
  onClose: () => void;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isPublic =
    window.location.protocol === "https:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  const instructions =
    "Eres mi asistente de estudio conectado a Aula. Lee readStudySpace antes de guardar para encontrar la asignatura y la carpeta correctas. Conserva los nombres existentes. Si el destino no está claro, pregúntame. Usa saveStudyDocument para guardar apuntes y exámenes en Markdown; no inventes fechas ni contenidos. La ruta empieza por la asignatura y termina en una carpeta. Inventa un request_id único para cada documento y reutilízalo solamente al reintentar la misma operación. Después confirma el título y la ruta devueltos por Aula. Usa el historial como registro de trabajo, sin asumir que contiene todos los detalles de una conversación.";
  async function copy(text: string, message = "Copiado") {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      setError(
        "Tu navegador no permite copiar. Selecciona el texto y cópialo manualmente.",
      );
    }
  }
  async function makeKey() {
    if (
      state.api_enabled &&
      !window.confirm("Crear otra clave desconectará la anterior. ¿Continuar?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ key: string }>("/key", "POST");
      setKey(result.key);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (
      !window.confirm(
        "¿Revocar la clave? El GPT dejará de tener acceso a tus apuntes.",
      )
    )
      return;
    try {
      await api("/key", "DELETE");
      setKey("");
      await refresh();
      toast("Acceso de ChatGPT revocado");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (browserMode) {
    return (
      <Modal
        wide
        title="Tus ideas, conectadas."
        subtitle="Tu espacio de estudio en GitHub Pages."
        onClose={onClose}
      >
        <div className="integration-banner">
          <span className="little-icon">
            <Sparkles size={24} />
          </span>
          <div>
            <strong>Lleva tus asignaturas a la conversación</strong>
            <p>
              Copia el índice y pide a ChatGPT que te ayude a preparar tus
              temas.
            </p>
          </div>
        </div>
        <div className="integration-section">
          <div className="section-title">
            <h3>Comparte el contexto de tus clases</h3>
            <span className="badge sage">Disponible ahora</span>
          </div>
          <p>
            El índice incluye los nombres de tus asignaturas y carpetas. Si
            quieres compartir el texto de tus apuntes, descarga una copia desde
            Ajustes y selecciona lo que quieras enviar.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              copy(
                "# Mi espacio en Aula\n\n" +
                  state.nodes
                    .filter((n) => n.kind === "course" || n.kind === "folder")
                    .map((n) => "- " + fullPath(n, state.nodes))
                    .join("\n"),
                "Índice copiado para ChatGPT",
              )
            }
          >
            <Copy size={16} />
            Copiar contexto de mis clases
          </button>
        </div>
        <div className="integration-section">
          <div className="section-title">
            <h3>Guardado automático desde ChatGPT</h3>
            <span className="badge peach">Requiere servidor</span>
          </div>
          <p>
            GitHub Pages guarda los datos en tu navegador. ChatGPT y este
            entorno de Codex no pueden escribir directamente en ese
            almacenamiento. Puedes copiar el contenido a un apunte, o importar
            una copia preparada de Aula.
          </p>
          <p>
            La versión con servidor está incluida en el repositorio. Alojarla
            con HTTPS permite conectar las acciones de un GPT personalizado y
            utilizar la misma base de datos desde varios dispositivos.
          </p>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer-note">
          <ShieldCheck size={15} />
          Aula no envía tus apuntes a ChatGPT automáticamente.
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      wide
      title="Tus ideas, conectadas."
      subtitle="Trabaja con ChatGPT y guarda cada cosa en su lugar."
      onClose={onClose}
    >
      <div className="integration-banner">
        <span className="little-icon">
          <Sparkles size={24} />
        </span>
        <div>
          <strong>Una conversación. Un espacio ordenado.</strong>
          <p>
            «Guarda este resumen en International Trade → Temas → Tema 1 →
            Apuntes».
          </p>
        </div>
      </div>
      <div className="integration-section">
        <div className="section-title">
          <h3>Empieza desde este chat</h3>
          <span className="badge sage">Disponible ahora</span>
        </div>
        <p>
          Copia el índice de tus asignaturas y compártelo con ChatGPT. Para
          incluir el texto de tus apuntes, descarga la copia desde Ajustes.
        </p>
        <button
          className="button secondary"
          onClick={() =>
            copy(
              "# Mi espacio en Aula\n\n" +
                state.nodes
                  .filter((n) => n.kind === "course" || n.kind === "folder")
                  .map((n) => "- " + fullPath(n, state.nodes))
                  .join("\n"),
              "Índice copiado para ChatGPT",
            )
          }
        >
          <Copy size={16} />
          Copiar contexto de mis clases
        </button>
      </div>
      <div className="integration-section">
        <div className="section-title">
          <h3>Guardar automáticamente con un GPT</h3>
          <span className={"badge " + (isPublic ? "sage" : "peach")}>
            {isPublic ? "Servidor HTTPS" : "Pendiente de alojamiento"}
          </span>
        </div>
        <p>
          La API está preparada. Para usarla desde ChatGPT necesitas alojar Aula
          en un dominio HTTPS accesible y configurar las acciones de un GPT
          personalizado. Este chat no se conecta al pulsar un botón.
        </p>
        <ol className="connection-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Aloja tu espacio con HTTPS</strong>
              <p>
                Conserva la base de datos en un volumen persistente. La guía del
                repositorio incluye el despliegue y el cambio de ordenador.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Genera una clave privada</strong>
              <p>
                La clave permite leer y crear documentos. No la pegues en una
                conversación ni la subas a GitHub.
              </p>
              {key ? (
                <div className="key-result">
                  <code>{key}</code>
                  <button
                    className="icon-button"
                    aria-label="Copiar clave privada"
                    onClick={() => copy(key, "Clave copiada")}
                  >
                    <Copy size={16} />
                  </button>
                  <small>
                    Solo se muestra ahora. Guárdala en la autenticación del GPT.
                  </small>
                </div>
              ) : (
                <button
                  className="button secondary small"
                  onClick={makeKey}
                  disabled={busy}
                >
                  <KeyRound size={14} />
                  {busy
                    ? "Generando…"
                    : state.api_enabled
                      ? "Renovar clave"
                      : "Crear clave de conexión"}
                </button>
              )}
              {state.api_enabled && (
                <button className="text-button danger revoke" onClick={revoke}>
                  Revocar acceso
                </button>
              )}
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Configura las acciones de tu GPT</strong>
              <p>
                En el editor de un GPT personalizado, importa el esquema.
                Selecciona autenticación con API key y tipo Bearer; introduce
                allí tu clave.
              </p>
              <div className="connection-buttons">
                <button
                  className="button secondary small"
                  onClick={async () => {
                    try {
                      const schema = await api("/openapi.json");
                      download(
                        "aula-openapi.json",
                        JSON.stringify(schema, null, 2),
                        "application/json",
                      );
                      toast("Esquema descargado");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <ArrowDownToLine size={14} />
                  Descargar esquema
                </button>
                <button
                  className="button secondary small"
                  onClick={() =>
                    copy(instructions, "Instrucciones del GPT copiadas")
                  }
                >
                  <Clipboard size={14} />
                  Copiar instrucciones
                </button>
              </div>
              <small className="help-text">
                Descarga el esquema desde el dominio definitivo. Privacidad:
                /privacy. La disponibilidad del editor de GPTs depende de tu
                cuenta de ChatGPT.
              </small>
            </div>
          </li>
        </ol>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-footer-note">
        <ShieldCheck size={15} />
        Puedes revocar el acceso en cualquier momento. No se envía nada a
        ChatGPT sin una acción.
      </div>
    </Modal>
  );
}

function SettingsPage({
  state,
  refresh,
  toast,
  localMode,
}: {
  state: State;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
  localMode: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  async function backup() {
    try {
      const data = await api("/backup");
      download(
        "aula-copia-" + new Date().toISOString().slice(0, 10) + ".json",
        JSON.stringify(data, null, 2),
        "application/json",
      );
      toast("Copia de seguridad descargada");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    if (file.size > 16_000_000)
      return setError("La copia no puede superar 16 MB.");
    if (
      !window.confirm(
        "La importación reemplazará tus apuntes y carpetas actuales. Descarga primero una copia si quieres conservarlos. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/restore", "POST", JSON.parse(await file.text()));
      await refresh();
      toast("Copia importada correctamente");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await api("/auth/password", "POST", {
        current_password: current,
        password,
      });
      setCurrent("");
      setPassword("");
      setRepeat("");
      toast("Contraseña actualizada. Las otras sesiones se han cerrado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SIEMPRE TUYO</div>
          <h1>Cuida tu espacio.</h1>
          <p>Copias, privacidad y la libertad de llevártelo contigo.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="settings-card">
          <span className="little-icon">
            <ArrowLeftRight size={23} />
          </span>
          <h2>Tus apuntes viajan contigo</h2>
          <p>
            La copia incluye tus asignaturas, carpetas, apuntes, exámenes y
            registro de actividad. Las contraseñas y las claves de ChatGPT se
            quedan fuera.
          </p>
          <div className="backup-stats">
            <span>
              <strong>
                {state.nodes.filter((n) => n.kind === "course").length}
              </strong>{" "}
              asignaturas
            </span>
            <span>
              <strong>
                {
                  state.nodes.filter((n) => ["note", "exam"].includes(n.kind))
                    .length
                }
              </strong>{" "}
              documentos
            </span>
          </div>
          <div className="settings-actions">
            <button className="button primary" onClick={backup}>
              <ArrowDownToLine size={16} />
              Descargar copia
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} />
              {busy ? "Importando…" : "Importar copia"}
            </button>
            <input
              ref={input}
              type="file"
              aria-label="Importar copia de seguridad"
              accept="application/json,.json"
              hidden
              onChange={(e) => restore(e.target.files?.[0])}
            />
          </div>
          <div className="subtle-note">
            <LockKeyhole size={15} />
            <p>
              Guarda la copia en un lugar privado: contiene tus apuntes en
              texto. Con un servidor HTTPS podrás entrar desde otro ordenador
              sin importar nada.
            </p>
          </div>
        </section>
        {!localMode && (
          <section className="settings-card">
            <span className="little-icon">
              <KeyRound size={23} />
            </span>
            <h2>La llave de tu Aula</h2>
            <p>
              Cambia tu contraseña. Se cerrarán las sesiones de los otros
              dispositivos.
            </p>
            <form onSubmit={changePassword}>
              <label>
                Contraseña actual
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </label>
              <div className="password-grid">
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    minLength={12}
                    maxLength={256}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Repite la contraseña
                  <input
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                  />
                </label>
              </div>
              <button className="button secondary" disabled={busy}>
                <KeyRound size={15} />
                Actualizar contraseña
              </button>
            </form>
          </section>
        )}
        <section className="settings-card privacy-card">
          <ShieldCheck size={23} />
          <div>
            <h2>Un espacio privado de verdad</h2>
            <p>
              {browserMode ? (
                <>
                  Tus documentos se guardan en este navegador y dispositivo.
                  Compartir el enlace comparte la aplicación, sin tus apuntes.
                  No hay sincronización automática entre ordenadores. Haz una
                  copia antes de borrar los datos del navegador.
                </>
              ) : (
                <>
                  No hay publicidad, rastreadores ni envíos automáticos a una
                  IA. El modo de uso actual funciona dentro del entorno, sin
                  contraseña. Para un despliegue público, activa el acceso
                  privado con contraseña. Publicar el entorno de desarrollo
                  conserva una base de trabajo; para entrar desde cualquier
                  ordenador necesitas desplegar la web.
                </>
              )}
            </p>
            <a
              className="text-button"
              href={
                browserMode
                  ? import.meta.env.BASE_URL + "privacy.html"
                  : "/privacy"
              }
              target="_blank"
              rel="noreferrer"
            >
              Leer la política de privacidad
              <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [route, setRoute] = useState(window.location.hash.slice(1) || "home");
  const [create, setCreate] = useState<{
    kind: Kind;
    parent: string | null;
  } | null>(null);
  const [integration, setIntegration] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [error, setError] = useState("");
  const [rename, setRename] = useState<Item | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [examFilter, setExamFilter] = useState("pending");
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function refresh() {
    setState(await api<State>("/state"));
  }
  async function checkAuth() {
    try {
      const status = await api<Auth>("/auth/status");
      setAuth(status);
      if (status.authenticated) await refresh();
      else setState(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    checkAuth();
  }, []);
  useEffect(() => {
    if (!auth?.authenticated) return;
    const sync = () => {
      if (!dirtyRef.current && !document.hidden) refresh().catch(() => {});
    };
    const interval = setInterval(sync, 15_000);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", sync);
    };
  }, [auth?.authenticated]);
  useEffect(() => {
    const hash = () => {
      const next = window.location.hash.slice(1) || "home";
      if (
        dirtyRef.current &&
        next !== route &&
        !window.confirm("Tienes cambios sin guardar. ¿Salir de este apunte?")
      ) {
        window.history.replaceState(null, "", "#" + route);
        return;
      }
      dirtyRef.current = false;
      setRoute(next);
      setMobile(false);
      window.scrollTo(0, 0);
    };
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("keydown", keyboard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [route]);
  function navigate(next: string) {
    if (next === route) {
      setMobile(false);
      return;
    }
    window.location.hash = next;
  }
  function toast(message: string) {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 4000);
  }
  async function save(
    item: Item,
    changes: Partial<Item> & { expected_updated_at?: string },
  ) {
    await api("/nodes/" + item.id, "PATCH", changes);
    await refresh();
  }
  async function pin(item: Item) {
    try {
      await save(item, { pinned: !item.pinned });
      toast(item.pinned ? "Quitado de favoritos" : "Guardado en favoritos");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function toggleDone(item: Item) {
    try {
      await save(item, { done: !item.done });
      toast(
        item.done ? "Examen pendiente" : "Examen completado. ¡Un paso más!",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(item: Item) {
    const count = state ? descendants(item, state.nodes).length : 0;
    if (
      !window.confirm(
        `¿Eliminar «${item.title}»${count ? ` y los ${count} elementos que contiene` : ""}? Esta acción no se puede deshacer. Puedes hacer una copia en Ajustes.`,
      )
    )
      return;
    try {
      await api("/nodes/" + item.id, "DELETE");
      dirtyRef.current = false;
      await refresh();
      navigate(item.parent_id ? "node:" + item.parent_id : "home");
      toast("Apartado eliminado");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function logout() {
    if (
      dirtyRef.current &&
      !window.confirm("Tienes cambios sin guardar. ¿Cerrar sesión?")
    )
      return;
    try {
      await api("/auth/logout", "POST");
      dirtyRef.current = false;
      setIntegration(false);
      setSearchOpen(false);
      setCreate(null);
      await checkAuth();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function doRename(e: React.FormEvent) {
    e.preventDefault();
    if (!rename) return;
    setBusy(true);
    try {
      await save(rename, { title: newTitle });
      setRename(null);
      toast("Nombre actualizado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dirtyChange = React.useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  if (!auth)
    return (
      <div className="loading-screen">
        <BookOpen size={30} />
        <span>{error || "Preparando tu espacio…"}</span>
        {error && (
          <button className="button secondary" onClick={checkAuth}>
            Reintentar
          </button>
        )}
      </div>
    );
  if (!auth.authenticated) return <Login auth={auth} onLogin={checkAuth} />;
  if (!state)
    return (
      <div className="loading-screen">
        <BookOpen size={30} />
        <span>{error || "Abriendo tus apuntes…"}</span>
        <button className="button secondary" onClick={checkAuth}>
          Reintentar
        </button>
      </div>
    );
  const { nodes, activity } = state;
  const courses = nodes.filter((n) => n.kind === "course");
  const notes = nodes
    .filter((n) => n.kind === "note")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const exams = nodes
    .filter((n) => n.kind === "exam")
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const selected = route.startsWith("node:")
    ? nodes.find((n) => n.id === route.slice(5))
    : undefined;
  const pending = exams.filter((n) => !n.done);
  const favorites = nodes.filter((n) => n.pinned);
  const children = selected
    ? nodes.filter((n) => n.parent_id === selected.id)
    : [];
  const nav = [
    { id: "home", label: "Mi espacio", icon: LibraryBig },
    { id: "courses", label: "Asignaturas", icon: BookOpen },
    { id: "favorites", label: "Favoritos", icon: Star },
    { id: "exams", label: "Exámenes", icon: CalendarDays },
    { id: "memory", label: "Memoria", icon: History },
  ];
  const currentLabel = selected
    ? selected.title
    : nav.find((n) => n.id === route)?.label ||
      (route === "settings" ? "Ajustes" : "Mi espacio");
  const ancestorPath: Item[] = [];
  let ancestor = selected
    ? nodes.find((n) => n.id === selected.parent_id)
    : undefined;
  while (ancestor) {
    ancestorPath.unshift(ancestor);
    ancestor = nodes.find((n) => n.id === ancestor!.parent_id);
  }
  const results = query.trim()
    ? nodes
        .filter((n) =>
          (n.title + " " + n.content)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase().trim()),
        )
        .slice(0, 30)
    : notes.slice(0, 6);
  const make = (
    kind: Kind = "note",
    parent: string | null = selected &&
    ["course", "folder"].includes(selected.kind)
      ? selected.id
      : null,
  ) => setCreate({ kind, parent });
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a className="brand" href="#home">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          aula<span className="brand-dot">.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {state.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>El espacio de {state.name}</strong>
            <span>Personal · Curso 2026–27</span>
          </div>
          <LockKeyhole size={13} />
        </div>
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <Search size={16} />
          <span>Buscar en tus apuntes</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav className="main-nav" aria-label="Navegación principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={route === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "exams" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
              {id === "home" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-title">
          <span>TUS ASIGNATURAS</span>
          <button
            className="icon-button"
            onClick={() => make("course", null)}
            aria-label="Nueva asignatura"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="course-tree">
          {courses.length ? (
            courses.map((c) => (
              <TreeRow
                key={c.id}
                item={c}
                nodes={nodes}
                selected={route}
                navigate={navigate}
              />
            ))
          ) : (
            <button className="text-button" onClick={() => make("course")}>
              Crear mi primera asignatura
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <button className="chatgpt-card" onClick={() => setIntegration(true)}>
            <span className="chatgpt-card-icon">
              <Sparkles size={18} />
            </span>
            <strong>Tus ideas, conectadas.</strong>
            <p>Haz equipo con ChatGPT.</p>
            <span className="chatgpt-card-link">
              Preparar conexión
              <ArrowUpRight size={14} />
            </span>
          </button>
          <button
            className={
              "settings-link " + (route === "settings" ? "active" : "")
            }
            onClick={() => navigate("settings")}
          >
            <Settings size={17} />
            Ajustes y copias
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">
              {state.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{state.name}</strong>
              <span>
                <span className="status-dot" />
                {browserMode ? "Guardado en tu navegador" : "Espacio privado"}
              </span>
            </div>
            {!auth.local_mode && (
              <button
                className="icon-button"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={logout}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegación"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <button className="crumb-home" onClick={() => navigate("home")}>
              <LibraryBig size={15} />
              <span>Mi espacio</span>
            </button>
            {route !== "home" && (
              <>
                <ChevronRight size={13} />
                {ancestorPath.map((n) => (
                  <React.Fragment key={n.id}>
                    <button onClick={() => navigate("node:" + n.id)}>
                      {n.title}
                    </button>
                    <ChevronRight size={13} />
                  </React.Fragment>
                ))}
                <span className="current-crumb">{currentLabel}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <LockKeyhole size={12} />
              {browserMode ? "Este navegador" : "Solo tú"}
            </span>
            <button
              className="icon-button topbar-search"
              aria-label="Buscar"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </button>
            <span className="topbar-avatar">
              {state.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="main-content">
          {browserMode && (
            <div className="browser-storage-banner">
              <ShieldCheck size={15} />
              <span>
                Tus apuntes se guardan en este navegador. Para llevarlos a otro
                ordenador, descarga una copia.
              </span>
              <button
                className="text-button"
                onClick={() => navigate("settings")}
              >
                Copias
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          {route === "home" && (
            <>
              <div className="page-heading dashboard-heading">
                <div>
                  <div className="eyebrow">TU DÍA, UN POCO MÁS CLARO</div>
                  <h1>
                    Hola, {state.name}
                    <span className="greeting-dot">.</span>
                  </h1>
                  <p>Todo lo que aprendes, en un mismo lugar.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => make("note", null)}
                >
                  <Plus size={17} />
                  Crear nuevo
                </button>
              </div>
              <section className="welcome-banner">
                <div>
                  <span className="semester-badge">
                    <span className="status-dot" />
                    CURSO 2026 — 2027
                  </span>
                  <h2>
                    Un poco de orden.
                    <br />
                    <em>Más espacio para pensar.</em>
                  </h2>
                  <p>
                    De la primera clase al último examen.
                    <br />
                    Construye tu curso, una idea a la vez.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("courses")}
                  >
                    Explorar mis asignaturas
                    <ArrowRight size={16} />
                  </button>
                </div>
                <BookIllustration />
                <span className="hero-corner">
                  HECHO PARA TU MANERA DE APRENDER
                </span>
              </section>
              <div className="dashboard-stats">
                <span>
                  <span className="stat-icon">
                    <BookOpen size={17} />
                  </span>
                  <strong>{courses.length}</strong> asignaturas
                </span>
                <span>
                  <span className="stat-icon">
                    <NotebookPen size={17} />
                  </span>
                  <strong>{notes.length}</strong>{" "}
                  {notes.length === 1 ? "apunte" : "apuntes"}
                </span>
                <span>
                  <span className="stat-icon">
                    <CalendarDays size={17} />
                  </span>
                  <strong>{pending.length}</strong> exámenes pendientes
                </span>
                <span className="stats-message">
                  <Leaf size={15} />A tu ritmo. A tu manera.
                </span>
              </div>
              <section className="courses-section">
                <div className="section-heading">
                  <h2>
                    Tus asignaturas{" "}
                    <span className="count-pill">{courses.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => navigate("courses")}
                  >
                    Ver todas
                    <ArrowRight size={15} />
                  </button>
                </div>
                {courses.length ? (
                  <div className="course-grid">
                    {courses.slice(0, 6).map((c, i) => (
                      <CourseCard
                        key={c.id}
                        item={c}
                        index={i}
                        nodes={nodes}
                        navigate={navigate}
                        pin={pin}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={BookOpen}
                    title="El curso empieza aquí"
                    text="Cada asignatura es un pequeño mundo. Crea la primera."
                    action="Nueva asignatura"
                    onClick={() => make("course", null)}
                  />
                )}
              </section>
              <div className="dashboard-bottom">
                <section className="recent-section">
                  <div className="section-heading">
                    <h2>Para seguir donde lo dejaste</h2>
                    <span className="section-caption">Recientes</span>
                  </div>
                  <div className="recent-list">
                    {notes.length ? (
                      notes
                        .slice(0, 4)
                        .map((n) => (
                          <ItemRow
                            key={n.id}
                            item={n}
                            nodes={nodes}
                            navigate={navigate}
                            pin={pin}
                          />
                        ))
                    ) : (
                      <Empty
                        title="Aquí aparecerán tus apuntes"
                        text="Cada idea que guardes tendrá un lugar al que volver."
                      />
                    )}
                  </div>
                </section>
                <section className="next-exam">
                  <div className="section-heading">
                    <h2>En el horizonte</h2>
                    <CalendarDays size={17} />
                  </div>
                  {pending.length ? (
                    <>
                      <span className="next-exam-date">
                        {pending[0].due_date
                          ? dateLabel(pending[0].due_date + "T12:00:00")
                          : "Sin fecha todavía"}
                      </span>
                      <h3>{pending[0].title}</h3>
                      <p>
                        {pending[0].parent_id
                          ? fullPath(pending[0], nodes)
                              .split(" / ")
                              .slice(0, -1)
                              .join(" / ")
                          : "Tu próximo examen"}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => navigate("node:" + pending[0].id)}
                      >
                        Preparar examen
                        <ArrowRight size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="exam-doodle">
                        <CalendarDays size={25} strokeWidth={1.4} />
                        <Check size={16} />
                      </span>
                      <h3>Un paso por delante.</h3>
                      <p>Añade tus exámenes y prepara cada uno con tiempo.</p>
                      <button
                        className="text-button"
                        onClick={() => make("exam", null)}
                      >
                        <Plus size={15} />
                        Añadir un examen
                      </button>
                    </>
                  )}
                </section>
              </div>
              <footer className="page-footer">
                <span>Un lugar para aprender. Y para recordar.</span>
                <span>
                  <LockKeyhole size={12} />
                  Tu Aula, solo tuya.
                </span>
              </footer>
            </>
          )}
          {route === "courses" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">HES-SO · GENÈVE</div>
                  <h1>Cada clase, su lugar.</h1>
                  <p>
                    Tus {courses.length} asignaturas, organizadas a tu manera.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => make("course", null)}
                >
                  <Plus size={17} />
                  Nueva asignatura
                </button>
              </div>
              <div className="section-heading">
                <h2>Curso 2026 — 2027</h2>
                <span className="section-caption">
                  {courses.length} asignaturas
                </span>
              </div>
              <div className="course-grid all-courses">
                {courses.map((c, i) => (
                  <CourseCard
                    key={c.id}
                    item={c}
                    index={i}
                    nodes={nodes}
                    navigate={navigate}
                    pin={pin}
                  />
                ))}
              </div>
              {!courses.length && (
                <Empty
                  icon={BookOpen}
                  title="El curso empieza aquí"
                  text="Crea una asignatura para empezar a organizar tus clases."
                  action="Nueva asignatura"
                  onClick={() => make("course", null)}
                />
              )}
            </>
          )}
          {selected && ["course", "folder"].includes(selected.kind) && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {selected.kind === "course"
                      ? "TU ASIGNATURA"
                      : "UN LUGAR PARA TUS IDEAS"}
                  </div>
                  <h1>{selected.title}</h1>
                  <p>
                    {selected.kind === "course"
                      ? selected.content ||
                        "Organiza tus temas, apuntes y exámenes."
                      : "Cada idea tiene su sitio. Sigue construyendo el tuyo."}
                  </p>
                </div>
                <div className="heading-actions">
                  <button
                    className="icon-button"
                    aria-label="Renombrar apartado"
                    onClick={() => {
                      setRename(selected);
                      setNewTitle(selected.title);
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label="Eliminar apartado"
                    onClick={() => remove(selected)}
                  >
                    <Trash2 size={17} />
                  </button>
                  <button className="button primary" onClick={() => make()}>
                    <Plus size={17} />
                    Crear aquí
                  </button>
                </div>
              </div>
              <div className="folder-toolbar">
                <span>{children.length} elementos</span>
                <button className="text-button" onClick={() => make("folder")}>
                  <FolderPlus size={16} />
                  Nueva carpeta
                </button>
              </div>
              {children.filter((n) => n.kind === "folder").length > 0 && (
                <div className="folder-grid">
                  {children
                    .filter((n) => n.kind === "folder")
                    .map((n) => (
                      <button
                        key={n.id}
                        className={"folder-card palette-" + n.color}
                        onClick={() => navigate("node:" + n.id)}
                      >
                        <Folder size={28} strokeWidth={1.4} />
                        <strong>{n.title}</strong>
                        <span>
                          {nodes.filter((x) => x.parent_id === n.id).length}{" "}
                          elementos
                          <ChevronRight size={16} />
                        </span>
                      </button>
                    ))}
                </div>
              )}
              <div className="document-list">
                {children
                  .filter((n) => n.kind !== "folder")
                  .map((n) => (
                    <ItemRow
                      key={n.id}
                      item={n}
                      nodes={nodes}
                      navigate={navigate}
                      pin={pin}
                      toggleDone={toggleDone}
                    />
                  ))}
              </div>
              {!children.length && (
                <Empty
                  icon={Folder}
                  title="Hay espacio para lo que viene"
                  text="Crea carpetas para organizar cada tema, o empieza con un apunte."
                  action="Crear mi primer apunte"
                  onClick={() => make("note")}
                />
              )}
              {children.length > 0 && (
                <button className="add-another" onClick={() => make("note")}>
                  <Plus size={17} />
                  Añadir un apunte aquí
                </button>
              )}
            </>
          )}
          {selected && ["note", "exam"].includes(selected.kind) && (
            <Editor
              key={selected.id}
              item={selected}
              nodes={nodes}
              save={save}
              remove={remove}
              pin={pin}
              dirtyChange={dirtyChange}
              toast={toast}
            />
          )}
          {route.startsWith("node:") && !selected && (
            <Empty
              icon={Folder}
              title="Este apartado ya no está aquí"
              text="Puede que se haya eliminado o que hayas importado otra copia."
              action="Volver a mi espacio"
              onClick={() => navigate("home")}
            />
          )}
          {route === "favorites" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A MANO, SIEMPRE</div>
                  <h1>Lo que quieres tener cerca.</h1>
                  <p>
                    Tus asignaturas y apuntes favoritos, sin tener que
                    buscarlos.
                  </p>
                </div>
                <Star size={26} className="favorite-page-star" />
              </div>
              {favorites.length ? (
                <div className="document-list">
                  {favorites.map((n) => (
                    <ItemRow
                      key={n.id}
                      item={n}
                      nodes={nodes}
                      navigate={navigate}
                      pin={pin}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Star}
                  title="Tus imprescindibles, aquí"
                  text="Pulsa la estrella de una asignatura o un apunte para tenerlo siempre a mano."
                />
              )}
            </>
          )}
          {route === "exams" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">UN PASO POR DELANTE</div>
                  <h1>Preparar. Repasar. Respirar.</h1>
                  <p>
                    Cada examen, con sus apuntes y su fecha en un mismo lugar.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => make("exam", null)}
                >
                  <Plus size={17} />
                  Nuevo examen
                </button>
              </div>
              <div className="filter-tabs">
                {[
                  ["pending", "Pendientes", pending.length],
                  ["done", "Completados", exams.filter((n) => n.done).length],
                  ["all", "Todos", exams.length],
                ].map(([id, label, count]) => (
                  <button
                    key={id}
                    className={examFilter === id ? "active" : ""}
                    onClick={() => setExamFilter(String(id))}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>
              {exams.filter(
                (n) =>
                  examFilter === "all" ||
                  (examFilter === "done" ? n.done : !n.done),
              ).length ? (
                <div className="document-list">
                  {exams
                    .filter(
                      (n) =>
                        examFilter === "all" ||
                        (examFilter === "done" ? n.done : !n.done),
                    )
                    .map((n) => (
                      <ItemRow
                        key={n.id}
                        item={n}
                        nodes={nodes}
                        navigate={navigate}
                        pin={pin}
                        toggleDone={toggleDone}
                      />
                    ))}
                </div>
              ) : (
                <Empty
                  icon={CalendarDays}
                  title={
                    examFilter === "done"
                      ? "Cada paso cuenta"
                      : "Tu próxima meta empieza aquí"
                  }
                  text={
                    examFilter === "done"
                      ? "Los exámenes que marques como completados aparecerán aquí."
                      : "Añade un examen, su fecha y lo que necesitas repasar. A tu ritmo."
                  }
                  action={examFilter !== "done" ? "Añadir examen" : undefined}
                  onClick={() => make("exam", null)}
                />
              )}
            </>
          )}
          {route === "memory" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">UN HILO PARA RECORDAR</div>
                  <h1>Tu curso deja huella.</h1>
                  <p>Lo que creas y cambias, en un registro de actividad.</p>
                </div>
                <span className="badge sage">
                  <History size={13} />
                  Últimas 200 acciones
                </span>
              </div>
              <div className="memory-notice">
                <BrainCircuit size={20} />
                <p>
                  Esta memoria registra el trabajo en Aula. Las acciones de tu
                  GPT conectado también aparecen aquí; las conversaciones de
                  ChatGPT no se importan automáticamente.
                </p>
              </div>
              <div className="timeline">
                {activity.map((a) => {
                  const Icon =
                    a.actor === "ChatGPT"
                      ? Sparkles
                      : a.action === "deleted"
                        ? Trash2
                        : a.action === "completed"
                          ? Check
                          : a.action === "restored"
                            ? RotateCcw
                            : FileText;
                  return (
                    <div className="timeline-entry" key={a.id}>
                      <span className="timeline-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <span className="timeline-action">
                          {a.actor} ·{" "}
                          {(
                            {
                              created: "Creado",
                              updated: "Actualizado",
                              deleted: "Eliminado",
                              completed: "Completado",
                              restored: "Restaurado",
                              key_created: "Conexión preparada",
                              key_revoked: "Acceso revocado",
                            } as Record<string, string>
                          )[a.action] || a.action}
                        </span>
                        {a.node_id && nodes.some((n) => n.id === a.node_id) ? (
                          <button onClick={() => navigate("node:" + a.node_id)}>
                            {a.title}
                            <ArrowUpRight size={14} />
                          </button>
                        ) : (
                          <strong>{a.title}</strong>
                        )}
                        <span className="timeline-date">
                          {dateLabel(a.created_at)} ·{" "}
                          {new Date(a.created_at).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Madrid",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!activity.length && (
                <Empty
                  icon={History}
                  title="Aquí empieza tu historia"
                  text="A medida que crees apuntes y carpetas, Aula registrará tu actividad."
                />
              )}
            </>
          )}
          {route === "settings" && (
            <SettingsPage
              state={state}
              refresh={refresh}
              toast={toast}
              localMode={auth.local_mode}
            />
          )}
        </main>
      </div>
      {create && (
        <CreateModal
          nodes={nodes}
          initialParent={create.parent}
          initialKind={create.kind}
          onClose={() => setCreate(null)}
          onCreated={async (item) => {
            setCreate(null);
            await refresh();
            navigate("node:" + item.id);
            toast(labels[item.kind] + " creado");
          }}
        />
      )}
      {integration && (
        <Integration
          state={state}
          onClose={() => setIntegration(false)}
          refresh={refresh}
          toast={toast}
        />
      )}
      {rename && (
        <Modal
          title="Un nombre que encaje"
          subtitle="Renombra este apartado sin cambiar lo que contiene."
          onClose={() => setRename(null)}
        >
          <form onSubmit={doRename}>
            <label>
              Nombre
              <input
                required
                maxLength={160}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRename(null)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Guardar nombre
              </button>
            </div>
          </form>
        </Modal>
      )}
      {searchOpen && (
        <Modal
          wide
          title="Encuentra esa idea"
          onClose={() => {
            setSearchOpen(false);
            setQuery("");
          }}
        >
          <div className="search-input">
            <Search size={20} />
            <input
              autoFocus
              aria-label="Buscar en Aula"
              placeholder="Una asignatura, un tema, una frase de tus apuntes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="search-results">
            <span className="eyebrow">
              {query.trim()
                ? `${results.length} RESULTADOS`
                : "APUNTES RECIENTES"}
            </span>
            {results.map((n) => {
              const Icon = itemIcon(n.kind);
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    navigate("node:" + n.id);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  <span className={"document-icon palette-" + n.color}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{n.title}</strong>
                    <span>{fullPath(n, nodes)}</span>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
            {!results.length && (
              <Empty
                icon={Search}
                title="Todavía no aparece"
                text="Prueba con otra palabra o crea un apunte nuevo."
              />
            )}
          </div>
        </Modal>
      )}
      {toastMessage && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toastMessage}
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Cerrar error"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
