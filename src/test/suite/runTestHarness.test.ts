import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getTestRunOptions,
  shouldRunTestMain,
} from '../../test/runTest';

describe('runTest harness', () => {
  it('uses the VS Code CLI path on Windows archives', () => {
    const executablePath = path.resolve(
      'C:/tmp/vscode-win32-x64-archive-1.119.0/Code.exe',
    );

    const options = getTestRunOptions({
      extensionDevelopmentPath: 'C:/repo',
      extensionTestsPath: 'C:/repo/out/test/suite/index',
      platform: 'win32-x64-archive',
      vscodeExecutablePath: executablePath,
    });

    expect(options.vscodeExecutablePath).toBe(
      path.resolve(
        'C:/tmp/vscode-win32-x64-archive-1.119.0/bin/code.cmd',
      ),
    );
  });

  it('does not auto-run the integration launcher during unit-test lifecycle', () => {
    expect(shouldRunTestMain('test:unit')).toBe(false);
    expect(shouldRunTestMain('test:integration')).toBe(true);
  });
});
