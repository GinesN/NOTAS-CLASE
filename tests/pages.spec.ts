import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("horario importado conserva datos anteriores y propone una hora de examen editable", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Crear nuevo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Mi pregunta guardada");
  await page.getByRole("button", { name: "Crear apunte", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Contenido del apunte" })
    .fill("Pregunta y respuesta que deben conservarse.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".markdown")).toContainText("deben conservarse");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("aula:/NOTAS-CLASE/", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace", "readwrite");
        const store = tx.objectStore("workspace");
        const read = store.get("current");
        read.onsuccess = () => {
          const value = read.result;
          const removed = new Set<string>(
            value.nodes
              .filter((n: { title: string }) =>
                [
                  "Global HR Management",
                  "Design Thinking for AI and Digital Innovation",
                  "English Communication 3",
                ].includes(n.title),
              )
              .map((n: { id: string }) => n.id),
          );
          let changed = true;
          while (changed) {
            changed = false;
            for (const n of value.nodes)
              if (removed.has(n.parent_id) && !removed.has(n.id)) {
                removed.add(n.id);
                changed = true;
              }
          }
          value.nodes = value.nodes.filter(
            (n: { id: string }) => !removed.has(n.id),
          );
          for (const n of value.nodes) delete n.due_time;
          delete value.schedule;
          store.put(value, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(new Error("fixture failed"));
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.goto("./#schedule");
  const fixture = {
    app: "AulaSchedule",
    version: 1,
    add_courses: true,
    courses: [
      {
        title: "International Trade",
        weekday: 2,
        start: "10:15",
        end: "11:45",
        room: "Test room",
      },
      {
        title: "Global HR Management",
        weekday: 3,
        start: "09:00",
        end: "10:00",
        room: "",
      },
      {
        title: "Design Thinking for AI and Digital Innovation",
        weekday: 4,
        start: "09:00",
        end: "10:00",
        room: "",
      },
      {
        title: "English Communication 3",
        weekday: 5,
        start: "09:00",
        end: "10:00",
        room: "",
      },
    ],
  };
  await page
    .getByLabel("Importar archivo de horario")
    .setInputFiles({
      name: "horario-prueba.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await expect(page.getByRole("status")).toContainText("Horario importado");
  await expect(page.locator(".schedule-table tbody tr")).toHaveCount(12);
  await expect(
    page
      .locator(".schedule-table tr")
      .filter({ hasText: "International Trade" }),
  ).toContainText("10:15–11:45");
  await page.goto("./#home");
  await expect(page.locator(".recent-section .recent-list")).toContainText(
    "Mi pregunta guardada",
  );
  await page.getByRole("button", { name: "Crear nuevo", exact: true }).click();
  await page
    .locator(".type-picker")
    .getByRole("button", { name: "Examen", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Examen con horario");
  await page
    .getByLabel("Guardar en")
    .selectOption({ label: "International Trade / Exámenes" });
  await expect(page.getByLabel("Hora del examen")).toHaveValue("10:15");
  await page.getByLabel("Fecha del examen").fill("2026-12-15");
  await page.getByLabel("Hora del examen").fill("11:00");
  await page.getByRole("button", { name: "Crear examen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Examen con horario" }),
  ).toBeVisible();
  await page.goto("./#exams");
  await expect(page.locator(".item-row")).toContainText("11:00");
  await page.goto("./#memory");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar contexto", exact: true })
    .click();
  const file = await (await downloaded).path();
  const context = await readFile(file!, "utf8");
  expect(context).toContain("Pregunta y respuesta que deben conservarse.");
  expect(context).toContain("Martes · 10:15–11:45");
  expect(context).toContain("Hora: 11:00");
});

test("Pages funciona sin API y guarda un apunte tras recargar", async ({
  page,
}) => {
  const requests: string[] = [];
  const failures: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests.push(r.url());
  });
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Mi espacio" })).toBeVisible();
  await expect(page.locator(".browser-storage-banner")).toContainText(
    "este navegador",
  );
  await page.goto("./#courses");
  await expect(page.locator(".course-card")).toHaveCount(12);
  await page.goto("./#home");
  await page.getByRole("button", { name: "Crear nuevo", exact: true }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Resumen guardado en Pages");
  await page
    .getByLabel("Guardar en")
    .selectOption({ label: "International Trade / Temas / Tema 1 / Apuntes" });
  await page.getByRole("button", { name: "Crear apunte", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Contenido del apunte" })
    .fill("## Mi resumen\n\n**Una idea privada** en el navegador.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".markdown")).toContainText("Una idea privada");
  await page.reload();
  await expect(page.locator(".markdown")).toContainText("Una idea privada");
  expect(requests).toEqual([]);
  expect(failures).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("copia completa y restauración entre dos navegadores", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Crear nuevo", exact: true }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Para mi nuevo ordenador");
  await page.getByRole("button", { name: "Crear apunte", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Contenido del apunte" })
    .fill("Este contenido viaja con mi copia.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".markdown")).toContainText(
    "Este contenido viaja con mi copia.",
  );
  await page.goto("./#settings");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar copia", exact: true })
    .click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  const otherContext = await browser.newContext({
    viewport: page.viewportSize() || { width: 1440, height: 1000 },
  });
  const other = await otherContext.newPage();
  try {
    await other.goto("http://127.0.0.1:4182/NOTAS-CLASE/#settings");
    other.on("dialog", (d) => d.accept());
    await other.getByLabel("Importar copia de seguridad").setInputFiles(file!);
    await expect(other.getByRole("status")).toContainText(
      "Copia importada correctamente",
    );
    await other.goto("http://127.0.0.1:4182/NOTAS-CLASE/#home");
    await other
      .locator(".item-row-link")
      .filter({ hasText: "Para mi nuevo ordenador" })
      .click();
    await expect(other.locator(".markdown")).toContainText(
      "Este contenido viaja con mi copia.",
    );
  } finally {
    await otherContext.close();
  }
});

test("Pages no ofrece una conexión de ChatGPT inexistente", async ({
  page,
}) => {
  await page.goto("./");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.locator(".chatgpt-card").click();
  await expect(page.getByRole("dialog")).toContainText("Requiere servidor");
  await expect(
    page.getByRole("button", { name: "Crear clave de conexión" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.goto("./#settings");
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: /Leer la política/ }).click();
  await expect(
    (await popup).getByRole("heading", { name: "Tus apuntes son tuyos." }),
  ).toBeVisible();
});
