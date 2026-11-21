import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [applicationArg, mode = 'allowed'] = process.argv.slice(2);
assert.ok(applicationArg && ['allowed', 'denied'].includes(mode), 'pass the application path and allowed or denied');
const application = resolve(applicationArg);
assert.ok((await stat(application)).isFile(), 'application must be an executable file');
const driverPath = resolve(process.env.EDGE_WEBDRIVER ?? '.tools/edge-webdriver/msedgedriver.exe');
assert.ok((await stat(driverPath)).isFile(), 'run tests/desktop/setup-driver.ps1 first');

async function freeLoopbackPort() {
  const socket = createServer();
  await new Promise((ready, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', ready);
  });
  const { port } = socket.address();
  await new Promise((closed, reject) => socket.close((error) => error ? reject(error) : closed()));
  return port;
}

async function eventually(assertion, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(200);
    }
  }
}

function startProcess(name, executable, args, env) {
  const child = spawn(executable, args, {
    cwd: dirname(executable),
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  const stopped = new Promise((done) => {
    child.once('error', done);
    child.once('exit', (code, signal) => done(new Error(`${name} exited (${code ?? signal})`)));
  });
  return { child, stopped };
}

const systemRoot = process.env.SystemRoot;
assert.ok(systemRoot, 'Windows SystemRoot must be set');
const systemEnv = { ...process.env };
const pathKey = Object.keys(systemEnv).find((key) => key.toLowerCase() === 'path') ?? 'Path';
systemEnv[pathKey] = [join(systemRoot, 'System32'), systemRoot].join(delimiter);

const port = await freeLoopbackPort();
const profile = await mkdtemp(join(tmpdir(), 'vulnpulse-webview-'));
const driver = startProcess('Edge WebDriver', driverPath, [`--port=${port}`], systemEnv);

async function command(method, path, body, timeout = 30_000) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const { value } = await response.json();
    if (!response.ok) throw new Error(value?.message ?? response.statusText);
    return value;
  } catch (error) {
    throw new Error(`Edge WebDriver ${method} ${path}: ${error.message}`, { cause: error });
  }
}

let app;
let session;
try {
  await Promise.race([
    eventually(async () => assert.equal((await command('GET', '/status', undefined, 2_000)).ready, true)),
    driver.stopped.then((error) => { throw error; }),
  ]);

  const debugPort = await freeLoopbackPort();
  const debugAddress = `127.0.0.1:${debugPort}`;
  app = startProcess('VulnPulse', application, [], {
    ...systemEnv,
    WEBVIEW2_USER_DATA_FOLDER: profile,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort} --remote-debugging-address=127.0.0.1`,
  });
  const runtime = await Promise.race([
    eventually(async () => {
      const response = await fetch(`http://${debugAddress}/json/version`, {
        signal: AbortSignal.timeout(2_000),
      });
      const version = await response.json();
      assert.ok(version.Browser && version.webSocketDebuggerUrl, 'WebView2 debugger is not ready');
      return version.Browser;
    }, 45_000).catch((error) => {
      throw new Error(`WebView2 at ${debugAddress} did not start: ${error.message}`, { cause: error });
    }),
    app.stopped.then((error) => { throw error; }),
  ]);
  console.log(`VulnPulse started with ${runtime}; attaching Edge WebDriver`);

  const { sessionId } = await command('POST', '/session', {
    capabilities: { alwaysMatch: {
      browserName: 'webview2',
      'ms:edgeChromium': true,
      'ms:edgeOptions': { debuggerAddress: debugAddress },
    } },
  }, 60_000);
  session = `/session/${sessionId}`;
  const execute = (script) => command('POST', `${session}/execute/sync`, { script, args: [] });
  const cdp = (cmd, params = {}) => command('POST', `${session}/ms/cdp/execute`, { cmd, params });
  const ipc = (name, request) => command('POST', `${session}/execute/async`, {
    script: `const [name, request, done] = arguments;
      window.__TAURI_INTERNALS__.invoke(name, { request })
        .then((value) => done({ value }), (error) => done({ error }));`,
    args: [name, request],
  });
  async function element(selector) {
    const result = await command('POST', `${session}/element`, { using: 'css selector', value: selector });
    return `${session}/element/${result['element-6066-11e4-a52e-4f735466cecf']}`;
  }
  // The runner can attach with the host window in the background. Activate UI
  // controls in the WebView and emulate focus for keyboard input.
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  async function click(selector) {
    assert.equal(await execute(`const control = document.querySelector(${JSON.stringify(selector)});
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return false;
      control.scrollIntoView({ block: 'nearest' });
      control.focus();
      control.click();
      return true;`), true, selector);
  }
  async function keys(selector, value) {
    await execute(`document.querySelector(${JSON.stringify(selector)})?.focus();`);
    return command('POST', `${await element(selector)}/value`, { text: value });
  }
  const textOf = (selector) => execute(`return document.querySelector(${JSON.stringify(selector)})?.textContent ?? ""`);
  const entryIds = () => execute('return [...document.querySelectorAll("tbody .entry-link")].map(({ textContent }) => textContent.trim())');
  const search = 'input[type=search]';
  const reset = '.filter-row button';
  const query = { search: '', severity: null, source: null, kev: null, sortBy: 'updated', direction: 'desc', page: 1, pageSize: 10 };
  const heading = 'h1';
  const detail = 'dialog[open]';

  await eventually(async () => assert.equal(await textOf(heading), 'Начало работы'));
  await click('.welcome-panel button');
  await eventually(async () => assert.equal(await textOf(heading), 'Каталог уязвимостей'));

  if (mode === 'allowed') {
    await eventually(async () => {
      assert.equal((await entryIds()).length, 10);
      assert.equal((await entryIds())[0], 'DEMO-003');
      assert.equal(await textOf('.summary-value'), '24');
    });
    assert.deepEqual(await ipc('list_demo_catalog', { limit: 0 }), { error: { code: 'invalid_request' } });
    const { value } = await ipc('list_demo_catalog', { limit: 1 });
    assert.deepEqual(value.entries.map(({ id }) => id), ['DEMO-001']);

    for (const patch of [{ pageSize: 0 }, { page: 0 }, { search: 'щ'.repeat(121) }]) {
      assert.deepEqual(await ipc('query_catalog', { ...query, ...patch }), { error: { code: 'invalid_request' } });
    }
    assert.deepEqual(await ipc('get_catalog_detail', { id: 'DEMO-999' }), { error: { code: 'not_found' } });

    await click('[aria-label="Следующая страница"]');
    await eventually(async () => {
      assert.equal(await textOf('.page-indicator'), '2 / 3');
      assert.equal((await entryIds())[0], 'DEMO-013');
    });
    await click('th:first-child button');
    await eventually(async () => {
      assert.equal(await textOf('.page-indicator'), '1 / 3');
      assert.equal((await entryIds())[0], 'DEMO-001');
    });

    await keys(search, 'ШЛЮЗ');
    await eventually(async () => assert.deepEqual(await entryIds(), ['DEMO-003', 'DEMO-004']));
    const first = 'button[aria-label="Открыть DEMO-003"]';
    await keys(first, '\uE007');
    await eventually(async () => {
      assert.match(await textOf(`${detail} h2`), /Шлюз централизованного доступа/);
      assert.match(await textOf(`${detail} .source-list`), /CISA KEV/);
      assert.match(await textOf(`${detail} .source-list`), /DEMO-OSV-003/);
      assert.match(await textOf(`${detail} .source-list`), /DEMO-NVD-003.*CVSS 9,8/);
    });
    await keys(`${detail} .dialog-close`, '\uE00C');
    await eventually(async () => {
      assert.equal(await execute('return Boolean(document.querySelector("dialog[open]"))'), false);
      assert.equal(await execute('return document.activeElement?.getAttribute("aria-label")'), 'Открыть DEMO-003');
      assert.equal(await execute('return document.querySelector("input[type=search]").value'), 'ШЛЮЗ');
    });
    const findShortcut = { key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 2 };
    await cdp('Input.dispatchKeyEvent', { ...findShortcut, type: 'rawKeyDown' });
    await cdp('Input.dispatchKeyEvent', { ...findShortcut, type: 'keyUp' });
    await eventually(async () => {
      assert.equal(await execute('return document.activeElement?.matches("input[type=search]")'), true);
    });

    await click('[aria-label="Начало работы"]');
    await click('[aria-label="Каталог"]');
    await eventually(async () => assert.deepEqual(await entryIds(), ['DEMO-003', 'DEMO-004']));
    await keys(search, 'ZZ');
    await eventually(async () => assert.equal(await textOf('.empty-state strong'), 'Ничего не найдено'));
    await click('.empty-state button');
    await eventually(async () => assert.equal((await entryIds()).length, 10));
    await click('.summary-tile:nth-child(4)');
    await eventually(async () => assert.deepEqual(await entryIds(), ['DEMO-003', 'DEMO-005', 'DEMO-017']));
    await click(reset);
    await eventually(async () => assert.equal((await entryIds()).length, 10));
    await click('th:last-child button');
    await eventually(async () => assert.equal((await entryIds())[0], 'DEMO-003'));
    await click('.workspace-heading button');
    await eventually(async () => assert.equal(await textOf('.toast'), 'Каталог перечитан из локальной базы.'));
    await eventually(async () => assert.equal(await textOf('.toast'), ''));

    await click('.about-button');
    const closeAbout = `${detail} .dialog-close`;
    const licenses = `${detail} summary`;
    await keys(closeAbout, '\uE004');
    await eventually(async () => assert.equal(await execute('return document.activeElement?.tagName'), 'SUMMARY'));
    await keys(licenses, '\uE008\uE004\uE000');
    await eventually(async () => assert.equal(await execute('return document.activeElement?.getAttribute("aria-label")'), 'Закрыть'));
    await keys(closeAbout, '\uE00C');
    await eventually(async () => assert.equal(await execute('return document.activeElement?.getAttribute("aria-label")'), 'О дизайне'));
    await execute('document.querySelector("h1").focus(); window.scrollTo(0, 0);');

    const output = process.env.VULNPULSE_SCREENSHOTS;
    if (output) await mkdir(output, { recursive: true });
    async function capture(name) {
      if (!output) return;
      const png = await command('GET', `${session}/screenshot`);
      await writeFile(join(output, `${name}.png`), Buffer.from(png, 'base64'));
    }
    for (const [name, width, height, scale] of [
      ['catalog-1280-100', 1280, 800, 1],
      ['catalog-1280-125', 1280, 800, 1.25],
      ['catalog-1280-150', 1280, 800, 1.5],
      ['catalog-1024-100', 1024, 768, 1],
    ]) {
      const cssWidth = Math.floor(width / scale);
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: cssWidth, height: Math.floor(height / scale), deviceScaleFactor: scale, mobile: false,
      });
      await eventually(async () => {
        assert.equal(await execute('return window.innerWidth'), cssWidth);
        assert.equal(await execute('return document.documentElement.scrollWidth <= window.innerWidth'), true);
        assert.equal(await execute(`const button = document.querySelector('[aria-label="Следующая страница"]');
          const rect = button.getBoundingClientRect();
          return rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;`), true);
      });
      await capture(name);
      if (name === 'catalog-1280-150') {
        const original = await textOf('.summary-value');
        await execute('document.querySelector(".summary-value").textContent = "100\u00a0000";');
        try {
          assert.equal(await execute(`const number = document.querySelector(".summary-value");
            const icon = document.querySelector(".summary-icon");
            return number.getBoundingClientRect().right <= icon.getBoundingClientRect().left;`), true);
          await capture('catalog-1280-150-large-count');
        } finally {
          await execute(`document.querySelector(".summary-value").textContent = ${JSON.stringify(original)};`);
        }
      }
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 600, height: 533, deviceScaleFactor: 1, mobile: false });
    await click(first);
    await eventually(async () => {
      assert.match(await textOf(`${detail} h2`), /Шлюз централизованного доступа/);
      assert.equal(await execute('return document.querySelector("dialog").offsetWidth'), 600);
    });
    await capture('catalog-drawer-600');
    await cdp('Emulation.clearDeviceMetricsOverride');
  } else {
    await eventually(async () => {
      assert.match(await execute('return document.querySelector("[role=alert]")?.textContent ?? ""'), /Повторите попытку/);
    });
    for (const [name, request] of [
      ['list_demo_catalog', { limit: 1 }],
      ['query_catalog', query],
      ['get_catalog_detail', { id: 'DEMO-003' }],
    ]) {
      const { error } = await ipc(name, request);
      assert.match(error, /not allowed|not permitted|denied/i);
      assert.ok(error.includes(name));
    }
  }

  const external = await execute(`
    return performance.getEntriesByType('resource').map(({ name }) => name)
      .filter((name) => /^https?:/.test(name) && ![location.origin, 'http://ipc.localhost'].includes(new URL(name).origin));
  `);
  assert.deepEqual(external, []);
  console.log(`Desktop smoke passed (${mode})`);
} finally {
  try {
    if (session) await command('DELETE', session);
  } finally {
    driver.child.kill();
    app?.child.kill();
    await Promise.all([driver.stopped, app?.stopped]);
    assert.ok(profile.startsWith(join(resolve(tmpdir()), 'vulnpulse-webview-')));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
