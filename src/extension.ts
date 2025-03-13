import * as vscode from 'vscode';
import { CombinedViewProvider } from "./combinedViewProvider";

export function activate(context: vscode.ExtensionContext) {
  // 创建一个新的合并视图提供器，传入 context
  const combinedViewProvider = new CombinedViewProvider(context.extensionUri, context);
  
  // 注册合并视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vsread', combinedViewProvider)
  );
  
  // 注册打开文件命令
  context.subscriptions.push(
    vscode.commands.registerCommand('vsread.openFile', async () => {
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
    })
  );

  
  // 注册历史记录文件打开命令
  context.subscriptions.push(
    vscode.commands.registerCommand('vsread.openHistoryFile', (filePath: string) => {
      combinedViewProvider.loadFile(filePath);
    })
  );
  
  // 注册老板键命令
  context.subscriptions.push(
    vscode.commands.registerCommand('vsread.toggleBossKey', () => {
      combinedViewProvider.toggleBossKey();
    })
  );
}

export function deactivate() {}