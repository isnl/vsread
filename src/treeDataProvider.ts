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
    return Promise.resolve([
      new DemoTreeItem(
        'Hello World', 
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'extension.sayHello',
          title: 'Say Hello',
          arguments: []
        }
      ),
      new DemoTreeItem(
        'Parent Item',
        vscode.TreeItemCollapsibleState.Collapsed
      )
    ]);
  }
}