import { expect, test } from "@playwright/test";

test("M8.1: create constraint and see operatorId+params in model", async ({ page }) => {
  await page.goto("/");

  const track = page.getByTestId("timeline-track");
  const box = await track.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  // Create interval_0001
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.up();

  // Create interval_0002
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.up();

  const i1 = page.getByTestId("interval-interval_0001");
  const i2 = page.getByTestId("interval-interval_0002");

  await expect(i1).toBeVisible();
  await expect(i2).toBeVisible();

  // Pair selection A->B
  await i1.click();
  await i2.click();

  // Create constraint with default operator choice
  const addBtn = page.getByTestId("constraint-add");
  await expect(addBtn).toBeEnabled();
  await addBtn.click();

  // Change operator to a base operator for editable params
  await page.getByTestId("constraint-operator").click();
  await page.getByRole("option", { name: /^Bef\b/ }).click();

  // Edit delta
  await page.getByTestId("param-delta").fill("2");

  const model = page.getByTestId("constraint-model");
  await expect(model).toContainText('"operatorId": "Bef"');
  await expect(model).toContainText('"delta": 2');
  await expect(model).toContainText('"params"');
});
