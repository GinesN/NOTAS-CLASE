import type { ClassSchedule, Item } from "./model";
export const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function validTime(value: unknown): string {
  if (
    typeof value !== "string" ||
    (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
  )
    throw new Error("La hora debe tener el formato HH:MM.");
  return value;
}
export function cleanSchedule(
  value: unknown,
  nodes: Item[],
): Record<string, ClassSchedule> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El horario no es válido.");
  const result: Record<string, ClassSchedule> = {};
  for (const [courseId, raw] of Object.entries(value)) {
    if (
      !nodes.some((n) => n.id === courseId && n.kind === "course") ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      throw new Error("Una asignatura del horario no existe.");
    const slot = raw as Record<string, unknown>;
    if (
      !Number.isInteger(slot.weekday) ||
      Number(slot.weekday) < 0 ||
      Number(slot.weekday) > 6
    )
      throw new Error("Selecciona un día de la semana válido.");
    const start = validTime(slot.start);
    const end = validTime(slot.end);
    if (!start || !end || end <= start)
      throw new Error("La hora de fin debe ser posterior a la de inicio.");
    const room = slot.room ?? "";
    if (typeof room !== "string" || room.length > 100)
      throw new Error("El aula puede tener hasta 100 caracteres.");
    result[courseId] = { weekday: Number(slot.weekday), start, end, room };
  }
  return result;
}
export function importSchedule(
  value: unknown,
  nodes: Item[],
  existing: Record<string, ClassSchedule>,
): Record<string, ClassSchedule> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("El archivo de horario no es válido.");
  const data = value as Record<string, unknown>;
  if (
    data.app !== "AulaSchedule" ||
    data.version !== 1 ||
    !Array.isArray(data.courses) ||
    data.courses.length > 100
  )
    throw new Error("No es un archivo de horario de Aula compatible.");
  const slots = { ...existing };
  const assigned = new Set<string>();
  for (const raw of data.courses) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Una clase del horario no es válida.");
    const row = raw as Record<string, unknown>;
    if (typeof row.title !== "string")
      throw new Error("Falta el nombre de una asignatura.");
    const key = row.title.trim().toLocaleLowerCase();
    const found = nodes.filter(
      (n) =>
        n.kind === "course" &&
        [n.title, n.content].some((s) => s.trim().toLocaleLowerCase() === key),
    );
    if (found.length !== 1 || assigned.has(found[0].id))
      throw new Error(
        "No se puede identificar de forma única la asignatura: " + row.title,
      );
    assigned.add(found[0].id);
    slots[found[0].id] = row as unknown as ClassSchedule;
  }
  return cleanSchedule(slots, nodes);
}
export function courseFor(
  parentId: string | null,
  nodes: Item[],
): Item | undefined {
  let node = nodes.find((n) => n.id === parentId);
  while (node && node.kind !== "course")
    node = nodes.find((n) => n.id === node!.parent_id);
  return node;
}
export function scheduleLabel(slot?: ClassSchedule): string {
  return slot
    ? `${weekdays[slot.weekday]} · ${slot.start}–${slot.end}${slot.room ? " · " + slot.room : ""}`
    : "Horario sin añadir";
}
