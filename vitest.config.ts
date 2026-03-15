import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'src/test/mocks/vscode.ts'),
    },
  },
  test: {
    include: ['src/test/suite/**/*.test.ts'],
    exclude: ['src/test/suite/**/*.integration.test.ts'],
  },
});
