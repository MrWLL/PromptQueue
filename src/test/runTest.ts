import * as fs from 'node:fs';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const localLibPath = path.resolve(
    __dirname,
    '../../.vscode-test/linux-libs/root/usr/lib/x86_64-linux-gnu',
  );

  if (process.platform === 'linux' && fs.existsSync(localLibPath)) {
    process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${localLibPath}:${process.env.LD_LIBRARY_PATH}`
      : localLibPath;
  }

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
  });
}

main().catch((error) => {
  console.error('Failed to run extension tests');
  console.error(error);
  process.exit(1);
});
