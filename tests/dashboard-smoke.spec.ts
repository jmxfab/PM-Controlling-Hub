import { test, expect } from "@playwright/test";

test("dashboard shell renders", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Controlling Dashboard" })
  ).toBeVisible();
  await expect(
    page.getByText("Operativer Überblick über Projekte, Status, Dokumente und Verlauf.")
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByRole("combobox", { name: "Zeitraum" })).toBeVisible();

  await page.getByRole("tab").nth(1).click();
  await expect(page).toHaveURL(/department=PV/);

  await page.getByRole("combobox", { name: "Zeitraum" }).click();
  await page.getByRole("option", { name: "14 Tage" }).click();

  await expect(page).toHaveURL(/department=PV/);
  await expect(page).toHaveURL(/timeframe=14d/);
  await expect(page.getByText("Projekte im Überblick").first()).toBeVisible();

  const detailButtons = page.getByRole("button", { name: /Details zu/i });
  await expect(detailButtons.first()).toBeVisible();
  await detailButtons.first().click();
  await expect(page.getByText(/Dokumente/).first()).toBeVisible();

  await page.getByRole("combobox", { name: "Zeitraum" }).click();
  await page.getByRole("option", { name: "Frei" }).click();

  await expect(page.getByLabel("Von")).toBeVisible();
  await expect(page.getByLabel("Bis")).toBeVisible();
});
