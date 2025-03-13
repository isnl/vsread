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
exports.CombinedViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 导入解析库
const epub_1 = __importDefault(require("epub"));
const html_to_text_1 = require("html-to-text");
class CombinedViewProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._currentPage = 1;
        this._linesPerPage = 20;
        this._totalPages = 0;
        this._content = [];
        this._storageKey = 'textPreview.state';
        this._filePageMap = new Map();
        this._history = [];
        this._historyLimit = 50;
        this._fileType = 'txt';
        this._bossKeyActive = false;
        this._loadState();
    }
    _loadState() {
        try {
            const stateData = this._context.globalState.get('textReader.state') || {
                filePageMap: {},
                history: []
            };
            this._filePageMap = new Map(Object.entries(stateData.filePageMap));
            this._history = stateData.history;
            console.log('加载状态成功:', stateData);
        }
        catch (error) {
            console.error('加载状态失败:', error);
            this._filePageMap = new Map();
            this._history = [];
        }
    }
    async _saveState() {
        try {
            const filePageMapObj = Object.fromEntries(this._filePageMap.entries());
            const stateData = {
                filePageMap: filePageMapObj,
                history: this._history
            };
            await Promise.all([
                this._context.globalState.update('textReader.state', stateData)
            ]);
            console.log('保存状态成功:', stateData);
        }
        catch (error) {
            console.error('保存状态失败:', error);
            vscode.window.showErrorMessage('保存阅读进度失败');
        }
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
                    await this._updatePageForCurrentFile();
                    break;
                case 'prevPage':
                    this._currentPage = Math.max(this._currentPage - 1, 1);
                    this._updateContent();
                    await this._updatePageForCurrentFile();
                    break;
                case 'jumpToPage':
                    const page = parseInt(data.page);
                    if (!isNaN(page) && page >= 1 && page <= this._totalPages) {
                        this._currentPage = page;
                        this._updateContent();
                        await this._updatePageForCurrentFile();
                    }
                    break;
                case 'openFile':
                    vscode.commands.executeCommand('vsread.openFile');
                    break;
                case 'openHistoryFile':
                    if (data.filePath) {
                        this.loadFile(data.filePath);
                    }
                    break;
                case 'toggleBossKey':
                    this.toggleBossKey();
                    break;
            }
        });
        // 初始化时更新历史记录和内容
        this._updateHistory();
        if (this._currentFile) {
            this._updateContent();
        }
    }
    async loadFile(filePath) {
        try {
            this._content = [];
            this._currentFile = filePath;
            this._fileType = path.extname(filePath).toLowerCase().substring(1);
            // 只处理 txt 和 epub
            switch (this._fileType) {
                case 'epub':
                    await this._loadEpub(filePath);
                    break;
                case 'txt':
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    this._content = content.split('\n');
                    break;
                default:
                    throw new Error('不支持的文件格式');
            }
            // 计算总页数
            this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
            // 在加载完内容后恢复保存的页码
            const savedPage = this._filePageMap.get(filePath);
            console.log(`尝试恢复文件 ${filePath} 的页码, 保存的页码: ${savedPage}, 总页数: ${this._totalPages}`);
            if (savedPage !== undefined && savedPage <= this._totalPages) {
                this._currentPage = savedPage;
                console.log(`成功恢复页码: ${savedPage}`);
            }
            else {
                this._currentPage = 1;
                console.log(`使用第 1 页 (${savedPage === undefined ? '无保存页码' : '保存的页码超出范围'})`);
            }
            // 添加到历史记录
            await this.addToHistory(filePath);
            // 更新界面
            this._updateContent();
            this._updateHistory();
            // 确保保存当前状态
            await this._updatePageForCurrentFile();
        }
        catch (error) {
            console.error('加载文件失败:', error);
            vscode.window.showErrorMessage(`加载文件错误: ${error}`);
        }
    }
    // 修改添加历史记录的方法，处理 EPUB 封面
    async addToHistory(filePath) {
        const fileType = path.extname(filePath).toLowerCase().substring(1);
        const title = path.basename(filePath);
        let cover;
        const isEpub = fileType === 'epub';
        if (isEpub) {
            try {
                const book = new epub_1.default(filePath);
                cover = await this._getEpubCover(book);
            }
            catch (error) {
                console.error('获取 EPUB 封面失败:', error);
            }
        }
        this._history = this._history.filter(item => item.filePath !== filePath);
        this._history.unshift({
            filePath,
            lastAccessed: Date.now(),
            title,
            cover,
            isEpub
        });
        if (this._history.length > this._historyLimit) {
            this._history = this._history.slice(0, this._historyLimit);
        }
        await this._saveState();
        this._updateHistory();
    }
    // 添加获取 EPUB 封面的方法
    _getEpubCover(book) {
        return new Promise((resolve) => {
            book.on('end', () => {
                if (book.metadata.cover) {
                    book.getImage(book.metadata.cover, (error, data, mimeType) => {
                        if (error || !data) {
                            resolve(undefined);
                            return;
                        }
                        const base64 = data.toString('base64');
                        resolve(`data:${mimeType};base64,${base64}`);
                    });
                }
                else {
                    resolve(undefined);
                }
            });
            book.parse();
        });
    }
    // 更新历史记录显示
    _updateHistory() {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            type: 'updateHistory',
            history: this._history
        });
    }
    // 加载 EPUB 文件
    async _loadEpub(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const book = new epub_1.default(filePath);
                let chaptersLoaded = 0;
                let totalChapters = 0;
                book.on('end', () => {
                    // 获取总章节数
                    totalChapters = book.flow.length;
                    console.log(`EPUB 文件共有 ${totalChapters} 个章节`);
                    if (totalChapters === 0) {
                        resolve(); // 如果没有章节，直接完成
                        return;
                    }
                    // 获取章节内容
                    book.flow.forEach((chapter) => {
                        if (!chapter.id) {
                            chaptersLoaded++;
                            if (chaptersLoaded === totalChapters) {
                                console.log('所有章节加载完成');
                                resolve();
                            }
                            return;
                        }
                        book.getChapter(chapter.id, (error, text) => {
                            if (error) {
                                console.error('加载章节失败:', error);
                                chaptersLoaded++;
                                if (chaptersLoaded === totalChapters) {
                                    console.log('所有章节加载完成');
                                    resolve();
                                }
                                return;
                            }
                            if (!text) {
                                console.error('章节内容为空');
                                chaptersLoaded++;
                                if (chaptersLoaded === totalChapters) {
                                    console.log('所有章节加载完成');
                                    resolve();
                                }
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
                            // 将章节内容添加到总内容中
                            this._content = this._content.concat(['', `=== 第 ${chaptersLoaded + 1} 章 ===`, ''], plainText.split('\n'));
                            chaptersLoaded++;
                            console.log(`已加载 ${chaptersLoaded}/${totalChapters} 章节`);
                            // 只有在所有章节都加载完成后才解析完成
                            if (chaptersLoaded === totalChapters) {
                                console.log('所有章节加载完成');
                                // 更新总页数
                                this._totalPages = Math.ceil(this._content.length / this._linesPerPage);
                                this._updateContent();
                                resolve();
                            }
                        });
                    });
                });
                book.on('error', (error) => {
                    console.error('EPUB 加载失败:', error);
                    reject(error);
                });
                book.parse();
            }
            catch (error) {
                console.error('EPUB 解析失败:', error);
                reject(error);
            }
        });
    }
    // 添加检查是否有打开文件的方法
    hasOpenFile() {
        return !!this._currentFile;
    }
    _updateContent() {
        if (!this._view)
            return;
        // 计算要发送的内容范围
        // 不再基于固定行数，而是发送一个合理的文本块
        const chunkSize = 10; // 每次发送约10行文本，可以根据需要调整
        const startIndex = (this._currentPage - 1) * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, this._content.length);
        const currentContent = this._content.slice(startIndex, endIndex).join('\n');
        // 更新总页数计算方式
        this._totalPages = Math.ceil(this._content.length / chunkSize);
        this._view.webview.postMessage({
            type: 'updateContent',
            content: currentContent,
            currentPage: this._currentPage,
            totalPages: this._totalPages,
            currentFile: this._currentFile,
            history: this._history,
            adaptiveLayout: true // 添加标志，告诉前端使用自适应布局
        });
    }
    // 在页码变化的地方更新映射
    async _updatePageForCurrentFile() {
        if (this._currentFile) {
            try {
                // 更新当前文件的页码映射
                this._filePageMap.set(this._currentFile, this._currentPage);
                console.log(`正在保存文件 ${this._currentFile} 的页码: ${this._currentPage}`);
                // 立即保存状态
                await this._saveState();
                console.log(`成功保存文件 ${this._currentFile} 的页码: ${this._currentPage}`);
            }
            catch (error) {
                console.error('保存页码失败:', error);
                vscode.window.showErrorMessage('保存阅读进度失败');
            }
        }
    }
    // 添加切换老板键的方法
    toggleBossKey() {
        if (!this._view)
            return;
        this._bossKeyActive = !this._bossKeyActive;
        this._view.webview.postMessage({
            type: 'toggleBossKey',
            active: this._bossKeyActive
        });
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
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          
          .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
          }
          
          .header {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-input-border);
          }
          
          .bookshelf-container {
            height: 30%;
            overflow-y: auto;
            border-bottom: 1px solid var(--vscode-input-border);
            padding: 8px;
          }
          
          .bookshelf-title {
            font-size: 16px;
            font-weight: bold;
          }
          
          .book-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            padding: 16px;
            overflow-y: auto;
            max-width: 420px;
            margin: 0 auto;
          }
          
          /* 响应式布局 */
          @media (max-width: 420px) {
            .book-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }
          
          @media (max-width: 320px) {
            .book-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          
          .book-card {
            display: flex;
            height: 160px;
            overflow: hidden;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            border-radius: 4px;
            background: var(--vscode-editor-background);
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid transparent;
            position: relative;
            transition: all 0.2s ease;
          }
          
          .book-card.active {
            background: var(--vscode-list-activeSelectionBackground);
            border: 1px solid var(--vscode-focusBorder);
          }
          
          .book-card.active::after {
            content: '';
            position: absolute;
            top: 8px;
            right: 8px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: var(--vscode-statusBarItem-prominentBackground, #388a34);
          }
          
          .book-card.active .book-title,
          .book-card.active .book-time {
            color: var(--vscode-list-activeSelectionForeground);
          }
          
          .book-cover {
            width: 100%;
            flex: 1;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            overflow: hidden;
          }
          
          .book-cover img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          
          .book-info {
            width: 100%;
            text-align: center;
            padding: 0 4px;
            box-sizing: border-box;
          }
          
          .book-title {
            font-size: 12px;
            margin-bottom: 4px;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            display: block !important;
          }
          
          .book-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            display: block !important;
          }
          
          /* 添加文件按钮样式 */
          .add-file-card {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
          }
          
          .add-file-card:hover {
            background-color: var(--vscode-button-hover-background);
          }
          
          .add-file-card .book-cover {
            background: transparent;
          }
          
          .add-file-card .book-title,
          .add-file-card .book-time {
            color: var(--vscode-button-foreground);
          }
          
          .reader-container {
            height: 70%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          
          .navigation-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-input-border);
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
          
          .settings-control {
            display: flex;
            align-items: center;
            margin-left: 16px;
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
          
          .content-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            display: flex;
            flex-direction: column;
          }
          
          pre { 
            white-space: pre-wrap; 
            word-wrap: break-word; 
            margin: 0;
            font-family: 'Courier New', Courier, monospace;
            line-height: 1.5;
            padding: 12px;
            box-sizing: border-box;
            width: 100%;
            height: auto;
            overflow-y: auto;
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
          
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
          }
          
          .empty-state svg {
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
            opacity: 0.6;
          }
          
          .empty-state-text {
            font-size: 14px;
            margin-bottom: 16px;
          }
          
          /* 添加鼠标悬停效果 */
          .book-card:hover {
            background: var(--vscode-list-hoverBackground);
            border: 1px solid var(--vscode-focusBorder);
          }
          
          /* 添加老板键蒙版样式 */
          .boss-key-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--vscode-editor-background);
            z-index: 9999;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          
          .boss-key-overlay.active {
            display: flex;
          }
          
          .boss-key-message {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-top: 16px;
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          
          .boss-key-overlay:hover .boss-key-message {
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <!-- 添加老板键蒙版 -->
        <div id="bossKeyOverlay" class="boss-key-overlay">
          <div class="boss-key-message">双击此处或再次按下快捷键恢复</div>
        </div>
        
        <div class="container">
          <!-- 移除原来的header中的打开文件按钮 -->
          <div class="header">
            <div class="bookshelf-title">书架</div>
          </div>
          
          <div class="bookshelf-container">
            <div id="bookList" class="book-grid">
              <!-- 历史记录将在这里动态生成 -->
            </div>
          </div>
          
          <div class="reader-container">
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
              
              <div class="controls-right">
                <div class="page-jump">
                  <input type="number" id="pageInput" min="1" placeholder="页码">
                  <button onclick="jumpToPage()">跳转</button>
                </div>
              </div>
            </div>
            
            <div class="content-container">
              <div id="emptyState" class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <div class="empty-state-text">还没有打开任何文件</div>
                <button onclick="openFile()">打开文件</button>
              </div>
              <pre id="content" style="display: none;"></pre>
            </div>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          // 初始化状态
          let currentFile = null;
          
          window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
              case 'updateContent':
                document.getElementById('content').textContent = message.content;
                document.getElementById('pageInfo').textContent = \`\${message.currentPage}/\${message.totalPages}\`;
                
                const pageInput = document.getElementById('pageInput');
                if (pageInput) {
                  pageInput.setAttribute('max', message.totalPages.toString());
                  pageInput.placeholder = \`1-\${message.totalPages}\`;
                }
                
                // 修正：重置内容元素的滚动位置
                document.getElementById('content').scrollTop = 0;
                // 同时也重置容器的滚动位置
                document.querySelector('.content-container').scrollTop = 0;
                
                // 显示内容，隐藏空状态
                document.getElementById('content').style.display = 'block';
                document.getElementById('emptyState').style.display = 'none';
                
                // 更新当前文件并刷新历史记录显示
                currentFile = message.currentFile;
                
                // 如果有历史记录消息，重新触发历史记录更新
                if (message.history) {
                  window.dispatchEvent(new CustomEvent('message', { 
                    detail: { data: { type: 'updateHistory', history: message.history } } 
                  }));
                }

                if (message.adaptiveLayout) {
                  // 使用自适应布局
                  document.getElementById('content').style.height = 'auto';
                  document.getElementById('content').style.maxHeight = 'none';
                } else {
                  // 使用固定行数布局
                  document.getElementById('content').style.height = '';
                  document.getElementById('content').style.maxHeight = '';
                }
                break;
                
              case 'updateHistory':
                const bookList = document.getElementById('bookList');
                if (bookList) {
                  // 添加"打开文件"卡片作为第一个元素
                  let historyHtml = \`
                    <div class="book-card add-file-card" onclick="openFile()">
                      <div class="book-cover">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </div>
                      <div class="book-info">
                        <div class="book-title">导入书籍</div>
                        <div class="book-time">.txt/.epub</div>
                      </div>
                    </div>
                  \`;
                  
                  // 添加历史记录
                  if (message.history && message.history.length > 0) {
                    historyHtml += message.history.map(item => {
                      const date = new Date(item.lastAccessed);
                      const timeStr = date.toLocaleDateString();
                      const coverHtml = item.isEpub && item.cover
                        ? \`<img src="\${item.cover}" alt="\${item.title}">\`
                        : \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                            <path fill="currentColor" d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V4H6z"/>
                            <path fill="currentColor" d="M8 6h8v2H8V6zm0 4h8v2H8v-2zm0 4h8v2H8v-2z"/>
                          </svg>\`;
                      
                      // 检查是否是当前正在阅读的文件
                      const isActive = currentFile === item.filePath;
                      
                      return \`
                        <div class="book-card \${isActive ? 'active' : ''}" onclick="vscode.postMessage({ type: 'openHistoryFile', filePath: '\${item.filePath}'})">
                          <div class="book-cover">
                            \${coverHtml}
                          </div>
                          <div class="book-info">
                            <div class="book-title" title="\${item.title}">\${item.title}</div>
                            <div class="book-time" title="\${timeStr}">\${timeStr}</div>
                          </div>
                        </div>
                      \`;
                    }).join('');
                  }
                  
                  bookList.innerHTML = historyHtml;
                }
                break;
                
              case 'toggleBossKey':
                const overlay = document.getElementById('bossKeyOverlay');
                if (message.active) {
                  overlay.classList.add('active');
                } else {
                  overlay.classList.remove('active');
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

          window.addEventListener('DOMContentLoaded', () => {
            // 为内容容器添加点击事件
            const contentContainer = document.querySelector('.content-container');
            if (contentContainer) {
              contentContainer.addEventListener('click', (event) => {
                // 获取点击位置相对于容器的水平位置
                const containerWidth = contentContainer.clientWidth;
                const clickX = event.clientX - contentContainer.getBoundingClientRect().left;
                
                // 如果点击在左侧 40% 区域，执行上一页
                if (clickX < containerWidth * 0.4) {
                  prevPage();
                } 
                // 如果点击在右侧 40% 区域，执行下一页
                else if (clickX > containerWidth * 0.6) {
                  nextPage();
                }
                // 中间 20% 区域不做操作，可以用于选择文本等
              });
            }
          });

          // 添加双击蒙版事件处理
          document.getElementById('bossKeyOverlay').addEventListener('dblclick', () => {
            vscode.postMessage({ type: 'toggleBossKey' });
          });
        </script>
      </body>
      </html>
    `;
    }
}
exports.CombinedViewProvider = CombinedViewProvider;
//# sourceMappingURL=combinedViewProvider.js.map