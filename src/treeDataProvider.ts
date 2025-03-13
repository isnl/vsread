import * as vscode from 'vscode';

export class DemoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-tooltip`;
    this.description = "（按时间排序）";
  }
}

// 首先定义一个接口来表示历史记录项
interface HistoryItem {
  filePath: string;
  lastAccessed: number; // 时间戳
}

export class DemoTreeDataProvider implements vscode.TreeDataProvider<DemoTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DemoTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _history: HistoryItem[] = [];
  private readonly _historyLimit = 10;

  constructor() {
    this._loadHistory();
  }

  private _loadHistory() {
    const config = vscode.workspace.getConfiguration('textPreview');
    this._history = config.get('historyItems', []);
  }

  private _saveHistory() {
    const config = vscode.workspace.getConfiguration('textPreview');
    config.update('historyItems', this._history, true);
  }

  public addToHistory(filePath: string) {
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

    const historyItems = this._history.map(item => {
      const fileName = item.filePath.split('/').pop() || item.filePath;
      
      // 格式化时间为 MM-DD HH:mm
      const date = new Date(item.lastAccessed);
      const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${
        date.getDate().toString().padStart(2, '0')} ${
        date.getHours().toString().padStart(2, '0')}:${
        date.getMinutes().toString().padStart(2, '0')}`;
      
      const treeItem = new DemoTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'vsread.openHistoryFile',
          title: '打开文件',
          arguments: [item.filePath]
        }
      );
      
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