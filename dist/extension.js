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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const treeDataProvider_1 = require("./treeDataProvider");
const textPreviewProvider_1 = require("./textPreviewProvider");
function activate(context) {
    // 注册数据提供器
    const treeDataProvider = new treeDataProvider_1.DemoTreeDataProvider();
    vscode.window.registerTreeDataProvider('mySidebarView', treeDataProvider);
    // 注册文本预览提供器
    const textPreviewProvider = new textPreviewProvider_1.TextPreviewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('textPreview', textPreviewProvider));
    // 监听文件加载事件，更新历史记录
    textPreviewProvider.onDidLoadFile(filePath => {
        treeDataProvider.addToHistory(filePath);
    });
    // 注册打开文件命令
    context.subscriptions.push(vscode.commands.registerCommand('textView.openFile', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                '所有支持的格式': ['txt', 'epub', 'mobi', 'pdf', 'md', 'html', 'htm'],
                '文本文件': ['txt', 'md'],
                '电子书': ['epub', 'mobi'],
                'PDF文档': ['pdf'],
                '网页文件': ['html', 'htm']
            }
        });
        if (fileUri && fileUri[0]) {
            textPreviewProvider.loadFile(fileUri[0].fsPath);
            treeDataProvider.addToHistory(fileUri[0].fsPath);
        }
    }));
    // 注册替换文件命令
    context.subscriptions.push(vscode.commands.registerCommand('textView.replaceFile', async () => {
        if (!textPreviewProvider.hasOpenFile()) {
            vscode.window.showWarningMessage('请先打开一个文件');
            return;
        }
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                '所有支持的格式': ['txt', 'epub', 'mobi', 'pdf', 'md', 'html', 'htm'],
                '文本文件': ['txt', 'md'],
                '电子书': ['epub', 'mobi'],
                'PDF文档': ['pdf'],
                '网页文件': ['html', 'htm']
            }
        });
        if (fileUri && fileUri[0]) {
            textPreviewProvider.loadFile(fileUri[0].fsPath);
            treeDataProvider.addToHistory(fileUri[0].fsPath);
        }
    }));
    // 注册命令
    context.subscriptions.push(vscode.commands.registerCommand('extension.sayHello', (node) => {
        vscode.window.showInformationMessage(`Clicked: ${node.label}`);
    }));
    // 注册刷新命令（可选）
    context.subscriptions.push(vscode.commands.registerCommand('extension.refresh', () => {
        treeDataProvider.refresh();
    }));
    // 注册历史记录文件打开命令
    context.subscriptions.push(vscode.commands.registerCommand('textView.openHistoryFile', (filePath) => {
        // 直接加载文件，不需要显示文件选择对话框
        textPreviewProvider.loadFile(filePath);
        // 不需要再次添加到历史记录，因为loadFile会触发onDidLoadFile事件
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map