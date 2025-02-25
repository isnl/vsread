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
        this._history = [];
        this._historyLimit = 10;
        this._loadHistory();
    }
    _loadHistory() {
        const config = vscode.workspace.getConfiguration('textPreview');
        this._history = config.get('history', []);
    }
    _saveHistory() {
        const config = vscode.workspace.getConfiguration('textPreview');
        config.update('history', this._history, true);
    }
    addToHistory(filePath) {
        // 移除已存在的相同路径
        this._history = this._history.filter(path => path !== filePath);
        // 添加到开头
        this._history.unshift(filePath);
        // 限制历史记录数量
        if (this._history.length > this._historyLimit) {
            this._history = this._history.slice(0, this._historyLimit);
        }
        this._saveHistory();
        this.refresh();
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
        const historyItems = this._history.map(filePath => {
            const fileName = filePath.split('/').pop() || filePath;
            return new DemoTreeItem(fileName, vscode.TreeItemCollapsibleState.None, {
                command: 'textView.openFile',
                title: '打开文件',
                arguments: [{ fsPath: filePath }]
            });
        });
        return Promise.resolve([
            new DemoTreeItem('历史记录', vscode.TreeItemCollapsibleState.Expanded),
            ...historyItems
        ]);
    }
}
exports.DemoTreeDataProvider = DemoTreeDataProvider;
//# sourceMappingURL=treeDataProvider.js.map