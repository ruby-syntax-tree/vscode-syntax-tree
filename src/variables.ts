import * as os from "os";
import * as path from "path";

const substitution = new RegExp("\\$\\{([^}]*)\\}");

export function substitute(s: string) {
  let match = substitution.exec(s);
  while (match) {
    const variable = match[1];
    switch (variable) {
      case "cwd":
        s = s.replace(match[0], process.cwd());
        break;
      case "pathSeparator":
        s = s.replace(match[0], path.sep);
        break;
      case "userHome":
        s = s.replace(match[0], os.homedir());
        break;
    }
    match = substitution.exec(s);
  }

  return s;
}
