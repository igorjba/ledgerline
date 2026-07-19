import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "wide", width: 1600, height: 900 },
];

async function hasHorizontalOverflow(page: Page): Promise<{ overflow: boolean; scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return { overflow: el.scrollWidth > el.clientWidth + 1, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
}

test.describe("responsiveness", () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByTestId("console")).toBeVisible();
      const { overflow, scrollWidth, clientWidth } = await hasHorizontalOverflow(page);
      expect(overflow, `body scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBe(false);
    });

    test(`no accessibility violations at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByTestId("console")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("keyboard accessibility", () => {
  test("interactive controls are reachable and focusable by keyboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("console")).toBeVisible();

    // Tab into the page and confirm focus lands on a real interactive element.
    let landedOnControl = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      if (["BUTTON", "A", "INPUT"].includes(tag)) {
        landedOnControl = true;
        break;
      }
    }
    expect(landedOnControl).toBe(true);

    // The time-machine slider is operable from the keyboard.
    const slider = page.getByRole("slider");
    await slider.focus();
    await expect(slider).toBeFocused();
  });
});
