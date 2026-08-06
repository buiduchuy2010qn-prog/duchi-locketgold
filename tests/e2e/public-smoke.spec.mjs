import { test, expect } from "@playwright/test";

async function waitForApp(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector("#root");
    return Boolean(root && root.childElementCount > 0 && document.body.innerText.trim());
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/dio-api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
});

test("trang đăng nhập render ổn trên Android", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await expect(page).toHaveTitle(/Huy Locket/i);
  await expect(page.locator("#root")).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }));

  expect(layout.bodyTextLength).toBeGreaterThan(10);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 2);
  expect(pageErrors).toEqual([]);
});

test("đường dẫn không tồn tại tự quay về đăng nhập", async ({ page }) => {
  await page.goto("/__quality_gate_missing_route__", {
    waitUntil: "domcontentloaded",
  });
  await waitForApp(page);

  await expect(page).toHaveURL(/\/login(?:$|\?)/);
  await expect(page.locator("#root")).toBeVisible();
});

test("trang giới thiệu không bị màn hình trắng", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await expect(page).toHaveTitle(/Huy Locket/i);
  await expect(page.locator("#root")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
