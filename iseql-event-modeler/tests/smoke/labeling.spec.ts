import { test, expect } from "@playwright/test";

test("M7.3 smoke: assign predicate+args to an interval and it persists", async ({ page }) => {
  // Se usi baseURL in playwright config, questo basta.
  await page.goto("/");

  // Track presente
  const track = page.locator('[data-testid="timeline-track"]');
  await expect(track).toBeVisible();

  // Se hai già la creazione via drag (M7.1) in questa schermata, prova a creare un intervallo:
  // drag "interno" alla stessa area.
  const box = await track.boundingBox();
  if (!box) throw new Error("timeline track has no bounding box");

  // Drag: da sinistra a destra sulla track
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + box.height / 2);
  await page.mouse.up();

  // Seleziona il primo intervallo renderizzato
  const interval = page.locator('[data-testid^="interval-"]').first();
  await expect(interval).toBeVisible();
  await interval.click();

  // Seleziona predicato
  await page.locator('[data-testid="predicate-select"]').click();
  await page.getByText("hasPkg(personId, pkgId)").click();

  // Compila args
  await page.locator('[data-testid="predicate-arg-0"]').fill("p1");
  await page.locator('[data-testid="predicate-arg-1"]').fill("pkg1");

  // Verifica label sul blocco
  await expect(interval).toContainText("hasPkg(p1,pkg1)");

  // Deselect (click su track vuota) e re-select: deve restare
  await track.click({ position: { x: 5, y: 5 } });
  await interval.click();
  await expect(interval).toContainText("hasPkg(p1,pkg1)");
});
