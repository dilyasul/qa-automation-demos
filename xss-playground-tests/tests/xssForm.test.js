const { test, expect } = require('@playwright/test');

const baseURL = 'http://localhost:5500/xss-playground/'; // Adjust to your local or hosted URL

test.describe('XSS Playground Comprehensive Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test('Basic safe comment submission', async ({ page }) => {
    const safeComment = 'Hello, this is a safe comment!';
    await page.fill('#commentInput', safeComment);
    await page.click('button[type="submit"]');

    const lastComment = await page.locator('.comment-rendered').last();
    await expect(lastComment).toContainText(safeComment);
  });

  test('Mode switching changes selection', async ({ page }) => {
    await page.check('input[value="safe"]');
    expect(await page.isChecked('input[value="safe"]')).toBe(true);

    await page.check('input[value="purify"]');
    expect(await page.isChecked('input[value="purify"]')).toBe(true);

    await page.check('input[value="vulnerable"]');
    expect(await page.isChecked('input[value="vulnerable"]')).toBe(true);
  });

  test('XSS payload blocked in Safe mode', async ({ page }) => {
    await page.check('input[value="safe"]');

    const xssPayload = `<script>window.xssTest=true;</script>`;
    await page.fill('#commentInput', xssPayload);
    await page.click('button[type="submit"]');

    // The script should NOT execute, so window.xssTest is undefined
    const wasTriggered = await page.evaluate(() => window.xssTest === true);
    expect(wasTriggered).toBeFalsy();

    // The displayed comment should have the script escaped or removed
    const lastComment = await page.locator('.comment-rendered').last();
    await expect(lastComment).not.toContainText('<script>');
  });

  test('XSS payload sanitized in Purify mode', async ({ page }) => {
    await page.check('input[value="purify"]');

    const xssPayload = `<img src=x onerror=window.xssTest=true>`;
    await page.fill('#commentInput', xssPayload);
    await page.click('button[type="submit"]');

    // The script should NOT execute
    const wasTriggered = await page.evaluate(() => window.xssTest === true);
    expect(wasTriggered).toBeFalsy();

    const lastComment = await page.locator('.comment-rendered').last();
    await expect(lastComment).not.toContainText('onerror');
  });

  test('XSS payload executes in Vulnerable mode and counter increments', async ({ page }) => {
    await page.check('input[value="vulnerable"]');

    const xssPayload = `<script>window.xssTest=true;</script>`;
    await page.fill('#commentInput', xssPayload);
    await page.click('button[type="submit"]');

    const wasTriggered = await page.evaluate(() => window.xssTest === true);
    expect(wasTriggered).toBe(true);

    const counterText = await page.locator('#triggerCounter').textContent();
    expect(counterText).toContain('XSS Alerts Triggered: 1');
  });

  test('Reset button clears input, comments, and counter', async ({ page }) => {
    await page.fill('#commentInput', 'Some comment');
    await page.click('button[type="submit"]');

    await page.click('#resetBtn');

    const inputValue = await page.inputValue('#commentInput');
    expect(inputValue).toBe('');

    const commentsCount = await page.locator('.comment-rendered').count();
    expect(commentsCount).toBe(0);

    const counterText = await page.locator('#triggerCounter').textContent();
    expect(counterText).toBe('XSS Alerts Triggered: 0');
  });

  test('Copy buttons copy correct payload to clipboard', async ({ page, context }) => {
    // Setup clipboard for the context
    const clipboard = await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Test each copy button
    const copyButtons = await page.$$('.copy-btn');
    for (const btn of copyButtons) {
      const payload = await btn.getAttribute('data-payload');
      await btn.click();

      // Read clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      const decodedPayload = decodeHTMLEntities(payload);
      expect(clipboardText).toBe(decodedPayload);
    }
  });

  test('Payload buttons insert correct example payloads', async ({ page }) => {
    const payloadButtons = await page.$$('.payload-btn');
    for (const btn of payloadButtons) {
      const payload = await btn.getAttribute('data-payload');
      await btn.click();

      const commentInput = await page.inputValue('#commentInput');
      const decodedPayload = decodeHTMLEntities(payload);
      expect(commentInput).toBe(decodedPayload);
    }
  });

});

function decodeHTMLEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
