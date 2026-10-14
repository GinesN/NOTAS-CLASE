import { test, expect } from "@playwright/test";

test("correo sin configurar explica los pasos sin mostrar una cuenta conectada", async ({ page }) => {
  await page.goto("/#emails");
  await expect(page.getByRole("heading", { name: "Emails", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conecta tu Outlook personal" })).toBeVisible();
  await expect(page.locator(".mail-note")).toContainText("La cuenta todavía no está conectada");
  await expect(page.getByRole("button", { name: "Conectar con Microsoft" })).toHaveCount(0);
});

test("correo inglés con resumen, filtro por curso y consulta del original", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/api/mail/status", (route) => route.fulfill({ json: {
    connected: true, configured: true, ai_configured: true, syncing: false,
    account: "test@example.com", last_sync: "2026-01-10T10:00:00Z", error: "", total: 2, pending: 1,
  } }));
  await page.route("**/api/mail/messages", (route) => route.fulfill({ json: { messages: [
    { id: "test-exam", original: { subject: "Examen de commerce", body: "Bonjour. Examen vendredi. <script>alert('test')</script>",
      sender: "Test Teacher", address: "teacher@example.com", received: "2026-01-10T09:00:00Z", unread: true,
      link: "https://outlook.live.com/mail/0/inbox/id/test" }, brief: {
      subject: "Trade exam", body: "Hello. Exam on Friday.", summary: "A trade exam is scheduled for Friday. Check the details.",
      category: "Exam", priority: "High", course: "International Trade", action: "Check the exam details.", truncated: false,
    } },
    { id: "test-pending", original: { subject: "Informations", body: "Courriel non traduit.",
      sender: "Administration", address: "admin@example.com", received: "2026-01-09T09:00:00Z", unread: false, link: "" }, brief: null },
  ] } }));
  await page.goto("/#emails");
  await expect(page.locator(".mail-row")).toHaveCount(2);
  await expect(page.locator(".mail-row").first()).toContainText("A trade exam is scheduled");
  await page.getByLabel("Filter by course").selectOption("International Trade");
  await expect(page.locator(".mail-row")).toHaveCount(1);
  await page.locator(".mail-row").click();
  await expect(page.getByRole("dialog")).toContainText("Hello. Exam on Friday.");
  await expect(page.getByRole("link", { name: "Open in Outlook" })).toHaveAttribute("href", "https://outlook.live.com/mail/0/inbox/id/test");
  await page.getByRole("button", { name: "Show original" }).click();
  await expect(page.locator(".mail-body")).toContainText("Bonjour. Examen vendredi.");
  await expect(page.locator(".mail-body script")).toHaveCount(0);
  await page.getByRole("button", { name: "Close email" }).click();
  await page.getByLabel("Filter by course").selectOption("");
  await page.getByLabel("Filter emails").selectOption("Pending");
  await expect(page.locator(".mail-row")).toHaveCount(1);
  await expect(page.locator(".mail-row")).toContainText("Translation pending");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(failures).toEqual([]);
});
