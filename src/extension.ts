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

  // 监听文件加载事件，更新历史记录
  textPreviewProvider.onDidLoadFile(filePath => {
    treeDataProvider.addToHistory(filePath);
  });

  // 注册打开文件命令
  context.subscriptions.push(
    vscode.commands.registerCommand('textView.openFile', async () => {
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

  // 注册历史记录文件打开命令
  context.subscriptions.push(
    vscode.commands.registerCommand('textView.openHistoryFile', (filePath: string) => {
      // 直接加载文件，不需要显示文件选择对话框
      textPreviewProvider.loadFile(filePath);
      // 不需要再次添加到历史记录，因为loadFile会触发onDidLoadFile事件
    })
  );
}

export function deactivate() {}