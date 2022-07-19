import * as assert from 'assert';
import * as path from 'path';
import { TextEncoder } from 'util';

import { Uri, commands, window, workspace } from 'vscode';

import { WORKSPACE_DIR } from './setup';

export async function reset() {
  await commands.executeCommand('workbench.action.closeAllEditors');
}

export async function createEditor(content: string) {
  const filename = `${Math.random().toString().slice(2)}.rb`;
  const uri = Uri.file(`${WORKSPACE_DIR}${path.sep}${filename}`);
  await workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  await window.showTextDocument(uri);
  assert.ok(window.activeTextEditor);
  assert.equal(window.activeTextEditor.document.getText(), content);
  return window.activeTextEditor;
}

export function findNewestEditor() {
  return window.visibleTextEditors[window.visibleTextEditors.length - 1];
}

export function formatDocument() {
  return commands.executeCommand('editor.action.formatDocument', 'ruby-syntax-tree.vscode-syntax-tree');
}

export function restart() {
  return commands.executeCommand('syntaxTree.restart');
}

export function start() {
  return commands.executeCommand('syntaxTree.start');
}

export function stop() {
  return commands.executeCommand('syntaxTree.stop');
}

export function visualize() {
  return commands.executeCommand('syntaxTree.visualize');
}
