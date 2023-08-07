# vscode-syntax-tree

VSCode support for the [syntax_tree](https://github.com/ruby-syntax-tree/syntax_tree) gem. Available for download in the [VSCode marketplace](https://marketplace.visualstudio.com/items?itemName=ruby-syntax-tree.vscode-syntax-tree).

## Setup

After installing the [syntax_tree](https://github.com/ruby-syntax-tree/syntax_tree) gem and the [VSCode extension](https://marketplace.visualstudio.com/items?itemName=ruby-syntax-tree.vscode-syntax-tree), add the following to your VSCode `settings.json` to format Ruby on save.

```json
"[ruby]": {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "ruby-syntax-tree.vscode-syntax-tree"
},
```

You can find additional config options by searching for "syntax tree" in your VSCode settings.


## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/ruby-syntax-tree/vscode-syntax-tree.

## License

The gem is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
