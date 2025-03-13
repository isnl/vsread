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
const combinedViewProvider_1 = require("./combinedViewProvider");
function activate(context) {
    // 创建一个新的合并视图提供器，传入 context
    const combinedViewProvider = new combinedViewProvider_1.CombinedViewProvider(context.extensionUri, context);
    // 注册合并视图
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('vsread', combinedViewProvider));
    // 注册打开文件命令
    context.subscriptions.push(vscode.commands.registerCommand('vsread.openFile', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                '所有支持的格式': ['txt', 'epub'],
                '文本文件': ['txt'],
                '电子书': ['epub'],
            }
        });
        if (fileUri && fileUri[0]) {
            combinedViewProvider.loadFile(fileUri[0].fsPath);
        }
    }));
    // 注册历史记录文件打开命令
    context.subscriptions.push(vscode.commands.registerCommand('vsread.openHistoryFile', (filePath) => {
        combinedViewProvider.loadFile(filePath);
    }));
    // 注册老板键命令
    context.subscriptions.push(vscode.commands.registerCommand('vsread.toggleBossKey', () => {
        combinedViewProvider.toggleBossKey();
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map