import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, type Rollup } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page, type Route } from "playwright";

let browser: Browser;
let script = "";

beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    plugins: [react(), {
      name: "test-next-link",
      resolveId(id) { return id === "next/link" ? "\0test-next-link" : undefined; },
      load(id) { return id === "\0test-next-link" ? "import React from 'react'; export default function Link({href, children, ...props}) { return React.createElement('a', {...props, href}, children); }" : undefined; },
    }],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: path.resolve(process.cwd(), "src/components/DeckList.browser-test-harness.tsx"),
        output: { format: "iife" },
      },
    },
  });
  const output = (result as Rollup.RollupOutput).output.find((entry): entry is Rollup.OutputChunk => entry.type === "chunk");
  if (!output) throw new Error("DeckList browser harness did not produce a script.");
  script = output.code;
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => { await browser?.close(); }, 30_000);

const profile = {
  profile: { id: "p1", name: "Percy", iconCard: null },
  cards: [],
  decks: [{ id: "d1", name: "Boros", commander: null, cardCount: 12 }],
};

async function mountDeckList(onPost?: (route: Route) => void) {
  const page = await browser.newPage();
  let deletes = 0;
  await page.route("http://deck-list.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === "document") {
      await route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    } else if (url.pathname === "/api/catalog") {
      await route.fulfill({ json: [] });
    } else if (url.pathname === "/api/profiles") {
      await route.fulfill({ json: { profiles: [] } });
    } else if (url.pathname === "/api/profiles/p1/decks" && route.request().method() === "POST") {
      if (onPost) onPost(route); else await route.fulfill({ json: { id: "d2" } });
    } else if (url.pathname === "/api/profiles/p1/decks/d1" && route.request().method() === "DELETE") {
      deletes += 1;
      await route.fulfill({ json: { ok: true } });
    } else if (url.pathname === "/api/profiles/p1") {
      await route.fulfill({ json: profile });
    } else {
      await route.abort();
    }
  });
  await page.goto("http://deck-list.test/");
  await page.evaluate(() => localStorage.setItem("fra-ui-style", "alt"));
  await page.addScriptTag({ content: script });
  await page.getByRole("button", { name: "New deck" }).waitFor();
  return { page, deleteCount: () => deletes };
}

describe("Alt decks mounted dialog interactions", () => {
  it("keeps Tab inside when pending creation disables the focused submit", async () => {
    let pendingPost: Route | undefined;
    const { page } = await mountDeckList((route) => { pendingPost = route; });
    await page.getByRole("button", { name: "New deck" }).click();
    await page.getByRole("textbox", { name: "Deck name" }).fill("Esper");
    await page.getByRole("button", { name: "Create deck" }).click();
    const submit = page.getByRole("button", { name: /^Creating/ });
    await expect.poll(() => submit.isDisabled()).toBe(true);
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true);
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement)?.name)).toBe("name");
    await pendingPost?.fulfill({ json: { id: "d2" } });
    await page.close();
  }, 30_000);

  it("closes after successful creation and restores focus to the opener", async () => {
    const { page } = await mountDeckList();
    const opener = page.getByRole("button", { name: "New deck" });
    await opener.click();
    await page.getByRole("textbox", { name: "Deck name" }).fill("Esper");
    await page.getByRole("button", { name: "Create deck" }).click();
    await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
    await expect.poll(() => opener.evaluate((node) => node === document.activeElement), { timeout: 3_000 }).toBe(true);
    await page.close();
  }, 30_000);

  it("confirms deletion, while cancel closes and refocuses its trigger", async () => {
    const { page, deleteCount } = await mountDeckList();
    const trigger = page.getByRole("button", { name: "Delete Boros" });
    await trigger.click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
    await expect.poll(() => trigger.evaluate((node) => node === document.activeElement)).toBe(true);
    await trigger.click();
    await page.getByRole("button", { name: "Delete deck" }).click();
    await expect.poll(deleteCount).toBe(1);
    await page.close();
  }, 30_000);
});
