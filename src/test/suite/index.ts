import * as path from "path";
import * as Mocha from "mocha";
import { glob } from "glob";

import { TIMEOUT_MS } from "./setup";

export async function run(): Promise<void> {
  const mocha = new Mocha({
    asyncOnly: true,
    color: true,
    forbidOnly: !!process.env.CI,
    slow: TIMEOUT_MS / 4,
    timeout: TIMEOUT_MS,
    ui: "tdd"
  });

  const testsRoot = path.resolve(__dirname, "..");

  try {
    // Find all test files
    const files = await glob("**/**.test.js", { cwd: testsRoot });

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    // Run the mocha test and wrap in a promise since mocha.run uses callbacks
    await new Promise<void>((resolve, reject) => {
      mocha.run(failures => {
        if (failures > 0) {
          const error = new Error(`${failures} tests failed${process.env.CI ? '; pausing for dramatic effect.' : '.'}`);

          // Let the cameras roll for a bit & make sure we capture the error
          if (process.env.CI) {
            setTimeout(() => reject(error), 3000);
          } else {
            reject(error);
          }
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
