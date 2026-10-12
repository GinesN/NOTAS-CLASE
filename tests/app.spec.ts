import { test, expect } from "@playwright/test";

test("un apunte guardado desde fuera aparece al volver a la web", async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hola, Ginés.' })).toBeVisible();
  const response = await request.post('/api/nodes', { data: { kind: 'note', title: 'Apunte recién guardado desde Codex', content: 'Una idea nueva' } });
  const item = await response.json();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.recent-list')).toContainText('Apunte recién guardado desde Codex');
  await request.delete('/api/nodes/' + item.id);
});

test("las nueve asignaturas, navegación y móvil sin desbordamiento", async ({
  page,
}) => {
  await page.goto("/#courses");
  await expect(
    page.getByRole("heading", { name: "Cada clase, su lugar." }),
  ).toBeVisible();
  await expect(page.locator(".course-card")).toHaveCount(9);
  await page
    .locator(".course-card-link")
    .filter({ hasText: "International Trade" })
    .click();
  await expect(
    page.getByRole("heading", { name: "International Trade", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Temas 1 elementos" }).click();
  await page.getByRole("button", { name: "Tema 1 1 elementos" }).click();
  await page.getByRole("button", { name: "Apuntes 0 elementos" }).click();
  await expect(
    page.getByRole("heading", { name: "Hay espacio para lo que viene" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("crear, editar, buscar y recordar un apunte", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear nuevo", exact: true }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Prueba de ventaja comparativa");
  await page
    .getByLabel("Guardar en")
    .selectOption({ label: "International Trade / Temas / Tema 1 / Apuntes" });
  await page.getByRole("button", { name: "Crear apunte", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prueba de ventaja comparativa" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Contenido del apunte" })
    .fill("## Ricardo\n\n**Coste de oportunidad** y especialización.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".markdown")).toContainText("Coste de oportunidad");
  await page.reload();
  await expect(page.locator(".markdown")).toContainText("Coste de oportunidad");
  await page.getByRole("button", { name: "Marcar como favorito" }).click();
  await page.goto("/#favorites");
  await expect(page.locator(".item-row")).toContainText([
    "Prueba de ventaja comparativa",
  ]);
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Buscar en Aula" })
    .fill("especialización");
  await expect(page.locator(".search-results")).toContainText(
    "Prueba de ventaja comparativa",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.goto("/#memory");
  await expect(page.locator(".timeline")).toContainText(
    "Prueba de ventaja comparativa",
  );
  const state = await (await request.get("/api/state")).json();
  const item = state.nodes.find(
    (n: { title: string }) => n.title === "Prueba de ventaja comparativa",
  );
  await request.delete("/api/nodes/" + item.id);
});

test("crear un examen, marcarlo completo y exportar una copia", async ({
  page,
  request,
}) => {
  await page.goto("/#exams");
  await page.getByRole("button", { name: "Nuevo examen", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Examen de prueba");
  await page.getByLabel("Fecha del examen").fill("2026-12-15");
  await page.getByRole("button", { name: "Crear examen", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Contenido del apunte" })
    .fill("Repasar los temas 1 y 2.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator('.markdown')).toContainText('Repasar los temas 1 y 2.');
  await page.goto("/#exams");
  await page
    .getByRole("button", { name: "Completar Examen de prueba" })
    .click();
  await page.getByRole("button", { name: /Completados/ }).click();
  await expect(page.locator(".document-list")).toContainText(
    "Examen de prueba",
  );
  await page.goto("/#settings");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar copia", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toMatch(
    /^aula-copia-.*\.json$/,
  );
  const state = await (await request.get("/api/state")).json();
  await request.delete(
    "/api/nodes/" +
      state.nodes.find((n: { title: string }) => n.title === "Examen de prueba")
        .id,
  );
});

test("conexión explícita, clave y revocación", async ({ page, request }) => {
  await page.goto("/");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.locator(".chatgpt-card").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Pendiente de alojamiento",
  );
  await page.getByRole("button", { name: "Crear clave de conexión" }).click();
  const key = await page.locator(".key-result code").innerText();
  const response = await request.get("/api/chatgpt/tree", {
    headers: { Authorization: "Bearer " + key },
  });
  expect(response.status()).toBe(200);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revocar acceso" }).click();
  await expect(page.locator(".key-result")).toHaveCount(0);
  expect(
    (
      await request.get("/api/chatgpt/tree", {
        headers: { Authorization: "Bearer " + key },
      })
    ).status(),
  ).toBe(401);
});

test("los apuntes con HTML se muestran como texto", async ({
  page,
  request,
}) => {
  const content =
    '<img src=x onerror="window.hacked=true">\n\n[enlace](javascript:alert(1))';
  const response = await request.post("/api/nodes", {
    data: { kind: "note", title: "Prueba de texto seguro", content },
  });
  const item = await response.json();
  await page.goto("/#node:" + item.id);
  await expect(page.locator(".markdown")).toContainText("<img");
  await expect(page.locator(".markdown img")).toHaveCount(0);
  await expect(page.locator(".markdown a")).toHaveCount(0);
  await request.delete("/api/nodes/" + item.id);
});
