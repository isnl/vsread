import * as vscode from 'vscode';

export class DemoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-tooltip`;
    this.description = "demo item";
  }
}

export class DemoTreeDataProvider implements vscode.TreeDataProvider<DemoTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DemoTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _history: string[] = [];
  private readonly _historyLimit = 10;

  constructor() {
    this._loadHistory();
  }

  private _loadHistory() {
    const config = vscode.workspace.getConfiguration('textPreview');
    this._history = config.get('history', []);
  }

  private _saveHistory() {
    const config = vscode.workspace.getConfiguration('textPreview');
    config.update('history', this._history, true);
  }

  public addToHistory(filePath: string) {
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

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DemoTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DemoTreeItem): Thenable<DemoTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const historyItems = this._history.map(filePath => {
      const fileName = filePath.split('/').pop() || filePath;
      return new DemoTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'textView.openFile',
          title: '打开文件',
          arguments: [{ fsPath: filePath }]
        }
      );
    });

    return Promise.resolve([
      new DemoTreeItem('历史记录', vscode.TreeItemCollapsibleState.Expanded),
      ...historyItems
    ]);
  }
}