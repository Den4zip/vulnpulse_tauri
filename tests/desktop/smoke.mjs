import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
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
  const ipc = (limit) => command('POST', `${session}/execute/async`, {
    script: `const [limit, done] = arguments;
      window.__TAURI_INTERNALS__.invoke('list_demo_catalog', { request: { limit } })
        .then((value) => done({ value }), (error) => done({ error }));`,
    args: [limit],
  });

  await eventually(async () => {
    assert.equal(await execute('return document.querySelector("h1")?.textContent'), 'Демонстрационный каталог');
  });
  const pressKey = (value) => command('POST', `${session}/actions`, {
    actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value },
      { type: 'keyUp', value },
    ] }],
  });
  await pressKey('\uE004'); // WebDriver Tab
  assert.equal(await execute('return document.activeElement?.textContent'), 'Загрузить примеры');
  await pressKey('\uE007'); // WebDriver Enter

  if (mode === 'allowed') {
    await eventually(async () => {
      assert.deepEqual(
        await execute('return [...document.querySelectorAll("li strong")].map(({ textContent }) => textContent)'),
        ['DEMO-001', 'DEMO-002'],
      );
    });
    assert.deepEqual(await ipc(0), { error: { code: 'invalid_request' } });
    const { value } = await ipc(1);
    assert.deepEqual(value.entries.map(({ id }) => id), ['DEMO-001']);
  } else {
    await eventually(async () => {
      assert.match(await execute('return document.querySelector("[role=alert]")?.textContent ?? ""'), /Повторите попытку/);
    });
    const { error } = await ipc(1);
    assert.match(error, /not allowed|not permitted|denied/i);
    assert.match(error, /list_demo_catalog/);
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
