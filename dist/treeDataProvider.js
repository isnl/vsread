"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoTreeDataProvider = exports.DemoTreeItem = void 0;
const vscode = require("vscode");
class DemoTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = `${this.label}-tooltip`;
        this.description = "demo item";
    }
}
exports.DemoTreeItem = DemoTreeItem;
class DemoTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve([
            new DemoTreeItem('Hello World', vscode.TreeItemCollapsibleState.None, {
                command: 'extension.sayHello',
                title: 'Say Hello',
                arguments: []
            }),
            new DemoTreeItem('Parent Item', vscode.TreeItemCollapsibleState.Collapsed)
        ]);
    }
}
exports.DemoTreeDataProvider = DemoTreeDataProvider;
//# sourceMappingURL=treeDataProvider.js.map