/**
 * DC Codex - File Preview Module
 * A reusable IDE-like file preview interface with file navigation sidebar
 * Can be integrated into any page with minimal setup
 */

class DCCodexFilePreview {
    constructor(options = {}) {
        // Configuration options
        this.options = {
            modalId: 'dcCodexFilePreviewModal',
            fontSizeKey: 'dcCodexFontSize',
            defaultFontSize: 14,
            minFontSize: 8,
            maxFontSize: 24,
            apiBase: '/api',
            ...options
        };
        
        // State management
        this.currentFile = null;
        this.currentContext = null;
        this.currentFontSize = parseInt(localStorage.getItem(this.options.fontSizeKey)) || this.options.defaultFontSize;
        this.searchTerm = '';
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.isModalVisible = false;
        this.isLoadingFile = false;
        
        // Initialize the module
        this.init();
    }
    
    init() {
        // Create modal if it doesn't exist
        if (!document.getElementById(this.options.modalId)) {
            this.createModal();
        }
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Load saved preferences
        this.loadPreferences();
    }
    
    createModal() {
        const modalHTML = `
            <div id="${this.options.modalId}" class="dc-codex-modal" style="display: none;">
                <div class="dc-codex-modal-content">
                    <div class="dc-codex-modal-header">
                        <div class="dc-codex-modal-title">
                            <i id="modalFileIcon" class="dc-codex-file-icon fas fa-file"></i>
                            <h2 id="modalFileName">File Preview</h2>
                            <div class="dc-codex-file-badges" id="fileBadges"></div>
                        </div>
                        <div class="dc-codex-modal-controls">
                            <div class="dc-codex-keyboard-shortcuts" title="Keyboard Shortcuts">
                                <span class="dc-codex-shortcut-info">ESC: Close | F11: Fullscreen | Ctrl+/-: Font Size</span>
                            </div>
                            <button id="modalCloseBtn" class="dc-codex-modal-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="dc-codex-modal-body">
                        <div class="dc-codex-modal-sidebar">
                            <div id="modalFileMeta">
                                <!-- File list will be populated here -->
                            </div>
                        </div>
                        <div class="dc-codex-modal-main">
                            <div id="modalFileBody">
                                <!-- File content will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    setupEventHandlers() {
        const modal = document.getElementById(this.options.modalId);
        if (!modal) return;
        
        // Close button
        const closeBtn = modal.querySelector('.dc-codex-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isModalVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.closeModal();
                    break;
                    
                case 'F11':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                    
                case '+':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.increaseFontSize();
                    }
                    break;
                    
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.decreaseFontSize();
                    }
                    break;
                    
                case '0':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.resetFontSize();
                    }
                    break;
                    
                case 'f':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.openSearch();
                    }
                    break;
                    
                case 'ArrowUp':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.navigateToPreviousFile();
                    }
                    break;
                    
                case 'ArrowDown':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.navigateToNextFile();
                    }
                    break;
            }
        });
    }
    
    loadPreferences() {
        // Load saved font size
        const savedFontSize = localStorage.getItem(this.options.fontSizeKey);
        if (savedFontSize) {
            this.currentFontSize = parseInt(savedFontSize);
        }
    }
    
    // Public method to show a file with context
    async showFile(file, context = null) {
        // If no context provided, create a simple one with just this file
        if (!context) {
            context = {
                files: [file],
                contextType: 'single',
                contextPath: file.path
            };
        }
        
        this.currentFile = file;
        this.currentContext = context;
        
        try {
            // Show loading state
            this.showModal(file, null, true);
            
            // Fetch file content
            const response = await fetch(`${this.options.apiBase}/browse/file?path=${encodeURIComponent(file.path)}`);
            const data = await response.json();
            
            if (data.success) {
                this.showModal(file, data, false);
            } else {
                this.showModal(file, { error: data.error || 'Failed to load file' }, false);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            this.showModal(file, { error: 'Failed to connect to server' }, false);
        }
    }
    
    // New method to show file from folder context
    async showFileFromFolder(file, folderPath, folderFiles) {
        const context = {
            files: folderFiles,
            contextType: 'folder',
            contextPath: folderPath,
            folderName: this.getLastPathSegment(folderPath)
        };
        
        await this.showFile(file, context);
    }
    
    // New method to show file from search context (for future use)
    async showFileFromSearch(file, searchResults, searchQuery) {
        const context = {
            files: searchResults,
            contextType: 'search',
            searchQuery: searchQuery
        };
        
        await this.showFile(file, context);
    }
    
    navigateToPreviousFile() {
        if (!this.currentContext || !this.currentContext.files || this.currentContext.files.length <= 1) return;
        
        const currentIndex = this.currentContext.files.findIndex(f => f.path === this.currentFile.path);
        if (currentIndex > 0) {
            const previousFile = this.currentContext.files[currentIndex - 1];
            this.switchToFile(previousFile);
        }
    }
    
    navigateToNextFile() {
        if (!this.currentContext || !this.currentContext.files || this.currentContext.files.length <= 1) return;
        
        const currentIndex = this.currentContext.files.findIndex(f => f.path === this.currentFile.path);
        if (currentIndex < this.currentContext.files.length - 1) {
            const nextFile = this.currentContext.files[currentIndex + 1];
            this.switchToFile(nextFile);
        }
    }
    
    async switchToFile(file) {
        if (this.isLoadingFile || file.path === this.currentFile.path) return;
        
        this.isLoadingFile = true;
        this.currentFile = file;
        
        try {
            // Update UI to show loading for new file
            this.updateModalHeader(file, null);
            this.updateModalSidebar(file, null);
            this.updateModalMainContent(file, null, true);
            
            // Fetch new file content
            const response = await fetch(`${this.options.apiBase}/browse/file?path=${encodeURIComponent(file.path)}`);
            const data = await response.json();
            
            if (data.success) {
                this.updateModalContent(file, data, false);
            } else {
                this.updateModalContent(file, { error: data.error || 'Failed to load file' }, false);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            this.updateModalContent(file, { error: 'Failed to connect to server' }, false);
        } finally {
            this.isLoadingFile = false;
        }
    }
    
    showModal(file, fileData, isLoading = false) {
        const modal = document.getElementById(this.options.modalId);
        if (!modal) return;
        
        // Update modal content
        this.updateModalContent(file, fileData, isLoading);
        
        // Show modal with animation
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.isModalVisible = true;
        
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
    }
    
    closeModal() {
        const modal = document.getElementById(this.options.modalId);
        if (!modal || !this.isModalVisible) return;
        
        modal.classList.remove('visible');
        this.isModalVisible = false;
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            this.currentFile = null;
            this.currentContext = null;
            this.clearSearch();
        }, 300);
    }
    
    updateModalContent(file, fileData, isLoading) {
        this.updateModalHeader(file, fileData);
        this.updateModalSidebar(file, fileData);
        this.updateModalMainContent(file, fileData, isLoading);
    }
    
    updateModalHeader(file, fileData) {
        const modal = document.getElementById(this.options.modalId);
        const fileName = modal.querySelector('#modalFileName');
        const fileIcon = modal.querySelector('.dc-codex-file-icon');
        const fileBadges = modal.querySelector('#fileBadges');
        
        if (fileName) fileName.textContent = file.name;
        
        if (fileIcon) {
            const icon = this.getFileIcon(file);
            fileIcon.className = `dc-codex-file-icon ${icon.class}`;
            fileIcon.style.color = icon.color || '#3b82f6';
        }
        
        if (fileBadges && fileData && !fileData.error) {
            const extension = this.getFileExtension(file.name);
            const size = fileData.size ? this.formatFileSize(fileData.size) : null;
            
            fileBadges.innerHTML = '';
            
            if (extension) {
                fileBadges.innerHTML += `<span class="dc-codex-badge dc-codex-ext-badge">${extension.toUpperCase()}</span>`;
            }
            
            if (size) {
                fileBadges.innerHTML += `<span class="dc-codex-badge dc-codex-size-badge">${size}</span>`;
            }
        }
    }
    
    updateModalSidebar(file, fileData) {
        const modal = document.getElementById(this.options.modalId);
        const sidebar = modal.querySelector('.dc-codex-modal-sidebar');
        if (!sidebar) return;
        
        // Create file list navigation
        let sidebarContent = '';
        
        if (this.currentContext && this.currentContext.files && this.currentContext.files.length > 0) {
            // Header based on context type
            let headerTitle = 'Files';
            let headerIcon = 'fa-folder';
            let headerSubtitle = '';
            
            if (this.currentContext.contextType === 'folder') {
                headerTitle = 'Folder Contents';
                headerSubtitle = this.currentContext.folderName || 'Current Folder';
            } else if (this.currentContext.contextType === 'search') {
                headerTitle = 'Search Results';
                headerIcon = 'fa-search';
                headerSubtitle = `"${this.currentContext.searchQuery}"`;
            }
            
            sidebarContent = `
                <div class="dc-codex-file-nav-header">
                    <div class="dc-codex-file-nav-title">
                        <i class="fas ${headerIcon}"></i>
                        <div>
                            <h3>${headerTitle}</h3>
                            ${headerSubtitle ? `<span class="dc-codex-file-nav-subtitle">${this.escapeHtml(headerSubtitle)}</span>` : ''}
                        </div>
                    </div>
                    <div class="dc-codex-file-count">${this.currentContext.files.length} files</div>
                </div>
                
                <div class="dc-codex-file-nav-controls">
                    <button class="dc-codex-nav-btn" onclick="dcCodexFilePreview.navigateToPreviousFile()" title="Previous file (Ctrl+↑)">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button class="dc-codex-nav-btn" onclick="dcCodexFilePreview.navigateToNextFile()" title="Next file (Ctrl+↓)">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button class="dc-codex-nav-btn" onclick="dcCodexFilePreview.copyAllContent()" title="Copy content">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="dc-codex-nav-btn" onclick="dcCodexFilePreview.toggleFullscreen()" title="Fullscreen">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
                
                <div class="dc-codex-file-nav-search">
                    <input type="text" 
                           placeholder="Filter files..." 
                           class="dc-codex-file-filter-input" 
                           id="dcCodexFileFilter"
                           onkeyup="dcCodexFilePreview.filterFileList(event)">
                </div>
                
                <div class="dc-codex-file-list" id="dcCodexFileList">
            `;
            
            // Sort files: folders first, then by name
            const sortedFiles = [...this.currentContext.files].sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
            
            // Add file items
            sortedFiles.forEach(f => {
                const isActive = f.path === file.path;
                const icon = this.getFileIcon(f);
                const fileSize = f.size ? this.formatFileSize(f.size) : '';
                
                sidebarContent += `
                    <div class="dc-codex-file-list-item ${isActive ? 'active' : ''}" 
                         data-file-path="${this.escapeHtml(f.path)}"
                         data-file-name="${this.escapeHtml(f.name.toLowerCase())}"
                         onclick="dcCodexFilePreview.handleFileListItemClick('${this.escapeHtml(f.path)}')">
                        <div class="dc-codex-file-list-item-icon">
                            <i class="${icon.class}" style="color: ${icon.color || '#64748b'}"></i>
                        </div>
                        <div class="dc-codex-file-list-item-details">
                            <div class="dc-codex-file-list-item-name">${this.escapeHtml(f.name)}</div>
                            ${fileSize ? `<div class="dc-codex-file-list-item-meta">${fileSize}</div>` : ''}
                        </div>
                        ${isActive ? '<div class="dc-codex-file-list-item-indicator"></div>' : ''}
                    </div>
                `;
            });
            
            sidebarContent += `
                </div>
                
                <div class="dc-codex-file-nav-footer">
                    <div class="dc-codex-font-controls">
                        <button class="dc-codex-control-btn" onclick="dcCodexFilePreview.decreaseFontSize()" title="Decrease font size">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="dc-codex-font-size-display">${this.currentFontSize}</span>
                        <button class="dc-codex-control-btn" onclick="dcCodexFilePreview.increaseFontSize()" title="Increase font size">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Fallback to file info if no context
            sidebarContent = this.getFileInfoSidebar(file, fileData);
        }
        
        sidebar.innerHTML = sidebarContent;
        
        // Scroll to active file
        this.scrollToActiveFile();
    }
    
    scrollToActiveFile() {
        setTimeout(() => {
            const activeItem = document.querySelector('.dc-codex-file-list-item.active');
            const fileList = document.getElementById('dcCodexFileList');
            
            if (activeItem && fileList) {
                const itemRect = activeItem.getBoundingClientRect();
                const listRect = fileList.getBoundingClientRect();
                
                if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 100);
    }
    
    filterFileList(event) {
        const filter = event.target.value.toLowerCase();
        const items = document.querySelectorAll('.dc-codex-file-list-item');
        
        items.forEach(item => {
            const fileName = item.dataset.fileName || '';
            if (fileName.includes(filter)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    handleFileListItemClick(filePath) {
        if (!this.currentContext || !this.currentContext.files) return;
        
        const file = this.currentContext.files.find(f => f.path === filePath);
        if (file && file.path !== this.currentFile.path) {
            this.switchToFile(file);
        }
    }
    
    getFileInfoSidebar(file, fileData) {
        const fileSize = fileData && fileData.size ? this.formatFileSize(fileData.size) : 'Unknown';
        const fileType = this.getFileExtension(file.name).toUpperCase() || 'FILE';
        const relativePath = this.getRelativePath(file.path);
        const lastModified = fileData && fileData.modified ? 
            new Date(fileData.modified).toLocaleDateString() : 'Unknown';
        
        return `
            <div class="dc-codex-file-info-section">
                <h3>File Information</h3>
                <div class="dc-codex-file-meta-grid">
                    <div class="dc-codex-file-meta-item">
                        <span class="dc-codex-file-meta-label">Name</span>
                        <span class="dc-codex-file-meta-value" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</span>
                    </div>
                    <div class="dc-codex-file-meta-item">
                        <span class="dc-codex-file-meta-label">Type</span>
                        <span class="dc-codex-file-meta-value">${fileType}</span>
                    </div>
                    <div class="dc-codex-file-meta-item">
                        <span class="dc-codex-file-meta-label">Size</span>
                        <span class="dc-codex-file-meta-value">${fileSize}</span>
                    </div>
                    <div class="dc-codex-file-meta-item">
                        <span class="dc-codex-file-meta-label">Modified</span>
                        <span class="dc-codex-file-meta-value">${lastModified}</span>
                    </div>
                    <div class="dc-codex-file-meta-item">
                        <span class="dc-codex-file-meta-label">Path</span>
                        <span class="dc-codex-file-meta-value" title="${relativePath}">${this.escapeHtml(relativePath)}</span>
                    </div>
                </div>
            </div>
            
            <div class="dc-codex-file-actions-section">
                <h3>Actions</h3>
                <div class="dc-codex-action-buttons">
                    <button class="dc-codex-action-btn" onclick="dcCodexFilePreview.copyAllContent()" title="Copy file content">
                        <i class="fas fa-clipboard"></i>
                        Copy Content
                    </button>
                    <button class="dc-codex-action-btn" onclick="dcCodexFilePreview.toggleFullscreen()" title="Toggle fullscreen">
                        <i class="fas fa-expand"></i>
                        Fullscreen
                    </button>
                </div>
            </div>
        `;
    }
    
    updateModalMainContent(file, fileData, isLoading) {
        const modal = document.getElementById(this.options.modalId);
        const mainContent = modal.querySelector('.dc-codex-modal-main');
        if (!mainContent) return;
        
        if (isLoading) {
            mainContent.innerHTML = `
                <div class="dc-codex-file-preview-loading">
                    <div class="dc-codex-loading-spinner">
                        <div class="dc-codex-spinner-ring">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                    <h3>Loading file content...</h3>
                    <p>Please wait while we fetch the file content.</p>
                </div>
            `;
            return;
        }
        
        if (fileData && fileData.error) {
            mainContent.innerHTML = `
                <div class="dc-codex-file-preview-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to load file</h3>
                    <p>${this.escapeHtml(fileData.error)}</p>
                    <button class="dc-codex-retry-btn" onclick="dcCodexFilePreview.retryCurrentFile()">
                        <i class="fas fa-refresh"></i>
                        Try Again
                    </button>
                </div>
            `;
            return;
        }
        
        if (fileData) {
            this.renderFileContent(file, fileData, mainContent);
        }
    }
    
    renderFileContent(file, fileData, container) {
        const ext = this.getFileExtension(file.name);
        
        if (fileData.type === 'image') {
            container.innerHTML = `
                <div class="dc-codex-file-content-wrapper dc-codex-image-wrapper">
                    <div class="dc-codex-image-preview">
                        <img src="${fileData.content}" alt="${this.escapeHtml(file.name)}" loading="lazy">
                    </div>
                </div>
            `;
        } else if (fileData.type === 'pdf') {
            const inlineUrl = fileData.inline_url || `${this.options.apiBase}/browse/file-inline?path=${encodeURIComponent(file.path)}`;
            container.innerHTML = `
                <div class="dc-codex-file-content-wrapper dc-codex-pdf-wrapper">
                    <div class="dc-codex-pdf-preview">
                        <iframe class="dc-codex-pdf-embed" src="${inlineUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf">
                            <div class="dc-codex-pdf-preview-info">
                                <i class="fas fa-file-pdf"></i>
                                <h3>PDF Preview</h3>
                                <p>Your browser doesn't support embedded PDFs.</p>
                            </div>
                        </iframe>
                    </div>
                </div>
            `;
        } else if (fileData.content !== undefined || fileData.type === 'text') {
            this.renderCodeContent(file, fileData, container);
        } else {
            container.innerHTML = `
                <div class="dc-codex-file-content-wrapper">
                    <div class="dc-codex-file-preview-error">
                        <i class="fas fa-file-times"></i>
                        <h3>Preview not available</h3>
                        <p>This file type cannot be displayed or the file content is not available.</p>
                    </div>
                </div>
            `;
        }
    }
    
    renderCodeContent(file, fileData, container) {
        let content = fileData.content || '';
        
        if (!content) {
            container.innerHTML = `
                <div class="dc-codex-file-content-wrapper">
                    <div class="dc-codex-file-preview-error">
                        <i class="fas fa-file-times"></i>
                        <h3>No content available</h3>
                        <p>The file appears to be empty or could not be read.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Store original content for copying
        const originalContent = content;
        
        // Format JSON and XML for better readability
        const ext = this.getFileExtension(file.name);
        if (ext === 'json') {
            try {
                const parsed = JSON.parse(content);
                content = JSON.stringify(parsed, null, 2);
            } catch (e) {
                // Keep original content if parsing fails
            }
        } else if (ext === 'xml') {
            try {
                content = this.formatXml(content);
            } catch (e) {
                // Keep original content if formatting fails
            }
        }
        
        const lines = content.split('\n');
        
        // Create HTML with line numbers as spans for precise control
        const codeWithLineNumbers = lines.map((line, index) => {
            const lineNum = index + 1;
            return `<div class="dc-codex-code-line-wrapper"><span class="dc-codex-line-number-span" data-line="${lineNum}">${lineNum}</span><span class="dc-codex-code-content-span">${this.escapeHtml(line)}</span></div>`;
        }).join('');
        
        container.innerHTML = `
            <div class="dc-codex-file-content-wrapper dc-codex-code-wrapper">
                <!-- Hidden element to store original content for copying -->
                <div id="dcCodexOriginalContent" style="display: none;" data-original-content="${this.escapeHtml(originalContent)}"></div>
                <div class="dc-codex-code-header">
                    <div class="dc-codex-code-title">
                        <i class="${this.getFileIcon(file).class}"></i>
                        <span>${this.escapeHtml(file.name)}</span>
                        <span class="dc-codex-line-count">${lines.length} lines</span>
                    </div>
                    <div class="dc-codex-code-actions">
                        <button class="dc-codex-code-action-btn" onclick="dcCodexFilePreview.copyAllContent()" title="Copy file content">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="dc-codex-code-action-btn" onclick="dcCodexFilePreview.openSearch()" title="Search in file">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                </div>
                
                <div class="dc-codex-search-bar" id="dcCodexSearchBar" style="display: none;">
                    <div class="dc-codex-search-input-group">
                        <input type="text" id="dcCodexSearchInput" placeholder="Search in file..." onkeyup="dcCodexFilePreview.searchInFile(event)">
                        <button onclick="dcCodexFilePreview.findNext()" title="Find next">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <button onclick="dcCodexFilePreview.findPrevious()" title="Find previous">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <span class="dc-codex-search-results" id="dcCodexSearchResults"></span>
                        <button onclick="dcCodexFilePreview.closeSearch()" title="Close search">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="dc-codex-code-display-container">
                    <pre class="dc-codex-code-display-robust" id="dcCodexCodeDisplay" style="font-size: ${this.currentFontSize}px;"><code id="dcCodexCodeText" class="${this.getPrismLanguage(`.${ext}`)}" data-formatted-content="${this.escapeHtml(content)}">${codeWithLineNumbers}</code></pre>
                </div>
            </div>
        `;
        
        // Apply syntax highlighting to code content only
        setTimeout(() => {
            if (window.Prism) {
                const codeSpans = container.querySelectorAll('.dc-codex-code-content-span');
                codeSpans.forEach(span => {
                    // Apply highlighting to individual code spans
                    const tempCode = document.createElement('code');
                    tempCode.className = this.getPrismLanguage(`.${ext}`);
                    tempCode.textContent = span.textContent;
                    
                    try {
                        Prism.highlightElement(tempCode);
                        span.innerHTML = tempCode.innerHTML;
                    } catch (e) {
                        // Keep original if highlighting fails
                    }
                });
            }
        }, 100);
    }
    
    // Font size management
    increaseFontSize() {
        if (this.currentFontSize < this.options.maxFontSize) {
            this.currentFontSize += 1;
            this.updateFontSize();
        }
    }
    
    decreaseFontSize() {
        if (this.currentFontSize > this.options.minFontSize) {
            this.currentFontSize -= 1;
            this.updateFontSize();
        }
    }
    
    resetFontSize() {
        this.currentFontSize = this.options.defaultFontSize;
        this.updateFontSize();
    }
    
    updateFontSize() {
        localStorage.setItem(this.options.fontSizeKey, this.currentFontSize.toString());
        
        const codeDisplay = document.getElementById('dcCodexCodeDisplay');
        const fontDisplay = document.querySelector('.dc-codex-font-size-display');
        
        if (codeDisplay) codeDisplay.style.fontSize = this.currentFontSize + 'px';
        if (fontDisplay) fontDisplay.textContent = this.currentFontSize;
    }
    
    // Search functionality
    openSearch() {
        const searchBar = document.getElementById('dcCodexSearchBar');
        const searchInput = document.getElementById('dcCodexSearchInput');
        
        if (searchBar) {
            searchBar.style.display = 'block';
            if (searchInput) {
                searchInput.focus();
            }
        }
    }
    
    closeSearch() {
        const searchBar = document.getElementById('dcCodexSearchBar');
        if (searchBar) {
            searchBar.style.display = 'none';
        }
        this.clearSearch();
    }
    
    clearSearch() {
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.searchTerm = '';
        this.updateSearchResults(0, 0);
        // Clear highlights would go here
    }
    
    searchInFile(event) {
        if (event.key === 'Enter') {
            this.findNext();
            return;
        }
        
        if (event.key === 'Escape') {
            this.closeSearch();
            return;
        }
        
        const query = event.target.value.toLowerCase();
        if (query.length < 2) {
            this.clearSearch();
            return;
        }
        
        this.performSearch(query);
    }
    
    performSearch(query) {
        const codeText = document.getElementById('dcCodexCodeText');
        if (!codeText) return;
        
        const content = codeText.textContent.toLowerCase();
        this.searchResults = [];
        this.searchTerm = query;
        this.currentSearchIndex = 0;
        
        let index = content.indexOf(query);
        while (index !== -1) {
            this.searchResults.push(index);
            index = content.indexOf(query, index + 1);
        }
        
        this.updateSearchResults(this.searchResults.length, this.currentSearchIndex + 1);
        
        if (this.searchResults.length > 0) {
            this.scrollToSearchResult(0);
        }
    }
    
    findNext() {
        if (this.searchResults.length === 0) return;
        
        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
        this.updateSearchResults(this.searchResults.length, this.currentSearchIndex + 1);
        this.scrollToSearchResult(this.currentSearchIndex);
    }
    
    findPrevious() {
        if (this.searchResults.length === 0) return;
        
        this.currentSearchIndex = this.currentSearchIndex === 0 ? this.searchResults.length - 1 : this.currentSearchIndex - 1;
        this.updateSearchResults(this.searchResults.length, this.currentSearchIndex + 1);
        this.scrollToSearchResult(this.currentSearchIndex);
    }
    
    updateSearchResults(total, current) {
        const resultsDisplay = document.getElementById('dcCodexSearchResults');
        if (resultsDisplay) {
            if (total === 0) {
                resultsDisplay.textContent = 'No results';
            } else {
                resultsDisplay.textContent = `${current} of ${total}`;
            }
        }
    }
    
    scrollToSearchResult(index) {
        // This would scroll to the specific search result
        // Implementation depends on how search highlighting is done
    }
    
    // File actions
    copyAllContent() {
        // Try to get the original content from the hidden element
        const originalContentElement = document.getElementById('dcCodexOriginalContent');
        if (originalContentElement) {
            const originalContent = originalContentElement.dataset.originalContent;
            if (originalContent) {
                const decodedContent = this.decodeHtmlEntities(originalContent);
                this.copyToClipboard(decodedContent, 'Original file content copied to clipboard');
                return;
            }
        }
        
        // Try to get the formatted content from the code element
        const codeText = document.getElementById('dcCodexCodeText');
        if (codeText) {
            const formattedContent = codeText.dataset.formattedContent;
            if (formattedContent) {
                const decodedContent = this.decodeHtmlEntities(formattedContent);
                this.copyToClipboard(decodedContent, 'Formatted file content copied to clipboard');
                return;
            }
        }
        
        // Try to extract content from code-content-span elements
        if (codeText) {
            const codeLines = codeText.querySelectorAll('.dc-codex-code-content-span');
            if (codeLines.length > 0) {
                const content = Array.from(codeLines).map(line => line.textContent || '').join('\n');
                this.copyToClipboard(content, 'File content copied to clipboard');
                return;
            }
        }
        
        // Fallback: use API call if we have the current file
        if (this.currentFile) {
            this.copyOriginalFileContent();
            return;
        }
        
        this.showToast('No content available to copy', 'error');
    }
    
    async copyOriginalFileContent() {
        if (!this.currentFile) {
            this.showToast('No file selected', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.options.apiBase}/files/content?path=${encodeURIComponent(this.currentFile.path)}`);
            if (response.ok) {
                const fileData = await response.json();
                if (fileData.content) {
                    this.copyToClipboard(fileData.content, 'Original file content copied to clipboard');
                } else {
                    this.showToast('File content is empty', 'error');
                }
            } else {
                this.showToast('Failed to fetch original file content', 'error');
            }
        } catch (error) {
            console.error('Error fetching original file content:', error);
            this.showToast('Error fetching file content', 'error');
        }
    }
    
    toggleFullscreen() {
        const modal = document.getElementById(this.options.modalId);
        if (!modal) return;
        
        modal.classList.toggle('dc-codex-fullscreen');
        
        const btns = document.querySelectorAll('[onclick="dcCodexFilePreview.toggleFullscreen()"]');
        btns.forEach(btn => {
            const icon = btn.querySelector('i');
            if (icon) {
                if (modal.classList.contains('dc-codex-fullscreen')) {
                    icon.className = 'fas fa-compress';
                    btn.title = 'Exit fullscreen';
                } else {
                    icon.className = 'fas fa-expand';
                    btn.title = 'Enter fullscreen';
                }
            }
        });
    }
    
    copyToClipboard(text, successMessage) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast(successMessage, 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(text, successMessage);
            });
        } else {
            this.fallbackCopyToClipboard(text, successMessage);
        }
    }
    
    fallbackCopyToClipboard(text, successMessage) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        
        // Preserve line breaks and whitespace
        textArea.style.whiteSpace = 'pre-wrap';
        textArea.style.wordWrap = 'break-word';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showToast(successMessage, 'success');
            } else {
                this.showToast('Failed to copy to clipboard', 'error');
            }
        } catch (err) {
            console.error('Copy failed:', err);
            this.showToast('Failed to copy to clipboard', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `dc-codex-toast dc-codex-toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    retryCurrentFile() {
        if (this.currentFile) {
            this.switchToFile(this.currentFile);
        }
    }
    
    // Utility functions
    getFileIcon(item) {
        if (item.type === 'folder') {
            return { class: 'fas fa-folder', color: '#3b82f6' };
        }
        
        const extension = item.name.split('.').pop().toLowerCase();
        
        const iconMap = {
            'py': { class: 'fab fa-python', color: '#3776ab' },
            'js': { class: 'fab fa-js-square', color: '#f7df1e' },
            'ts': { class: 'fab fa-js-square', color: '#3178c6' },
            'html': { class: 'fab fa-html5', color: '#e34f26' },
            'css': { class: 'fab fa-css3-alt', color: '#1572b6' },
            'c': { class: 'fas fa-file-code', color: '#00599c' },
            'cpp': { class: 'fas fa-file-code', color: '#00599c' },
            'h': { class: 'fas fa-file-code', color: '#00599c' },
            'java': { class: 'fab fa-java', color: '#ed8b00' },
            'cs': { class: 'fas fa-file-code', color: '#239120' },
            'php': { class: 'fab fa-php', color: '#777bb4' },
            'rb': { class: 'fas fa-gem', color: '#cc342d' },
            'go': { class: 'fas fa-file-code', color: '#00add8' },
            'rs': { class: 'fas fa-file-code', color: '#000000' },
            'swift': { class: 'fas fa-file-code', color: '#fa7343' },
            'kt': { class: 'fas fa-file-code', color: '#7f52ff' },
            'scala': { class: 'fas fa-file-code', color: '#dc322f' },
            'ino': { class: 'fas fa-microchip', color: '#00979d' },
            'json': { class: 'fas fa-file-code', color: '#000000' },
            'xml': { class: 'fas fa-file-code', color: '#e34f26' },
            'yml': { class: 'fas fa-file-code', color: '#cb171e' },
            'yaml': { class: 'fas fa-file-code', color: '#cb171e' },
            'toml': { class: 'fas fa-file-code', color: '#9c4221' },
            'ini': { class: 'fas fa-file-code', color: '#6b6b6b' },
            'conf': { class: 'fas fa-file-code', color: '#6b6b6b' },
            'pdf': { class: 'fas fa-file-pdf', color: '#dc2626' },
            'doc': { class: 'fas fa-file-word', color: '#2b579a' },
            'docx': { class: 'fas fa-file-word', color: '#2b579a' },
            'xls': { class: 'fas fa-file-excel', color: '#217346' },
            'xlsx': { class: 'fas fa-file-excel', color: '#217346' },
            'ppt': { class: 'fas fa-file-powerpoint', color: '#d24726' },
            'pptx': { class: 'fas fa-file-powerpoint', color: '#d24726' },
            'jpg': { class: 'fas fa-file-image', color: '#059669' },
            'jpeg': { class: 'fas fa-file-image', color: '#059669' },
            'png': { class: 'fas fa-file-image', color: '#059669' },
            'gif': { class: 'fas fa-file-image', color: '#059669' },
            'svg': { class: 'fas fa-file-image', color: '#059669' },
            'zip': { class: 'fas fa-file-archive', color: '#eab308' },
            'rar': { class: 'fas fa-file-archive', color: '#eab308' },
            '7z': { class: 'fas fa-file-archive', color: '#eab308' },
            'tar': { class: 'fas fa-file-archive', color: '#eab308' },
            'gz': { class: 'fas fa-file-archive', color: '#eab308' },
            'mp4': { class: 'fas fa-file-video', color: '#dc2626' },
            'avi': { class: 'fas fa-file-video', color: '#dc2626' },
            'mov': { class: 'fas fa-file-video', color: '#dc2626' },
            'mp3': { class: 'fas fa-file-audio', color: '#7c3aed' },
            'wav': { class: 'fas fa-file-audio', color: '#7c3aed' },
            'txt': { class: 'fas fa-file-alt', color: '#64748b' },
            'md': { class: 'fab fa-markdown', color: '#000000' },
            'readme': { class: 'fas fa-file-alt', color: '#64748b' },
            'log': { class: 'fas fa-file-alt', color: '#64748b' },
        };
        
        return iconMap[extension] || { class: 'fas fa-file', color: '#64748b' };
    }
    
    getFileExtension(filename) {
        const ext = filename.split('.').pop();
        return ext === filename ? '' : ext;
    }
    
    getRelativePath(fullPath) {
        // You might want to customize this based on your needs
        return fullPath;
    }
    
    getLastPathSegment(path) {
        const segments = path.split(/[/\\]/);
        return segments[segments.length - 1] || segments[segments.length - 2] || 'Folder';
    }
    
    getPrismLanguage(filetype) {
        const langMap = {
            '.py': 'language-python',
            '.pyw': 'language-python',
            '.js': 'language-javascript',
            '.jsx': 'language-javascript',
            '.ts': 'language-typescript',
            '.tsx': 'language-typescript',
            '.java': 'language-java',
            '.c': 'language-c',
            '.cpp': 'language-cpp',
            '.cxx': 'language-cpp',
            '.cc': 'language-cpp',
            '.h': 'language-c',
            '.hpp': 'language-cpp',
            '.cs': 'language-csharp',
            '.php': 'language-php',
            '.rb': 'language-ruby',
            '.go': 'language-go',
            '.rs': 'language-rust',
            '.swift': 'language-swift',
            '.kt': 'language-kotlin',
            '.scala': 'language-scala',
            '.html': 'language-html',
            '.htm': 'language-html',
            '.css': 'language-css',
            '.scss': 'language-scss',
            '.sass': 'language-scss',
            '.less': 'language-css',
            '.sql': 'language-sql',
            '.json': 'language-json',
            '.xml': 'language-xml',
            '.yaml': 'language-yaml',
            '.yml': 'language-yaml',
            '.md': 'language-markdown',
            '.markdown': 'language-markdown',
            '.ino': 'language-arduino',
            '.sh': 'language-bash',
            '.bash': 'language-bash',
            '.zsh': 'language-bash',
            '.fish': 'language-bash',
            '.ps1': 'language-powershell',
            '.bat': 'language-batch',
            '.cmd': 'language-batch',
            '.ini': 'language-ini',
            '.cfg': 'language-ini',
            '.conf': 'language-ini',
            '.toml': 'language-ini',
            '.dockerfile': 'language-docker',
            '.makefile': 'language-makefile',
            '.mk': 'language-makefile',
            '.r': 'language-r',
            '.m': 'language-matlab'
        };
        
        return langMap[filetype] || 'language-none';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    formatXml(xml) {
        const PADDING = ' '.repeat(2);
        const reg = /(>)(<)(\/*)/g;
        let formatted = xml.replace(reg, '$1\r\n$2$3');
        let pad = 0;
        
        return formatted.split('\r\n').map(line => {
            let indent = 0;
            if (line.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (line.match(/^<\/\w/) && pad > 0) {
                pad -= 1;
            } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            
            const result = PADDING.repeat(pad) + line;
            pad += indent;
            return result;
        }).join('\n');
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }
    
    decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }
}

// Create global instance and make it accessible
let dcCodexFilePreview = null;

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        dcCodexFilePreview = new DCCodexFilePreview();
    });
} else {
    // DOM already loaded
    dcCodexFilePreview = new DCCodexFilePreview();
}