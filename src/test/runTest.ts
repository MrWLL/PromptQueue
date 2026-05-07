import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
  runTests,
  type DownloadOptions,
  type TestOptions,
} from '@vscode/test-electron';

type TestRunOptionsInput = {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  platform?: DownloadOptions['platform'];
  vscodeExecutablePath?: string;
};

export function shouldRunTestMain(
  npmLifecycleEvent = process.env.npm_lifecycle_event,
): boolean {
  return npmLifecycleEvent !== 'test:unit';
}

export function getTestRunOptions(
  input: TestRunOptionsInput,
): TestOptions & { vscodeExecutablePath?: string } {
  const options: TestOptions & { vscodeExecutablePath?: string } = {
    extensionDevelopmentPath: input.extensionDevelopmentPath,
    extensionTestsPath: input.extensionTestsPath,
  };

  if (input.vscodeExecutablePath) {
    options.vscodeExecutablePath =
      input.platform && input.platform.startsWith('win32')
        ? resolveCliPathFromVSCodeExecutablePath(
            input.vscodeExecutablePath,
            input.platform,
          )
        : input.vscodeExecutablePath;
  }

  return options;
}

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const localLibPath = path.resolve(
    __dirname,
    '../../.vscode-test/linux-libs/root/usr/lib/x86_64-linux-gnu',
  );
  const platform: DownloadOptions['platform'] =
    process.platform === 'win32'
      ? process.arch === 'arm64'
        ? 'win32-arm64-archive'
        : 'win32-x64-archive'
      : undefined as never;

  if (process.platform === 'linux' && fs.existsSync(localLibPath)) {
    process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${localLibPath}:${process.env.LD_LIBRARY_PATH}`
      : localLibPath;
  }

  const downloadedExecutablePath = await downloadAndUnzipVSCode({
    platform,
    version: 'stable',
  });

  await runTests(
    getTestRunOptions({
      extensionDevelopmentPath,
      extensionTestsPath,
      platform,
      vscodeExecutablePath: downloadedExecutablePath,
    }),
  );
}

if (shouldRunTestMain()) {
  main().catch((error) => {
    console.error('Failed to run extension tests');
    console.error(error);
    process.exit(1);
  });
}
