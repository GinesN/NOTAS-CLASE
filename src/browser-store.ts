import type { Activity, Item, Kind, State } from "./model";
import courses from "../server/courses.json";

export const browserMode = import.meta.env.VITE_STORAGE_MODE === "browser";
type SavedState = {
  version: 1;
  name: string;
  nodes: Item[];
  activity: Activity[];
};
type ObjectData = Record<string, unknown>;
const kinds: Kind[] = ["course", "folder", "note", "exam"];
const colors = ["sage", "blue", "peach", "lavender", "yellow"];
const stamp = (previous?: string) =>
  new Date(
    Math.max(Date.now(), previous ? new Date(previous).getTime() + 1 : 0),
  ).toISOString();
const id = () => crypto.randomUUID();
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("aula:" + import.meta.env.BASE_URL, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspace");
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(
          new Error(
            "Tu navegador no permite guardar los datos de Aula. Revisa sus permisos de almacenamiento.",
          ),
        );
      };
      request.onblocked = () =>
        reject(
          new Error(
            "Cierra otras pestañas de Aula para actualizar el almacenamiento.",
          ),
        );
    });
  return database;
}

function log(
  state: SavedState,
  action: string,
  title: string,
  nodeId: string | null = null,
) {
  state.activity.unshift({
    id: id(),
    action,
    title,
    node_id: nodeId,
    actor: "Tú",
    created_at: stamp(),
  });
}

function object(value: unknown): ObjectData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El documento no es válido.");
  return value as ObjectData;
}

function date(value: unknown) {
  if (
    typeof value !== "string" ||
    (value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value))
  )
    throw new Error("La fecha no es válida.");
  return value;
}

function clean(
  raw: unknown,
  previous?: Item,
): Omit<Item, "id" | "created_at" | "updated_at"> {
  const data = { ...previous, ...object(raw) };
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.trim().length > 160
  )
    throw new Error("El título debe tener entre 1 y 160 caracteres.");
  if (!kinds.includes(data.kind as Kind))
    throw new Error("El tipo no es válido.");
  const color = data.color ?? "sage";
  const content = data.content ?? "";
  const parent = data.parent_id ?? null;
  if (!colors.includes(color as string))
    throw new Error("El color no es válido.");
  if (typeof content !== "string" || content.length > 1_000_000)
    throw new Error("El contenido supera el tamaño permitido.");
  if (parent !== null && typeof parent !== "string")
    throw new Error("La carpeta de destino no es válida.");
  if (data.kind === "course" && parent !== null)
    throw new Error("Las asignaturas van en el primer nivel.");
  const done = data.done ?? false;
  const pinned = data.pinned ?? false;
  if (
    ![true, false, 0, 1].includes(done as boolean) ||
    ![true, false, 0, 1].includes(pinned as boolean)
  )
    throw new Error("El estado no es válido.");
  return {
    title: data.title.trim(),
    kind: data.kind as Kind,
    color: color as string,
    content,
    parent_id: parent as string | null,
    due_date: date(data.due_date ?? ""),
    done: Boolean(done),
    pinned: Boolean(pinned),
  };
}

function parentValid(node: Pick<Item, "id" | "parent_id">, nodes: Item[]) {
  const lookup = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set([node.id]);
  let parent = node.parent_id;
  let depth = 0;
  while (parent) {
    if (seen.has(parent) || depth++ >= 100)
      throw new Error(
        "No puedes crear una estructura circular ni superar 100 niveles.",
      );
    seen.add(parent);
    const ancestor = lookup.get(parent);
    if (!ancestor || !["course", "folder"].includes(ancestor.kind))
      throw new Error("La carpeta de destino no existe.");
    parent = ancestor.parent_id;
  }
}

function create(state: SavedState, data: unknown, record = true) {
  const time = stamp();
  const node: Item = {
    ...clean(data),
    id: id(),
    created_at: time,
    updated_at: time,
  };
  parentValid(node, state.nodes);
  state.nodes.push(node);
  if (record) log(state, "created", node.title, node.id);
  return node;
}

function seed(): SavedState {
  const state: SavedState = {
    version: 1,
    name: "Ginés",
    nodes: [],
    activity: [],
  };
  for (const course of courses) {
    const root = create(
      state,
      {
        kind: "course",
        title: course.title,
        content: course.official,
        color: course.color,
      },
      false,
    );
    const topics = create(
      state,
      {
        kind: "folder",
        title: "Temas",
        parent_id: root.id,
        color: course.color,
      },
      false,
    );
    const topic = create(
      state,
      {
        kind: "folder",
        title: "Tema 1",
        parent_id: topics.id,
        color: course.color,
      },
      false,
    );
    create(
      state,
      {
        kind: "folder",
        title: "Apuntes",
        parent_id: topic.id,
        color: course.color,
      },
      false,
    );
    for (const title of ["Exámenes", "Recursos"])
      create(
        state,
        { kind: "folder", title, parent_id: root.id, color: course.color },
        false,
      );
  }
  create(
    state,
    {
      kind: "note",
      title: "Bienvenido a tu espacio",
      pinned: true,
      content:
        "# Todo tiene su lugar\n\nTus nueve asignaturas ya tienen un sitio. Puedes crear más carpetas dentro de cada tema, añadir apuntes y preparar tus exámenes.\n\n## Tus apuntes son tuyos\n\nEsta versión guarda los datos en este navegador, en tu dispositivo. No se publican en GitHub ni se sincronizan automáticamente con otros ordenadores.\n\n## Antes de cambiar de ordenador\n\nDescarga una copia en Ajustes e impórtala en el nuevo navegador. Haz copias periódicas: borrar los datos del navegador también borra esta instalación de Aula.\n\n## Trabaja con ChatGPT\n\nCopia el índice de tus asignaturas desde la sección ChatGPT. Para el guardado automático o sincronizar varios dispositivos necesitas la versión de Aula con servidor.",
    },
    false,
  );
  log(state, "created", "Tus nueve asignaturas y tu espacio de estudio");
  return state;
}

async function transaction<T>(
  change: (state: SavedState) => T,
  write = false,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const request = store.get("current");
    let result: T;
    let failure: Error | undefined;
    request.onsuccess = () => {
      try {
        const state: SavedState = request.result || seed();
        if (
          state.version !== 1 ||
          !Array.isArray(state.nodes) ||
          !Array.isArray(state.activity)
        )
          throw new Error(
            "Los datos guardados no son compatibles. Conserva una copia antes de restablecer el navegador.",
          );
        result = change(state);
        if (write || !request.result) store.put(state, "current");
      } catch (error) {
        failure = error as Error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        failure ||
          new Error(
            "No se pudo guardar. El almacenamiento puede estar lleno; descarga una copia y libera espacio.",
          ),
      );
    tx.onerror = () => {
      /* onabort reports the failure, preserving the previous state. */
    };
  });
}

function publicState(state: SavedState): State {
  return {
    nodes: state.nodes,
    activity: state.activity.slice(0, 200),
    name: state.name,
    api_enabled: false,
  };
}

function restore(raw: unknown, state: SavedState) {
  const backup = object(raw);
  if (
    backup.app !== "Aula" ||
    backup.version !== 1 ||
    !Array.isArray(backup.nodes) ||
    backup.nodes.length > 10000
  )
    throw new Error("No es una copia de Aula compatible (versión 1).");
  const ids = new Set<string>();
  const nodes: Item[] = backup.nodes.map((raw) => {
    const n = object(raw);
    const fields = clean(n);
    if (typeof n.id !== "string" || !n.id || n.id.length > 100 || ids.has(n.id))
      throw new Error(
        "La copia contiene identificadores inválidos o repetidos.",
      );
    ids.add(n.id);
    for (const field of ["created_at", "updated_at"])
      if (
        typeof n[field] !== "string" ||
        (n[field] as string).length > 40 ||
        !Number.isFinite(Date.parse(n[field] as string))
      )
        throw new Error("La copia contiene fechas inválidas.");
    return {
      ...fields,
      id: n.id,
      created_at: n.created_at as string,
      updated_at: n.updated_at as string,
    };
  });
  nodes.forEach((n) => parentValid(n, nodes));
  const rawHistory = backup.activity ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > 100000)
    throw new Error("El historial no es válido.");
  const activityIds = new Set<string>();
  const history: Activity[] = rawHistory
    .map((raw) => {
      const a = object(raw);
      for (const [key, limit] of [
        ["id", 100],
        ["title", 160],
        ["actor", 80],
        ["created_at", 40],
      ] as const)
        if (
          typeof a[key] !== "string" ||
          !(a[key] as string).length ||
          (a[key] as string).length > limit
        )
          throw new Error("El historial contiene datos inválidos.");
      if (
        ![
          "created",
          "updated",
          "deleted",
          "completed",
          "restored",
          "key_created",
          "key_revoked",
        ].includes(a.action as string) ||
        !Number.isFinite(Date.parse(a.created_at as string)) ||
        activityIds.has(a.id as string) ||
        (a.node_id !== null && typeof a.node_id !== "string")
      )
        throw new Error("El historial contiene datos inválidos.");
      activityIds.add(a.id as string);
      return {
        id: a.id as string,
        action: a.action as string,
        title: a.title as string,
        actor: a.actor as string,
        created_at: a.created_at as string,
        node_id: a.node_id as string | null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  state.nodes = nodes;
  state.activity = history;
  if (
    typeof backup.name === "string" &&
    backup.name.trim() &&
    backup.name.length <= 80
  )
    state.name = backup.name.trim();
  log(state, "restored", "Copia de seguridad importada");
}

export async function browserApi<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const write = method !== "GET";
  return transaction((state) => {
    if (path === "/auth/status")
      return {
        authenticated: true,
        setup_required: false,
        name: state.name,
        local_mode: true,
      } as T;
    if (path === "/state") return publicState(state) as T;
    if (path === "/health")
      return { status: "ok", app: "Aula", storage: "browser" } as T;
    if (path === "/backup")
      return {
        app: "Aula",
        version: 1,
        exported_at: stamp(),
        name: state.name,
        nodes: state.nodes,
        activity: state.activity,
      } as T;
    if (method === "POST" && path === "/restore") {
      restore(body, state);
      return publicState(state) as T;
    }
    if (method === "POST" && path === "/nodes") return create(state, body) as T;
    if (path.startsWith("/nodes/")) {
      const nodeId = path.slice("/nodes/".length);
      const index = state.nodes.findIndex((n) => n.id === nodeId);
      const previous = state.nodes[index];
      if (!previous) throw new Error("Este documento ya no existe.");
      if (method === "PATCH") {
        const data = object(body);
        if (data.kind && data.kind !== previous.kind)
          throw new Error("El tipo del documento no puede cambiarse.");
        if (
          data.expected_updated_at &&
          data.expected_updated_at !== previous.updated_at
        )
          throw new Error(
            "El apunte cambió en otra pestaña. Copia tus cambios y vuelve a abrirlo.",
          );
        const updated: Item = {
          ...previous,
          ...clean(data, previous),
          updated_at: stamp(previous.updated_at),
        };
        parentValid(updated, state.nodes);
        state.nodes[index] = updated;
        log(
          state,
          updated.done && !previous.done ? "completed" : "updated",
          updated.title,
          updated.id,
        );
        return updated as T;
      }
      if (method === "DELETE") {
        const removed = new Set([nodeId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of state.nodes)
            if (n.parent_id && removed.has(n.parent_id) && !removed.has(n.id)) {
              removed.add(n.id);
              changed = true;
            }
        }
        state.nodes = state.nodes.filter((n) => !removed.has(n.id));
        log(state, "deleted", previous.title);
        return { ok: true } as T;
      }
    }
    throw new Error(
      "Esta función necesita la versión de Aula con servidor. GitHub Pages guarda los datos en tu navegador.",
    );
  }, write);
}
