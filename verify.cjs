const { chromium } = require("@playwright/test");
const JSZip = require("jszip");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  fs.mkdirSync("test-results", { recursive: true });
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "OPS/book.opf",
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">folio-test</dc:identifier><dc:title>山间来信</dc:title><dc:creator>Folio 测试文本</dc:creator><dc:language>zh-CN</dc:language><meta property="dcterms:modified">2026-09-09T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>',
  );
  zip.file(
    "OPS/nav.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">第一章 山间来信</a></li><li><a href="c2.xhtml">第二章 夜色</a></li></ol></nav></body></html>',
  );
  for (let i = 1; i <= 2; i++)
    zip.file(
      `OPS/c${i}.xhtml`,
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第${i}章</title><style>body{line-height:1.9;padding:25px}h1{font-size:1.5em;font-weight:normal}p{text-indent:2em}</style></head><body><h1>第${i}章 ${i === 1 ? "山间来信" : "夜色"}</h1>${Array.from({ length: 50 }, (_, n) => `<p>${n + 1} 清晨的风从山谷吹来，远处的树影轻轻摇晃。我翻开一本书，任凭文字带着自己走向另一个世界。时间安静下来，窗外的鸟鸣和纸页里的故事渐渐融为一体。</p>`).join("")}</body></html>`,
    );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync("test-results/sample.epub", buffer);
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (true) console.log("CONSOLE", m.text());
  });
  try {
    await page.goto("http://127.0.0.1:4173");
    await page.screenshot({ path: "test-results/library.png" });
    await page.locator("#epub-input").setInputFiles("test-results/sample.epub");
    await page.locator(".book-card").waitFor();
    await page.locator(".book-card").click();
    await page.waitForFunction(
      () => !busy && rendition?.currentLocation()?.start,
    );
    console.log("OPEN", await page.locator("#position").textContent());
    await page.screenshot({ path: "test-results/reader.png" });
    const initial = await page.evaluate(
      () => rendition.currentLocation().start.cfi,
    );
    await page.locator("#next").click();
    await page.waitForFunction(() => !busy);
    const next = await page.evaluate(
      () => rendition.currentLocation().start.cfi,
    );
    assert.notEqual(initial, next);
    console.log("NEXT OK");
    await page.locator("#prev").click();
    await page.waitForFunction(() => !busy);
    assert.equal(
      await page.evaluate(() => rendition.currentLocation().start.cfi),
      initial,
    );
    console.log("PREV OK");
    await page.waitForFunction(() => preparedTurn, { timeout: 15000 });
    const rect = await page.locator("#paper").boundingBox();
    await page.mouse.move(rect.x + rect.width - 5, rect.y + rect.height - 20);
    await page.mouse.down();
    await page.waitForSelector("#animation canvas");
    await page.mouse.move(
      rect.x + rect.width * 0.65,
      rect.y + rect.height * 0.8,
      { steps: 20 },
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: "test-results/curl.png" });
    await page.mouse.up();
    await page.waitForFunction(() => !busy);
    assert.equal(
      await page.evaluate(() => rendition.currentLocation().start.cfi),
      initial,
    );
    console.log("DRAG CANCEL OK");
    await page.waitForFunction(() => preparedTurn, { timeout: 15000 });
    await page.mouse.move(rect.x + rect.width - 5, rect.y + rect.height - 20);
    await page.mouse.down();
    await page.waitForSelector("#animation canvas");
    await page.mouse.move(
      rect.x + rect.width * 0.2,
      rect.y + rect.height * 0.9,
      { steps: 25 },
    );
    await page.mouse.up();
    await page.waitForFunction(() => !busy);
    assert.notEqual(
      await page.evaluate(() => rendition.currentLocation().start.cfi),
      initial,
    );
    console.log("DRAG COMMIT OK");
    await page.locator("#theme").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.locator("#settings-toggle").click();
    await page
      .locator("#font-input")
      .setInputFiles("C:/Windows/Fonts/simhei.ttf");
    await page.waitForFunction(() => prefs.font.startsWith("font-") && !busy);
    assert.match(
      await page.evaluate(
        () =>
          rendition.getContents()[0].document.getElementById("folio-style")
            .textContent,
      ),
      /@font-face/,
    );
    await page.locator("#settings-toggle").click();
    await page.locator("#next").click();
    await page.waitForFunction(() => !busy);
    await page.evaluate(() => saveProgress());
    const saved = await page.evaluate(
      () => rendition.currentLocation().start.cfi,
    );
    await page.screenshot({ path: "test-results/dark-reader.png" });
    await page.reload();
    await page.locator(".book-card").click();
    await page.waitForFunction(
      () => !busy && rendition?.currentLocation()?.start,
    );
    assert.equal(
      await page.evaluate(() => rendition.currentLocation().start.cfi),
      saved,
    );
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    console.log("FONT + PERSISTENCE OK");
    await page.locator("#toc-toggle").click();
    await page.locator("#toc-items button").nth(1).click();
    await page.waitForFunction(() => !busy);
    assert.match(await page.locator("#chapter").textContent(), /夜色/);
    console.log("TOC OK");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    await page.locator("#next").click();
    await page.waitForFunction(() => !busy);
    await page.screenshot({ path: "test-results/mobile.png" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    console.log("MOBILE OK");
    const mobileBefore = await page.evaluate(
      () => rendition.currentLocation().start.cfi,
    );
    await page.waitForFunction(() => preparedTurn, { timeout: 15000 });
    const mr = await page.locator("#paper").boundingBox();
    await page.mouse.move(mr.x + mr.width - 5, mr.y + mr.height - 15);
    await page.mouse.down();
    await page.waitForSelector("#animation canvas");
    await page.mouse.move(mr.x + mr.width * 0.15, mr.y + mr.height * 0.9, {
      steps: 20,
    });
    await page.mouse.up();
    await page.waitForFunction(() => !busy);
    assert.notEqual(
      await page.evaluate(() => rendition.currentLocation().start.cfi),
      mobileBefore,
    );
    console.log("MOBILE DRAG OK");
    assert.deepEqual(errors, []);
    console.log("ALL CHECKS PASSED");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
