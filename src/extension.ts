"use strict";

import { ExtensionContext, commands, window, workspace } from "vscode";
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
    commands.registerCommand("syntaxTree.start", startLanguageServer),
    commands.registerCommand("syntaxTree.stop", stopLanguageServer),
    commands.registerCommand("syntaxTree.restart", restartLanguageServer),
    commands.registerCommand("syntaxTree.visualize", () => visualizer?.visualize()),
    commands.registerCommand("syntaxTree.showOutputChannel", () => outputChannel.show()),
    outputChannel
  );

  return startLanguageServer();

  async function startLanguageServer() {
    outputChannel.appendLine("Starting language server...");
    let run: ServerOptions = { command: "stree", args: ["lsp"] };

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
