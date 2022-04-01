import { DecorationOptions, DecorationRangeBehavior, Disposable, OutputChannel, Range, TextDocument, TextDocumentChangeEvent, TextEditor, TextEditorDecorationType, ThemeColor, window, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

type InlayHint = { position: number, text: string };
type InlayHintSet = { before: InlayHint[], after: InlayHint[] };

class InlayHints implements Disposable {
  // The client used to communicate with the language server. In the case of
  // this class it's used to send a textDocument/inlayHints request.
  private readonly languageClient: LanguageClient;

  // The output channel used for logging for this class. It's given from the
  // main file so that it uses the same as the rest of the extension.
  private readonly outputChannel: OutputChannel;

  private readonly decorationType: TextEditorDecorationType;
  private readonly inlayHintsCache: WeakMap<TextDocument, InlayHintSet>;
  private readonly debouncedHandleTextDocumentChange: Debounced<TextEditor>;

  private readonly disposables: Disposable[];

  constructor(languageClient: LanguageClient, outputChannel: OutputChannel) {
    this.languageClient = languageClient;
    this.outputChannel = outputChannel;
  
    const color = new ThemeColor("syntaxTree.inlayHints");
    this.decorationType = window.createTextEditorDecorationType({
      before: { color, fontStyle: "normal" },
      after: { color, fontStyle: "normal" },
      rangeBehavior: DecorationRangeBehavior.ClosedClosed
    });

    this.inlayHintsCache = new WeakMap();
    this.setInlayHintsForEditors(window.visibleTextEditors);

    // Here we're going to debounce the handleTextDocumentChange callback so
    // that we're not reacting too quickly to user inputs and making it flash
    // alll around the editor.
    this.debouncedHandleTextDocumentChange = debounce(300, (editor: TextEditor) => {
      this.outputChannel.appendLine("Handling text document changes (debounced)");
      this.inlayHintsCache.delete(editor.document);
      this.setInlayHintsForEditor(editor);
    });

    // Track all of the various callbacks and objects that implement Disposable
    // so that when we need to dispose of the entire InlayHints instance we can
    // iterate through and dispose all of them.
    this.disposables = [
      this.decorationType,
      window.onDidChangeVisibleTextEditors(this.setInlayHintsForEditors, this),
      workspace.onDidChangeTextDocument(this.handleTextDocumentChange, this),
      this.debouncedHandleTextDocumentChange
    ];
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  handleTextDocumentChange(event: TextDocumentChangeEvent) {
    const editor = window.activeTextEditor;

    if (editor !== undefined && event.document === editor.document) {
      this.debouncedHandleTextDocumentChange(editor);
    } else {
      this.inlayHintsCache.delete(event.document);
    }
  }

  // Asynchronously get the inlay hints for a given text document, optionally
  // using a cache if it has already been populated.
  async getInlayHintsForTextDocument(document: TextDocument): Promise<InlayHintSet | undefined> {
    if (document.languageId !== "ruby") {
      // This editor may have previously been a Ruby file, but that has now
      // changed. So we should delete the inlay hints that may be there.
      if (this.inlayHintsCache.has(document)) {
        this.inlayHintsCache.delete(document);

        // Return an empty set of inlay hints so that it gets properly cleared
        // from the document.
        return { before: [], after: [] };
      }

      // Otherwise, we're going to return undefined so that we don't bother with
      // this file, as it's not a Ruby file.
      return undefined;
    }

    // Check the cache first to see if we have already computed the inlay hints
    // for this document. Return them if we have them.
    let inlayHints = this.inlayHintsCache.get(document);
    if (inlayHints) {
      this.outputChannel.appendLine("Loading inlay hints from cache");
      return inlayHints;
    }

    // Otherwise, asynchronously request the inlay hints from the language
    // server, cache the response, and return it.
    this.outputChannel.appendLine("Requesting inlay hints");
    inlayHints = await this.languageClient.sendRequest<InlayHintSet>("textDocument/inlayHints", {
      textDocument: { uri: document.uri.toString() }
    });

    // In case of a syntax error, this is not going to return anything. In that
    // case, we don't want to set the cache to anything, but we also don't want
    // to clear the previous inlay hints either. So we're just going to return
    // undefined
    if (!inlayHints) {
      return undefined;
    }

    this.inlayHintsCache.set(document, inlayHints);
    return inlayHints;
  }

  async setInlayHintsForEditor(editor: TextEditor) {
    const inlayHints = await this.getInlayHintsForTextDocument(editor.document);
    if (!inlayHints) {
      return;
    }

    const decorations: DecorationOptions[] = [
      ...inlayHints.before.map(({ position, text: contentText }) => ({
        range: new Range(editor.document.positionAt(position), editor.document.positionAt(position)),
        renderOptions: { before: { contentText } }
      })),
      ...inlayHints.after.map(({ position, text: contentText }) => ({
        range: new Range(editor.document.positionAt(position), editor.document.positionAt(position)),
        renderOptions: { after: { contentText } }
      }))
    ];

    this.outputChannel.appendLine("Settings inlay hints");
    editor.setDecorations(this.decorationType, decorations);
  }

  setInlayHintsForEditors(editors: readonly TextEditor[]) {
    editors.forEach((editor) => this.setInlayHintsForEditor(editor));
  }
}

// The return value of the debounce function below.
type Debounced<T extends object> = Disposable & ((argument: T) => void);

// This function will take a given callback and delay it by a given delay. If
// another call to the same function with the same argument comes in before the
// first one finishes, it will cancel the first invocation and start the delay
// again.
function debounce<T extends object>(delay: number, callback: (argument: T) => void): Debounced<T> {
  let allTimeouts = new WeakMap<T, NodeJS.Timeout>();
  const liveTimeouts = new Set<NodeJS.Timeout>();

  const debounced = (argument: T) => {
    // First, clear out the timeout for the previous call to this debounced
    // callback.
    const previousTimeout = allTimeouts.get(argument);
    if (previousTimeout !== undefined) {
      clearTimeout(previousTimeout);
      liveTimeouts.delete(previousTimeout);
    }

    // Next, create a new timeout for this call to the debounced callback.
    // If it doesn't get cancelled by a subsequent call, it will be invoked with
    // the given argument.
    const timeout = setTimeout(() => {
      allTimeouts.delete(argument);
      liveTimeouts.delete(timeout);
      callback(argument);   
    }, delay);

    // Finally, track the timeout that we just created in both a WeakMap
    // that links the editor to the timeout and a set. We track both so that
    // we can iterate through the timeouts when VSCode needs to dispose of
    // this subscription.
    allTimeouts.set(argument, timeout);
    liveTimeouts.add(timeout);
  };

  // Define the necessary dispose function so that VSCode knows how to
  // trigger disposal of this entire debounced function.
  debounced.dispose = () => {
    liveTimeouts.forEach((timeout) => clearTimeout(timeout));
    liveTimeouts.clear();
    allTimeouts = new WeakMap();
  };

  return debounced;
}

export default InlayHints;
