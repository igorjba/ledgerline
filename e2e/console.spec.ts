import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("billing console", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the seeded scenario with a balanced ledger", async ({ page }) => {
    const console = page.getByTestId("console");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/cobra pela leitura/i);
    await expect(console.getByRole("heading", { name: "Livro-razão · partida dobrada", exact: true })).toBeVisible();
    await expect(console.getByText(/Σ =/)).toContainText("✓");
    await expect(console.getByRole("heading", { name: "Fatura", exact: true })).toBeVisible();
  });

  test("ingesting, correcting and reconciling keeps the books balanced", async ({ page }) => {
    const console = page.getByTestId("console");
    await console.getByRole("button", { name: "Adicionar", exact: true }).click();
    await console.getByRole("button", { name: /Corrigir a mais antiga/ }).click();
    await expect(console.getByText(/difere da emitida/)).toBeVisible();
    await console.getByRole("button", { name: "Reconciliar" }).click();
    await expect(console.getByText(/Σ =/)).toContainText("✓");
  });

  test("draining the outbox marks events sent", async ({ page }) => {
    const console = page.getByTestId("console");
    await console.getByRole("button", { name: "Adicionar", exact: true }).click();
    const drain = console.getByRole("button", { name: "drenar" });
    await expect(drain).toBeEnabled();
    await drain.click();
    await expect(console.getByText("0 pendentes")).toBeVisible();
  });

  test("the invariant harness finds no counterexamples", async ({ page }) => {
    const console = page.getByTestId("console");
    await console.getByRole("button", { name: /rodar 5\.000/ }).click();
    await expect(console.getByText(/Σ = 0 vale/)).toBeVisible({ timeout: 30_000 });
  });

  test("help icons reveal a plain-language tooltip on hover and focus", async ({ page }) => {
    const console = page.getByTestId("console");
    const help = console.getByRole("button", { name: "O que é: Fatura" });
    await expect(page.getByRole("tooltip")).toHaveCount(0); // hidden until interacted
    await help.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    // Also reachable by keyboard.
    await help.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("has no accessibility violations", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("captures the console screenshot for the README", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1000 });
    const console = page.getByTestId("console");
    await console.getByRole("button", { name: /rodar 5\.000/ }).click();
    await console.getByText(/Σ = 0 vale/).waitFor({ timeout: 30_000 });
    await expect(console).toBeVisible();
    await console.screenshot({ path: "docs/console.png" });
  });
});
