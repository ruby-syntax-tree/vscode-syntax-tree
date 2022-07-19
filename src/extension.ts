"use strict";

import { ExtensionContext, commands, window, workspace } from "vscode";
import { LanguageClient, ServerOptions } from "vscode-languageclient/node";
import { promisify } from "util";
import { exec } from "child_process";

import Visualize from "./Visualize";

const promiseExec = promisify(exec);

// This object will get initialized once the language client is ready. It will
// get set back to null when the extension is deactivated.
let languageClient: LanguageClient | null = null;

// This is the expected top-level export that is called by VSCode when the
// extension is activated.
export async function activate(context: ExtensionContext) {
  // This output channel is going to contain all of our informational messages.
  // It's not really meant for the end-user, it's more for debugging.
  const outputChannel = window.createOutputChannel("Syntax Tree");

  // This object will get initialized once the language client is ready.
  let visualizer: Visualize | null = null;

  // This is the list of objects that implement the Disposable interface. They
  // will all get cleaned up with this extension is deactivated. It's important
  // to add them to this list so we don't leak memory.
  context.subscriptions.push(
    // The output channel itself is a disposable. When the extension is
    // deactivated it will be removed from the list.
    outputChannel,

    // Each of the commands that interacts with this extension is a disposable.
    // It's important to register them here as opposed to whenever the client
    // starts up because we don't want to register them again whenever the
    // client restarts.
    commands.registerCommand("syntaxTree.start", startLanguageServer),
    commands.registerCommand("syntaxTree.stop", stopLanguageServer),
    commands.registerCommand("syntaxTree.restart", restartLanguageServer),
    commands.registerCommand("syntaxTree.visualize", () => visualizer?.visualize()),
    commands.registerCommand("syntaxTree.showOutputChannel", () => outputChannel.show()),
    workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration("syntaxTree")) {
        restartLanguageServer();
      }
    })
  );

  // If there's an open folder, use it as cwd when spawning commands
  // to promote correct package & language versioning.
  const getCWD = () => workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();

  // This function is called when the extension is activated or when the
  // language server is restarted.
  async function startLanguageServer() {
    // The top-level configuration group is syntaxTree. All of the configuration
    // for the extension is under that group.
    const config = workspace.getConfiguration("syntaxTree");

    // The args are going to be passed to the stree executable. It's important
    // that it lines up with what the CLI expects.
    const args = ["lsp"];
    const plugins = new Set<string>();

    if (config.get<boolean>("singleQuotes")) {
      plugins.add("plugin/single_quotes");
    }

    if (config.get<boolean>("trailingComma")) {
      plugins.add("plugin/trailing_comma");
    }

    const additionalPlugins = config.get<string[]>("additionalPlugins");
    if (additionalPlugins) {
      additionalPlugins.forEach(plugin => plugins.add(plugin));
    }

    // If there are any plugins, then we'll pass the --plugins command line
    // option to the stree lsp command.
    if (plugins.size > 0) {
      args.push(`--plugins=${Array.from(plugins).join(",")}`);
    }

    // There's a bit of complexity here. Basically, if there's an open folder,
    // then we're going to check if the syntax_tree gem is inside the bundle. If
    // it is, then we'll run bundle exec stree. This is good, because it'll
    // ensure that we get the correct version of the gem. If it's not in the
    // bundle or there is no bundle, then we'll just run the global stree. This
    // might be correct in the end if the right environment variables are set,
    // but it's a bit of a prayer.
    const cwd = getCWD();
    let run: ServerOptions = { command: "stree", args };
    let where = 'global';

    try {
      await promiseExec("bundle show syntax_tree", { cwd });
      run = { command: "bundle", args: ["exec", "stree"].concat(args), options: { cwd } };
      where = 'bundled';
    } catch {
      // No-op (just keep using the global stree)
    }

    outputChannel.appendLine(`Starting language server with ${where} stree and ${plugins.size} plugin(s)...`);

    // Here, we instantiate the language client. This is the object that is
    // responsible for the communication and management of the Ruby subprocess.
    languageClient = new LanguageClient("Syntax Tree", { run, debug: run }, {
      documentSelector: [
        { scheme: "file", language: "ruby" },
      ],
      outputChannel
    });

    try {
      // Here we're going to wait for the language server to start.
      await languageClient.start();
      // Finally, now that the language server has been properly started, we can
      // add the various features to the extension. Each of them in turn
      // implements Disposable so that they clean up their own resources.
      visualizer = new Visualize(languageClient, outputChannel);
      context.subscriptions.push(
        visualizer
      );
    } catch (e: any) {
      languageClient = null;
      const items = ['Restart']
      let msg = 'Something went wrong.';
      if (typeof e === 'string') {
        if (/ENOENT/.test(e)) {
          msg = 'Command not found. Is the syntax_tree RubyGem installed?';
          items.unshift('Install Gem');
        }
      }

      const action = await window.showErrorMessage(msg, ...items);
      switch (action) {
        case 'Install Gem':
          installGem();
          break;
        case 'Restart':
          startLanguageServer();
          break;
      }
      if (action === 'Restart') {
      }
    }
  }

  // This function is called as part of the shutdown or restart process. It's
  // always user-initiated either through manually executing an action or
  // changing some configuration.
  async function stopLanguageServer() {
    if (languageClient) {
      outputChannel.appendLine("Stopping language server...");
      await languageClient.stop();
    }
  }

  // This function is called as part of the restart process. Like
  // stopLanguageServer, it's always user-initiated either through manually
  // executing an action or changing some configuration.
  async function restartLanguageServer() {
    outputChannel.appendLine("Restarting language server...");
    await stopLanguageServer();
    await startLanguageServer();
  }

  // This function is called when the user wants to recover from ENOENT
  // on start. It starts the language server afterward.
  async function installGem() {
    const cwd = getCWD();
    try {
      await promiseExec("gem install syntax_tree", { cwd });
      startLanguageServer();
    } catch (e) {
      outputChannel.appendLine("Error installing gem: " + e);
    }
  }

  // We're returning a Promise from this function that will start the Ruby
  // subprocess.
  await startLanguageServer();
}

// This is the expected top-level export that is called by VSCode when the
// extension is deactivated.
export async function deactivate() {
  await languageClient?.stop();
  languageClient = null;
}
