import { test, expect } from "@playwright/test";

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
  await expect(
    page.getByRole("heading", { name: "Hola, Ginés." }),
  ).toBeVisible();
  await expect(page.locator(".browser-storage-banner")).toContainText(
    "este navegador",
  );
  await page.goto("./#courses");
  await expect(page.locator(".course-card")).toHaveCount(9);
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
  await expect(page.locator('.markdown')).toContainText('Este contenido viaja con mi copia.');
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
