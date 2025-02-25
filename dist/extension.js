"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const treeDataProvider_1 = require("./treeDataProvider");
const textPreviewProvider_1 = require("./textPreviewProvider");
function activate(context) {
    // 注册数据提供器
    const treeDataProvider = new treeDataProvider_1.DemoTreeDataProvider();
    vscode.window.registerTreeDataProvider('mySidebarView', treeDataProvider);
    // 注册文本预览提供器
    const textPreviewProvider = new textPreviewProvider_1.TextPreviewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('textPreview', textPreviewProvider));
    // 注册打开文件命令
    context.subscriptions.push(vscode.commands.registerCommand('textView.openFile', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Text Files': ['txt']
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
                'Text Files': ['txt']
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
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map