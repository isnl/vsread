import * as vscode from 'vscode';
import { DemoTreeDataProvider, DemoTreeItem } from './treeDataProvider';
import { TextPreviewProvider } from './textPreviewProvider';

export function activate(context: vscode.ExtensionContext) {
  // 注册数据提供器
  const treeDataProvider = new DemoTreeDataProvider();
  vscode.window.registerTreeDataProvider('mySidebarView', treeDataProvider);

  // 注册文本预览提供器
  const textPreviewProvider = new TextPreviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('textPreview', textPreviewProvider)
  );

  // 注册打开文件命令
  context.subscriptions.push(
    vscode.commands.registerCommand('textView.openFile', async () => {
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
      }
    })
  );

  // 注册替换文件命令
  context.subscriptions.push(
    vscode.commands.registerCommand('textView.replaceFile', async () => {
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
      }
    })
  );

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.sayHello', (node: DemoTreeItem) => {
      vscode.window.showInformationMessage(`Clicked: ${node.label}`);
    })
  );

  // 注册刷新命令（可选）
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refresh', () => {
      treeDataProvider.refresh();
    })
  );
}

export function deactivate() {}