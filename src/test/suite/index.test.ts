import * as assert from "assert";
import { before, beforeEach } from "mocha";
import { State } from "vscode-languageclient";

import * as auto from "./automation";
import * as extension from "../../extension";

const UNFORMATTED = "class Foo; def bar; puts 'baz'; end; end";

const FORMATTED = `class Foo
  def bar
    puts "baz"
  end
end
`;

suite("Syntax Tree", () => {
  beforeEach(auto.reset);

  suite("lifecycle commands", () => {
    test("start", async () => {
      await auto.start();
      assert.notEqual(extension.languageClient, null);
      assert.equal(extension.languageClient?.state, State.Running);
    });

    test("stop", async () => {
      await auto.start();
      await auto.stop();
      assert.equal(extension.languageClient, null);
    });

    test("restart", async () => {
      await auto.restart();
      assert.notEqual(extension.languageClient, null);
      assert.equal(extension.languageClient?.state, State.Running);
    });
  });

  suite("functional commands", () => {
    before(auto.start);

    test("format", async () => {
      const editor = await auto.createEditor(UNFORMATTED);
      await auto.formatDocument();
      assert.equal(editor.document.getText(), FORMATTED);
    });

    test("visualize", async () => {
      await auto.createEditor(UNFORMATTED);
      await auto.visualize();
      const editor = auto.findNewestEditor();
      assert.match(editor.document.getText(), /^\(program/);
    });
  });
});
