"use strict";

import { ConfigurationChangeEvent, ExtensionContext, commands, window, workspace } from "vscode";
import { LanguageClient, ServerOptions } from "vscode-languageclient/node";
import { promisify } from "util";
import { exec } from "child_process";

import InlayHints from "./InlayHints";
import Visualize from "./Visualize";

const promiseExec = promisify(exec);

export function activate(context: ExtensionContext) {
  const outputChannel = window.createOutputChannel("Syntax Tree");
  let languageClient: LanguageClient | null = null;
  let visualizer: Visualize | null = null;

  context.subscriptions.push(
    outputChannel,
    commands.registerCommand("syntaxTree.start", startLanguageServer),
    commands.registerCommand("syntaxTree.stop", stopLanguageServer),
    commands.registerCommand("syntaxTree.restart", restartLanguageServer),
    commands.registerCommand("syntaxTree.visualize", () => visualizer?.visualize()),
    commands.registerCommand("syntaxTree.showOutputChannel", () => outputChannel.show()),
    workspace.onDidChangeConfiguration(event =>
      event.affectsConfiguration("syntaxTree") &&
      restartLanguageServer())
  );

  return startLanguageServer();

  async function startLanguageServer() {
    const config = workspace.getConfiguration("syntaxTree");
    const addlPlugins = config.get<string[]>("additionalPlugins") || [];
    const singleQuotes = config.get<boolean>("singleQuotes");
    const trailingComma = config.get<boolean>("trailingComma");

    const args = ["lsp"];

    const plugins = new Set<string>();
    if (singleQuotes) {
      plugins.add("plugin/single_quotes");
    }
    if (trailingComma) {
      plugins.add("plugin/trailing_comma");
    }
    addlPlugins.forEach(plugins.add);

    if (plugins.size) {
      args.push(`--plugins=${Array.from(plugins).join(",")}`);
    }

    outputChannel.appendLine(`Starting language server with ${plugins.size} plugin(s)...`);
    let run: ServerOptions = { command: "stree", args };

    if (workspace.workspaceFolders) {
      const cwd = workspace.workspaceFolders![0].uri.fsPath;

      try {
        await promiseExec("bundle show syntax_tree", { cwd });
        run = { command: "bundle", args: ["exec", "stree", "lsp"], options: { cwd } };
      } catch {
        outputChannel.appendLine("No bundled syntax_tree, running global stree.");
      }
    }

    languageClient = new LanguageClient("Syntax Tree", { run, debug: run }, {
      documentSelector: [
        { scheme: "file", language: "ruby" },
      ],
      outputChannel
    });

    context.subscriptions.push(languageClient.start());
    await languageClient.onReady();

    visualizer = new Visualize(languageClient, outputChannel);
    context.subscriptions.push(
      new InlayHints(languageClient, outputChannel),
      visualizer
    );
  }

  async function stopLanguageServer() {
    if (languageClient) {
      outputChannel.appendLine("Stopping language server...");
      await languageClient.stop();
    }
  }

  async function restartLanguageServer() {
    outputChannel.appendLine("Restarting language server...");
    await stopLanguageServer();
    await startLanguageServer();
  }
}
