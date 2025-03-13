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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextPreviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 需要添加这些依赖到 package.json
// npm install --save epub pdf-parse html-to-text
// 导入解析库
const epub_1 = __importDefault(require("epub"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const html_to_text_1 = require("html-to-text");
class TextPreviewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._currentPage = 1;
        this._linesPerPage = 20;
        this._totalPages = 0;
        this._content = [];
        this._storageKey = 'textPreview.state';
        this._filePageMap = new Map();
        this._onDidLoadFile = new vscode.EventEmitter();
        this.onDidLoadFile = this._onDidLoadFile.event;
        this._fileType = 'txt'; // 新增文件类型属性
        this._loadState();
    }
    _loadState() {
        const state = vscode.workspace.getConfiguration('textPreview');
        this._currentPage = state.get('currentPage', 1);
        this._linesPerPage = state.get('linesPerPage', 20);
        // 加载文件页码映射
        const filePageMapData = state.get('filePageMap', {});
        this._filePageMap = new Map(Object.entries(filePageMapData));
    }
    _saveState() {
        const config = vscode.workspace.getConfiguration('textPreview');
        config.update('currentPage', this._currentPage, true);
        config.update('linesPerPage', this._linesPerPage, true);
        // 保存文件页码映射
        const filePageMapObj = Object.fromEntries(this._filePageMap.entries());
        config.update('filePageMap', filePageMapObj, true);
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'nextPage':
                    this._currentPage = Math.min(this._currentPage + 1, this._totalPages);
                    this._updateContent();
                    this._updatePageForCurrentFile();
                    break;
                case 'prevPage':
                    this._currentPage = Math.max(this._currentPage - 1, 1);
                    this._updateContent();
                    this._updatePageForCurrentFile();
                    break;
                case 'jumpToPage':
                    const page = parseInt(data.page);
                    if (!isNaN(page) && page >= 1 && page <= this._totalPages) {
                        this._currentPage = page;
                        this._updateContent();
                        this._updatePageForCurrentFile();
                    }
                    break;
                case 'openFile':
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
                    }
                    else {
                        vscode.window.showWarningMessage('请先打开一个文件');
                    }
                    break;
                case 'setLinesPerPage':
                    if (data.linesPerPage && typeof data.linesPerPage === 'number' && data.linesPerPage > 0) {
                        this._linesPerPage = data.linesPerPage;
                        // 重新计算总页数
                        this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
                        // 确保当前页码有效
                        if (this._currentPage > this._totalPages) {
                            this._currentPage = this._totalPages || 1;
                        }
                        this._updateContent();
                        this._updatePageForCurrentFile();
                        this._saveState();
                    }
                    break;
            }
        });
    }
    async loadFile(filePath) {
        try {
            this._currentFile = filePath;
            // 获取文件扩展名并设置文件类型
            this._fileType = path.extname(filePath).toLowerCase().substring(1);
            // 如果在映射中存在该文件的页码记录，则使用它
            if (this._filePageMap.has(filePath)) {
                this._currentPage = this._filePageMap.get(filePath) || 1;
            }
            else {
                this._currentPage = 1; // 新文件默认从第一页开始
            }
            // 根据文件类型选择不同的解析方法
            switch (this._fileType) {
                case 'epub':
                    await this._loadEpub(filePath);
                    break;
                case 'pdf':
                    await this._loadPdf(filePath);
                    break;
                case 'html':
                case 'htm':
                    await this._loadHtml(filePath);
                    break;
                case 'md':
                    await this._loadMarkdown(filePath);
                    break;
                case 'mobi':
                    // mobi 格式较复杂，可能需要特殊处理或转换
                    vscode.window.showWarningMessage('MOBI 格式支持有限，可能无法正确显示所有内容');
                    await this._loadMobi(filePath);
                    break;
                default:
                    // 默认作为文本文件处理
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    this._content = content.split('\n');
                    break;
            }
            this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
            // 确保页码在有效范围内
            if (this._currentPage > this._totalPages) {
                this._currentPage = Math.max(1, this._totalPages);
            }
            this._updateContent();
            this._updatePageForCurrentFile();
            this._saveState();
            // 触发文件加载事件
            this._onDidLoadFile.fire(filePath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`加载文件错误: ${error}`);
        }
    }
    // 加载 EPUB 文件
    async _loadEpub(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const book = new epub_1.default(filePath);
                book.on('end', () => {
                    // 初始化内容数组
                    this._content = [];
                    // 获取章节
                    if (book.spine && book.spine.contents) {
                        // 使用正确的类型
                        const contents = book.spine.contents;
                        // 处理每个章节
                        contents.forEach((item, index) => {
                            // 获取章节ID
                            const chapterId = item.id;
                            book.getChapter(chapterId, (error, text) => {
                                if (error) {
                                    reject(error);
                                    return;
                                }
                                if (!text) {
                                    console.error('章节内容为空');
                                    return;
                                }
                                // 将 HTML 转换为纯文本
                                const plainText = (0, html_to_text_1.htmlToText)(text, {
                                    wordwrap: null,
                                    selectors: [
                                        { selector: 'a', options: { ignoreHref: true } },
                                        { selector: 'img', format: 'skip' }
                                    ]
                                });
                                // 添加章节内容
                                if (index === 0) {
                                    this._content = plainText.split('\n');
                                }
                                else {
                                    this._content = this._content.concat(['', '--- 新章节 ---', ''], plainText.split('\n'));
                                }
                                // 更新总页数和内容
                                this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
                                this._updateContent();
                            });
                        });
                    }
                    resolve();
                });
                book.on('error', (error) => {
                    reject(error);
                });
                book.parse();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    // 加载 PDF 文件
    async _loadPdf(filePath) {
        const dataBuffer = await fs.promises.readFile(filePath);
        const data = await (0, pdf_parse_1.default)(dataBuffer);
        // 分割 PDF 文本内容
        this._content = data.text.split('\n');
    }
    // 加载 HTML 文件
    async _loadHtml(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        // 将 HTML 转换为纯文本
        const plainText = (0, html_to_text_1.htmlToText)(content, {
            wordwrap: null,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
            ]
        });
        this._content = plainText.split('\n');
    }
    // 加载 Markdown 文件
    async _loadMarkdown(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        // 简单处理，保留原始 Markdown
        this._content = content.split('\n');
    }
    // 加载 MOBI 文件 (需要特殊处理)
    async _loadMobi(filePath) {
        // MOBI 格式较复杂，可能需要特殊库或转换工具
        // 这里仅作为示例，实际实现可能需要更复杂的处理
        vscode.window.showInformationMessage('正在尝试解析 MOBI 文件，这可能需要一些时间...');
        try {
            // 这里应该使用专门的 MOBI 解析库
            // 由于缺乏直接的 Node.js MOBI 解析库，可能需要使用外部工具或服务
            // 作为临时解决方案，可以考虑使用 Calibre 的命令行工具进行转换
            // 示例：使用临时文本表示
            this._content = ['MOBI 文件格式暂不完全支持。',
                '请考虑将文件转换为 EPUB 或 PDF 格式以获得更好的阅读体验。'];
        }
        catch (error) {
            vscode.window.showErrorMessage(`解析 MOBI 文件失败: ${error}`);
            this._content = ['无法解析 MOBI 文件。'];
        }
    }
    // 添加检查是否有打开文件的方法
    hasOpenFile() {
        return !!this._currentFile;
    }
    _updateContent() {
        if (!this._view)
            return;
        const startIndex = (this._currentPage - 1) * this._linesPerPage;
        const endIndex = startIndex + this._linesPerPage;
        const currentContent = this._content.slice(startIndex, endIndex).join('\n');
        this._view.webview.postMessage({
            type: 'update',
            content: currentContent,
            currentPage: this._currentPage,
            totalPages: this._totalPages,
            linesPerPage: this._linesPerPage
        });
    }
    // 在页码变化的地方更新映射
    _updatePageForCurrentFile() {
        if (this._currentFile) {
            this._filePageMap.set(this._currentFile, this._currentPage);
            this._saveState();
        }
    }
    _getHtmlForWebview() {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          :root {
            --vscode-background: var(--vscode-editor-background);
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-button-background: var(--vscode-button-background);
            --vscode-button-foreground: var(--vscode-button-foreground);
            --vscode-button-hover-background: var(--vscode-button-hoverBackground);
            --vscode-input-background: var(--vscode-input-background);
            --vscode-input-foreground: var(--vscode-input-foreground);
            --vscode-input-border: var(--vscode-input-border);
          }
          
          body { 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            color: var(--vscode-foreground);
            background-color: var(--vscode-background);
            margin: 0;
          }
          
          pre { 
            white-space: pre-wrap; 
            word-wrap: break-word; 
            padding: 12px;
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            font-family: 'Courier New', Courier, monospace;
            margin-top: 8px;
            max-height: calc(100vh - 120px);
            overflow: auto;
          }
          
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 8px 8px 8px;
            border-bottom: 1px solid var(--vscode-input-border);
          }
          
          .file-controls {
            display: flex;
            align-items: center;
          }
          
          .navigation-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 0 8px;
          }
          
          .page-controls {
            display: flex;
            align-items: center;
          }
          
          .page-info {
            display: flex;
            align-items: center;
            margin: 0 12px;
            font-size: 14px;
          }
          
          .page-jump {
            display: flex;
            align-items: center;
            margin-left: auto;
          }
          
          .page-jump input {
            width: 60px;
            margin-right: 8px;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
          }
          
          button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
          }
          
          button:hover {
            background-color: var(--vscode-button-hover-background);
          }
          
          button:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
          }
          
          button svg {
            width: 16px;
            height: 16px;
            margin-right: 6px;
          }
          
          .icon-button {
            padding: 6px;
            border-radius: 4px;
          }
          
          .icon-button svg {
            margin-right: 0;
          }
          
          .content-container {
            padding: 0 8px 8px 8px;
          }
          
          /* 添加设置控件的样式 */
          .settings-control {
            display: flex;
            align-items: center;
            margin-top: 8px;
            padding: 0 8px;
          }
          
          .settings-control label {
            margin-right: 8px;
            font-size: 13px;
          }
          
          .settings-control input {
            width: 60px;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="file-controls">
            <button onclick="openFile()">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V3h12v10z"/>
                <path d="M8.5 7.5v-3H7.5v3h-3v1h3v3h1v-3h3v-1h-3z"/>
              </svg>
              打开文件
            </button>
          </div>
        </div>
        
        <div class="navigation-controls">
          <div class="page-controls">
            <button class="icon-button" onclick="prevPage()" title="上一页">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.41 2.41L8 1 2 7l6 6 1.41-1.41L4.83 7z"/>
              </svg>
            </button>
            <span class="page-info">第 <span id="pageInfo">-/-</span> 页</span>
            <button class="icon-button" onclick="nextPage()" title="下一页">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.59 2.41L8 1l6 6-6 6-1.41-1.41L11.17 7z"/>
              </svg>
            </button>
          </div>
          
          <div class="page-jump">
            <input type="number" id="pageInput" min="1" placeholder="页码">
            <button onclick="jumpToPage()">跳转</button>
          </div>
        </div>
        
        <div class="settings-control">
          <label for="linesPerPageInput">每页行数:</label>
          <input type="number" id="linesPerPageInput" min="1" max="100" value="20">
          <button onclick="setLinesPerPage()">应用</button>
        </div>
        
        <div class="content-container">
          <pre id="content"></pre>
        </div>
        
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
                  pageInput.placeholder = \`1-\${message.totalPages}\`;
                }
                
                // 设置每页行数输入框的值
                const linesPerPageInput = document.getElementById('linesPerPageInput');
                if (linesPerPageInput && message.linesPerPage) {
                  linesPerPageInput.value = message.linesPerPage.toString();
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
              pageInput.value = '';
            }
          }

          window.openFile = function() {
            vscode.postMessage({ type: 'openFile' });
          }
          
          window.setLinesPerPage = function() {
            const linesInput = document.getElementById('linesPerPageInput');
            const lines = linesInput ? parseInt(linesInput.value) : 20;
            if (lines && lines > 0) {
              vscode.postMessage({ type: 'setLinesPerPage', linesPerPage: lines });
            }
          }
        </script>
      </body>
      </html>
    `;
    }
}
exports.TextPreviewProvider = TextPreviewProvider;
//# sourceMappingURL=textPreviewProvider.js.map