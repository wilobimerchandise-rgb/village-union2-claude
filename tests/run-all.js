#!/usr/bin/env node
/* Runs every *.test.js in this folder against the built site.
   Usage:  node tests/run-all.js            (all tests)
           node tests/run-all.js 14 15      (only files whose name starts with 14 or 15)
   A test passes when it prints no FAIL / FATAL / TESTFAIL / PAGEERR line and no console errors. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].replace(/^\/+/, '')) || 'index.html'), f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port, base = `http://127.0.0.1:${port}/index.html`, work = fs.mkdtempSync(path.join(os.tmpdir(), 'vv-tests-'));
  const want = process.argv.slice(2), files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!want.length || want.some(w => f.startsWith(w)))).sort();
  let failed = 0, passes = 0;
  for (const f of files) {
    process.stdout.write(`\n== ${f}\n`);
    const r = await new Promise(res => {
      const c = spawn(process.execPath, [path.join(__dirname, f)], { cwd: work, env: Object.assign({}, process.env, { BASE_URL: base, NODE_PATH: [path.join(root, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter) }) });
      let o = ''; c.stdout.on('data', d => { o += d; }); c.stderr.on('data', d => { o += d; });
      const t = setTimeout(() => c.kill('SIGKILL'), 10 * 60 * 1000); c.on('close', code => { clearTimeout(t); res({ status: code, stdout: o }); });
    });
    const out = r.stdout || '', lines = out.split('\n');
    const bad = lines.filter(l => /^(FAIL|FATAL|TESTFAIL|PAGEERR)/.test(l) || /^ERRORS \[.+\]/.test(l));
    passes += lines.filter(l => /^PASS/.test(l)).length;
    if (r.status !== 0 && !bad.length) bad.push(`exit code ${r.status}`);
    if (bad.length) { failed++; bad.forEach(l => console.log('  ✗ ' + l.slice(0, 300))); } else console.log(`  ✓ ${lines.filter(l => /^PASS/.test(l)).length} checks`);
  }
  console.log(`\n${files.length - failed}/${files.length} files passed, ${passes} checks passed.`);
  server.close(); process.exit(failed ? 1 : 0);
});
