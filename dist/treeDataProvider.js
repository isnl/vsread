"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoTreeDataProvider = exports.DemoTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class DemoTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = `${this.label}-tooltip`;
        this.description = "（按时间排序）";
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
        this._history = config.get('historyItems', []);
    }
    _saveHistory() {
        const config = vscode.workspace.getConfiguration('textPreview');
        config.update('historyItems', this._history, true);
    }
    addToHistory(filePath) {
        // 移除已存在的相同路径
        this._history = this._history.filter(item => item.filePath !== filePath);
        // 添加到开头，带上当前时间戳
        this._history.unshift({
            filePath,
            lastAccessed: Date.now()
        });
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
        const historyItems = this._history.map(item => {
            const fileName = item.filePath.split('/').pop() || item.filePath;
            // 格式化时间为 MM-DD HH:mm
            const date = new Date(item.lastAccessed);
            const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            const treeItem = new DemoTreeItem(fileName, vscode.TreeItemCollapsibleState.None, {
                command: 'textView.openHistoryFile',
                title: '打开文件',
                arguments: [item.filePath]
            });
            // 设置描述为格式化的时间
            treeItem.description = formattedDate;
            return treeItem;
        });
        return Promise.resolve([
            new DemoTreeItem('历史记录', vscode.TreeItemCollapsibleState.Expanded),
            ...historyItems
        ]);
    }
}
exports.DemoTreeDataProvider = DemoTreeDataProvider;
//# sourceMappingURL=treeDataProvider.js.map