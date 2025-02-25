import * as vscode from 'vscode';
import * as fs from 'fs';

interface WebviewMessage {
  type: 'nextPage' | 'prevPage' | 'jumpToPage' | 'openFile' | 'replaceFile';
  page?: string | number;
}

interface UpdateMessage {
  type: 'update';
  content: string;
  currentPage: number;
  totalPages: number;
}

export class TextPreviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _currentFile?: string;
  private _currentPage: number = 1;
  private _linesPerPage: number = 20;
  private _totalPages: number = 0;
  private _content: string[] = [];
  private readonly _storageKey = 'textPreview.state';

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._loadState();
  }

  private _loadState() {
    const state = vscode.workspace.getConfiguration('textPreview');
    this._currentPage = state.get('currentPage', 1);
    this._linesPerPage = state.get('linesPerPage', 20);
  }

  private _saveState() {
    const config = vscode.workspace.getConfiguration('textPreview');
    config.update('currentPage', this._currentPage, true);
    config.update('linesPerPage', this._linesPerPage, true);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
      switch (data.type) {
        case 'nextPage':
          this._currentPage = Math.min(this._currentPage + 1, this._totalPages);
          this._updateContent();
          this._saveState();
          break;
        case 'prevPage':
          this._currentPage = Math.max(this._currentPage - 1, 1);
          this._updateContent();
          this._saveState();
          break;
        case 'jumpToPage':
          const page = parseInt(data.page as string);
          if (!isNaN(page) && page >= 1 && page <= this._totalPages) {
            this._currentPage = page;
            this._updateContent();
            this._saveState();
          }
          break;
        case 'openFile':
          const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
              'Text Files': ['txt']
            }
          });
          if (fileUri && fileUri[0]) {
            this.loadFile(fileUri[0].fsPath);
          }
          break;
        case 'replaceFile':
          if (this._currentFile) {
            const fileUri = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'Text Files': ['txt']
              }
            });
            if (fileUri && fileUri[0]) {
              this.loadFile(fileUri[0].fsPath);
            }
          } else {
            vscode.window.showWarningMessage('请先打开一个文件');
          }
          break;
      }
    });
  }

  public async loadFile(filePath: string) {
    try {
      this._currentFile = filePath;
      this._currentPage = 1;
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this._content = content.split('\n');
      this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
      this._updateContent();
      this._saveState();
    } catch (error) {
      vscode.window.showErrorMessage(`Error loading file: ${error}`);
    }
  }

  // 添加检查是否有打开文件的方法
  public hasOpenFile(): boolean {
    return !!this._currentFile;
  }

  private _updateContent() {
    if (!this._view) return;

    const startIndex = (this._currentPage - 1) * this._linesPerPage;
    const endIndex = startIndex + this._linesPerPage;
    const currentContent = this._content.slice(startIndex, endIndex).join('\n');

    this._view.webview.postMessage({
      type: 'update',
      content: currentContent,
      currentPage: this._currentPage,
      totalPages: this._totalPages
    });
  }

  private _getHtmlForWebview() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { padding: 10px; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
          .controls { margin-bottom: 10px; }
          button { margin-right: 5px; }
          .page-info { display: inline-block; margin-left: 10px; }
          .file-controls { margin-bottom: 10px; }
          .page-jump { display: inline-block; margin-left: 10px; }
          .page-jump input { width: 50px; margin-right: 5px; }
        </style>
      </head>
      <body>
        <div class="file-controls">
          <button onclick="openFile()">选择文件</button>
          <button onclick="replaceFile()">替换文件</button>
        </div>
        <div class="controls">
          <button onclick="prevPage()">上一页</button>
          <button onclick="nextPage()">下一页</button>
          <span class="page-info">页码: <span id="pageInfo">-/-</span></span>
          <div class="page-jump">
            <input type="number" id="pageInput" min="1" placeholder="页码">
            <button onclick="jumpToPage()">跳转</button>
          </div>
        </div>
        <pre id="content"></pre>
        <script>
          const vscode = acquireVsCodeApi();
          
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'update':
                document.getElementById('content').textContent = message.content;
                document.getElementById('pageInfo').textContent = \`\${message.currentPage}/\${message.totalPages}\`;
                const pageInput = document.getElementById('pageInput');
                if (pageInput) {
                  pageInput.setAttribute('max', message.totalPages.toString());
                }
                break;
            }
          });

          window.prevPage = function() {
            vscode.postMessage({ type: 'prevPage' });
          }

          window.nextPage = function() {
            vscode.postMessage({ type: 'nextPage' });
          }

          window.jumpToPage = function() {
            const pageInput = document.getElementById('pageInput');
            const page = pageInput ? pageInput.value : '';
            if (page) {
              vscode.postMessage({ type: 'jumpToPage', page });
            }
          }

          window.openFile = function() {
            vscode.postMessage({ type: 'openFile' });
          }

          window.replaceFile = function() {
            vscode.postMessage({ type: 'replaceFile' });
          }
        </script>
      </body>
      </html>
    `;
  }
}