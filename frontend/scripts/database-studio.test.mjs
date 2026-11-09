import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

test("Studio config reads only the quotation DSN, keeps secrets out of env/errors and fails closed", async () => {
  const frontend = fileURLToPath(new URL("..", import.meta.url));
  const output = join(frontend, "test-results");
  await mkdir(output, { recursive: true });
  const fixture = await mkdtemp(join(output, "studio-config-"));
  const fileUrl = "postgresql://fixture:test-only-password@127.0.0.1:5432/quotation_test";
  const overrideUrl = "postgresql://override:test-only-password@127.0.0.1:5432/override_test";
  try {
    await mkdir(join(fixture, "frontend"));
    await mkdir(join(fixture, "backend"));
    await copyFile(join(frontend, "prisma.config.ts"), join(fixture, "frontend", "prisma.config.ts"));
    await writeFile(join(fixture, "backend", ".env"), [
      `QUOTATION_DATABASE_URL=${fileUrl}`,
      "DATABASE_URL=postgresql://control-must-not-be-used/control_test",
      "QUOTATION_FIXTURE_READER_TOKEN=test-only-token-must-not-be-exported",
    ].join("\n"));
    const cleanEnv = { ...process.env };
    delete cleanEnv.QUOTATION_DATABASE_URL;
    delete cleanEnv.QUOTATION_FIXTURE_READER_TOKEN;
    const configUrl = pathToFileURL(join(fixture, "frontend", "prisma.config.ts")).href;
    function load(override, expected) {
      return spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
        import assert from 'node:assert/strict';
        const {default: config} = await import(${JSON.stringify(configUrl)});
        assert.equal(config.datasource.url, ${JSON.stringify(expected)});
        assert.equal(process.env.QUOTATION_FIXTURE_READER_TOKEN, undefined);
        assert.equal(process.env.CHECKPOINT_DISABLE, '1');
        console.log('config-ok');
      `], { cwd: fixture, env: { ...cleanEnv, ...override }, encoding: "utf8" });
    }
    for (const [override, expected] of [[{}, fileUrl], [{ QUOTATION_DATABASE_URL: overrideUrl }, overrideUrl]]) {
      const result = load(override, expected);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes("config-ok"));
    }
    for (const url of ["", "mysql://fixture:test-only-password@127.0.0.1/not-postgres"]) {
      const result = load({ QUOTATION_DATABASE_URL: url }, undefined);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /QUOTATION_DATABASE_URL/);
      assert.ok(!result.stderr.includes("test-only-password"));
    }
    await rm(join(fixture, "backend", ".env"));
    const missing = load({ DATABASE_URL: fileUrl }, undefined);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Cannot read backend\/.env/);
  } finally {
    const target = resolve(fixture);
    assert.ok(target.startsWith(resolve(output) + sep));
    await rm(target, { recursive: true, force: true });
  }
});
