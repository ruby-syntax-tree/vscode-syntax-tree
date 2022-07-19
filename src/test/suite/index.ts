import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

import { TIMEOUT_MS } from './setup';

export function run(): Promise<void> {
  const mocha = new Mocha({
    asyncOnly: true,
    color: true,
    forbidOnly: !!process.env.CI,
    slow: TIMEOUT_MS / 4,
    timeout: TIMEOUT_MS,
    ui: 'tdd'
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            // Let the cameras roll for a bit & make sure we capture the error
            if (process.env.CI) {
              setTimeout(() => e(new Error(`${failures} tests failed; pausing for dramatic effect.`)), 3000);
            } else {
              e(new Error(`${failures} tests failed.`));
            }
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}
