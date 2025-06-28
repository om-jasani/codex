/**
 * DC Codex - Column Navigation Browser JavaScript
 * macOS Finder-like column navigation interface
 */

// Global state
let folderStructure = null;
let currentPath = [];  // Array of path segments for breadcrumb
let columns = [];      // Array of column data
let selectedItems = []; // Array of selected items per column
let maxVisibleColumns = 5; // Maximum columns to show before scrolling

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DC Codex: DOM loaded, initializing browser...');
    
    // Ensure modal is hidden on startup
    const modal = document.getElementById('filePreviewModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible');
        console.log('DC Codex: Modal hidden on startup');
    }
    
    initializeBrowser();
    loadInitialStructure();
    setupModalHandlers();
});

function initializeBrowser() {
    // Set up authentication check
    checkAuthStatus();
    
    // Calculate max visible columns based on screen width
    updateMaxVisibleColumns();
    window.addEventListener('resize', updateMaxVisibleColumns);
}

function updateMaxVisibleColumns() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) {
        maxVisibleColumns = 2;
    } else if (screenWidth < 1200) {
        maxVisibleColumns = 3;
    } else if (screenWidth < 1600) {
        maxVisibleColumns = 4;
    } else {
        maxVisibleColumns = 5;
    }
}

function setupModalHandlers() {
    const modal = document.getElementById('filePreviewModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    // Close modal handlers
    closeBtn.addEventListener('click', closeFilePreviewModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeFilePreviewModal();
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            closeFilePreviewModal();
        }
    });
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        const authStatus = document.getElementById('authStatus');
        const authStatusText = document.getElementById('authStatusText');
        
        if (data.authenticated) {
            authStatusText.textContent = `${data.user.username} (${data.user.role})`;
            authStatus.style.background = 'var(--primary-color)';
            authStatus.style.color = 'white';
        } else {
            authStatusText.textContent = 'Guest User';
            authStatus.style.background = 'var(--background-color)';
            authStatus.style.color = 'var(--text-secondary)';
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        document.getElementById('authStatusText').textContent = 'Offline';
    }
}

async function loadInitialStructure() {
    console.log('DC Codex: Loading initial structure...');
    try {
        const response = await fetch('/api/browse/structure');
        const data = await response.json();
        
        console.log('DC Codex: API response:', data);
        
        if (data.success) {
            folderStructure = data.structure;
            currentPath = [{ name: 'Root', path: data.root_path }];
            
            // Initialize first column with root contents
            columns = [{
                title: 'Root Directory',
                path: data.root_path,
                items: data.structure || []
            }];
            
            console.log('DC Codex: Initialized columns:', columns);
            
            renderColumns();
            updateBreadcrumb();
        } else {
            showError('Failed to load directory structure: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading structure:', error);
        showError('Failed to connect to server');
    }
}

function renderColumns() {
    console.log('DC Codex: Rendering columns...');
    const container = document.getElementById('columnNavigation');
    
    if (!container) {
        console.error('DC Codex: columnNavigation element not found!');
        return;
    }
    
    container.innerHTML = '';
    selectedItems = [];
    
    console.log('DC Codex: Columns to render:', columns.length);
    
    columns.forEach((column, columnIndex) => {
        // Skip file preview columns - we'll show them in modal instead
        if (column.isFilePreview) {
            return;
        }
        
        console.log(`DC Codex: Creating column ${columnIndex}:`, column);
        const columnElement = createColumn(column, columnIndex);
        container.appendChild(columnElement);
        selectedItems.push(null); // Initialize selection state
    });
    
    // Auto-scroll to show the last column with smooth animation
    setTimeout(() => {
        scrollToActiveColumn();
    }, 100);
}

function createColumn(columnData, columnIndex) {
    const column = document.createElement('div');
    column.className = 'navigation-column';
    column.dataset.columnIndex = columnIndex;
    
    // Column header
    const header = document.createElement('div');
    header.className = 'column-header';
    header.innerHTML = `
        <h3 class="column-title">${columnData.title}</h3>
        <p class="column-path">${getRelativePath(columnData.path)}</p>
        <p class="column-stats">${columnData.items.length} items</p>
    `;
    
    // Column content
    const content = document.createElement('div');
    content.className = 'column-content';
    
    if (columnData.items.length === 0) {
        content.innerHTML = `
            <div class="column-empty">
                <i class="fas fa-folder-open"></i>
                <p>Empty folder</p>
            </div>
        `;
    } else {
        // Sort items (folders first, then files)
        const sortedItems = [...columnData.items].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        sortedItems.forEach(item => {
            const itemElement = createColumnItem(item, columnIndex);
            content.appendChild(itemElement);
        });
    }
    
    column.appendChild(header);
    column.appendChild(content);
    
    return column;
}

function createColumnItem(item, columnIndex) {
    const itemElement = document.createElement('div');
    itemElement.className = `column-item ${item.type}`;
    itemElement.dataset.itemPath = item.path;
    itemElement.dataset.itemName = item.name;
    itemElement.dataset.itemType = item.type;
    
    const icon = getItemIcon(item);
    const fileExtension = item.type === 'file' ? getFileExtension(item.name) : '';
    
    itemElement.innerHTML = `
        <i class="item-icon ${icon}"></i>
        <div class="item-details">
            <div class="item-name">${item.name}</div>
            <div class="item-info">${getItemInfo(item)}</div>
        </div>
        ${item.type === 'file' && fileExtension ? `<span class="file-type-badge">${fileExtension}</span>` : ''}
    `;
    
    // Add click handler
    itemElement.addEventListener('click', () => handleItemClick(item, columnIndex, itemElement));
    
    return itemElement;
}

async function handleItemClick(item, columnIndex, itemElement) {
    // Remove selection from all items in this column
    const columnElement = itemElement.closest('.navigation-column');
    columnElement.querySelectorAll('.column-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Select clicked item
    itemElement.classList.add('selected');
    selectedItems[columnIndex] = item;
    
    // Remove all columns after the current one
    columns = columns.slice(0, columnIndex + 1);
    currentPath = currentPath.slice(0, columnIndex + 1);
    
    if (item.type === 'folder') {
        // Load folder contents
        await loadFolderContents(item, columnIndex);
        renderColumns();
        updateBreadcrumb();
    } else {
        // Show file preview in modal
        await showFilePreview(item, columnIndex);
    }
}

async function loadFolderContents(folder, columnIndex) {
    try {
        const response = await fetch(`/api/browse/folder?path=${encodeURIComponent(folder.path)}`);
        const data = await response.json();
        
        if (data.success) {
            // Add new column
            columns.push({
                title: folder.name,
                path: folder.path,
                items: data.contents || []
            });
            
            // Update current path
            currentPath.push({ name: folder.name, path: folder.path });
        } else {
            showError('Failed to load folder: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading folder:', error);
        showError('Failed to load folder contents');
    }
}

async function showFilePreview(file, columnIndex) {
    try {
        // Show loading in modal
        showFilePreviewModal(file, null, true);
        
        const response = await fetch(`/api/browse/file?path=${encodeURIComponent(file.path)}`);
        const data = await response.json();
        
        console.log('File response:', data); // Debug log
        
        if (data.success) {
            // Show file content in modal
            showFilePreviewModal(file, data, false);
        } else {
            showFilePreviewModal(file, { error: data.error || 'Failed to load file' }, false);
        }
    } catch (error) {
        console.error('Error loading file:', error);
        showFilePreviewModal(file, { error: 'Failed to connect to server' }, false);
    }
}

function showFilePreviewModal(file, fileData, isLoading = false) {
    const modal = document.getElementById('filePreviewModal');
    const fileName = document.getElementById('modalFileName');
    const fileIcon = document.getElementById('modalFileIcon');
    const fileMeta = document.getElementById('modalFileMeta');
    const fileBody = document.getElementById('modalFileBody');
    
    if (!modal || !fileName || !fileIcon || !fileMeta || !fileBody) {
        console.error('Modal elements not found');
        return;
    }
    
    // Set file name and icon
    fileName.textContent = file.name;
    fileIcon.className = `file-icon ${getItemIcon(file)}`;
    
    if (isLoading) {
        // Show loading state
        fileMeta.innerHTML = '';
        fileBody.innerHTML = `
            <div class="file-preview-loading">
                <div class="spinner"></div>
                <span>Loading file content...</span>
            </div>
        `;
    } else if (fileData && fileData.error) {
        // Show error state
        fileMeta.innerHTML = '';
        fileBody.innerHTML = `
            <div class="file-preview-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to load file</h3>
                <p>${fileData.error}</p>
            </div>
        `;
    } else if (fileData) {
        // Show file metadata
        const fileSize = formatFileSize(fileData.size || 0);
        const fileType = getFileExtension(file.name).toUpperCase() || 'FILE';
        const relativePath = getRelativePath(file.path);
        
        fileMeta.innerHTML = `
            <div class="file-meta-item">
                <span class="file-meta-label">File Type</span>
                <span class="file-meta-value">${fileType}</span>
            </div>
            <div class="file-meta-item">
                <span class="file-meta-label">File Size</span>
                <span class="file-meta-value">${fileSize}</span>
            </div>
            <div class="file-meta-item">
                <span class="file-meta-label">Last Modified</span>
                <span class="file-meta-value">${fileData.modified ? new Date(fileData.modified).toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div class="file-meta-item">
                <span class="file-meta-label">File Path</span>
                <span class="file-meta-value">${relativePath}</span>
            </div>
        `;
        
        // Show file content based on type
        renderFileContent(file, fileData, fileBody);
    }
    
    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function renderFileContent(file, fileData, container) {
    const ext = getFileExtension(file.name);
    const mime = fileData.mime_type || '';
    
    console.log('Rendering file:', file.name, 'Type:', fileData.type, 'Extension:', ext, 'MIME:', mime);
    
    if (fileData.type === 'image') {
        // Image files
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="image-preview">
                    <img src="${fileData.content}" alt="${file.name}" loading="lazy">
                </div>
            </div>
        `;
    } else if (fileData.type === 'pdf') {
        // PDF files with embedded viewer
        const downloadUrl = fileData.download_url || `/api/browse/file-download?path=${encodeURIComponent(file.path)}`;
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="pdf-preview">
                    <iframe class="pdf-embed" src="${downloadUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf" style="width: 100%; height: 100%; border: none;">
                        <div class="pdf-preview-info">
                            <i class="fas fa-file-pdf"></i>
                            <h3>PDF Preview</h3>
                            <p>Your browser doesn't support embedded PDFs.</p>
                        </div>
                    </iframe>
                </div>
            </div>
        `;
    } else if (ext === 'html' || ext === 'htm') {
        // HTML files with preview and code view
        const content = fileData.content || '';
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="html-preview">
                    <div class="html-preview-tabs">
                        <button class="html-preview-tab active" onclick="showHtmlTab(this, 'preview')">Preview</button>
                        <button class="html-preview-tab" onclick="showHtmlTab(this, 'source')">Source</button>
                    </div>
                    <div class="html-preview-content" style="flex: 1; overflow: hidden;">
                        <div id="html-preview-panel" class="html-preview-panel" style="height: 100%;">
                            <iframe class="html-preview-iframe" srcdoc="${escapeHtml(content)}" sandbox="allow-same-origin allow-scripts" style="width: 100%; height: 100%; border: none;"></iframe>
                        </div>
                        <div id="html-source-panel" class="html-preview-panel" style="display: none; height: 100%;">
                            <div class="file-content-with-lines" style="height: 100%;">
                                <pre class="line-numbers">${generateLineNumbers(content)}</pre>
                                <div class="file-content-scrollable">
                                    <pre class="file-content-code"><code class="language-html">${escapeHtml(content)}</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Apply syntax highlighting to source panel
        setTimeout(() => {
            if (window.Prism) {
                const codeElement = container.querySelector('#html-source-panel code');
                if (codeElement) {
                    Prism.highlightElement(codeElement);
                }
            }
        }, 100);
    } else if (mime.startsWith('video/')) {
        // Video files
        const downloadUrl = fileData.download_url || `/api/browse/file-download?path=${encodeURIComponent(file.path)}`;
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="video-preview">
                    <video controls style="max-width: 100%; max-height: 100%;">
                        <source src="${downloadUrl}" type="${mime}">
                        Your browser doesn't support video playback.
                    </video>
                </div>
            </div>
        `;
    } else if (mime.startsWith('audio/')) {
        // Audio files
        const downloadUrl = fileData.download_url || `/api/browse/file-download?path=${encodeURIComponent(file.path)}`;
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="audio-preview">
                    <i class="fas fa-music"></i>
                    <h3>${file.name}</h3>
                    <audio controls style="width: 100%; max-width: 400px;">
                        <source src="${downloadUrl}" type="${mime}">
                        Your browser doesn't support audio playback.
                    </audio>
                </div>
            </div>
        `;
    } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
        // Archive files
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="archive-preview-info">
                    <i class="fas fa-file-archive"></i>
                    <h3>Archive File</h3>
                    <p>This is a compressed archive file.</p>
                </div>
            </div>
        `;
    } else if (fileData.type === 'binary') {
        // Binary files
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="binary-preview-info">
                    <i class="fas fa-file"></i>
                    <h3>Binary File</h3>
                    <p>This file cannot be previewed as text.</p>
                </div>
            </div>
        `;
    } else if (fileData.content !== undefined || fileData.type === 'text') {
        // Text files (including code, JSON, XML, etc.)
        let content = fileData.content || '';
        
        if (!content) {
            container.innerHTML = `
                <div class="file-content-wrapper">
                    <div class="file-preview-error">
                        <i class="fas fa-file-times"></i>
                        <h3>No content available</h3>
                        <p>The file appears to be empty or could not be read.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Format JSON and XML for better readability
        if (ext === 'json') {
            try {
                const parsed = JSON.parse(content);
                content = JSON.stringify(parsed, null, 2);
            } catch (e) {
                // Keep original content if parsing fails
                console.log('JSON parsing failed:', e.message);
            }
        } else if (ext === 'xml') {
            try {
                // Basic XML formatting (simple indentation)
                content = content.replace(/></g, '>\n<');
            } catch (e) {
                // Keep original content if formatting fails
                console.log('XML formatting failed:', e.message);
            }
        }
        
        console.log('Rendering text content, length:', content.length, 'lines:', content.split('\n').length);
        
        // Ensure content is fully displayed
        const lines = content.split('\n');
        const lineNumbers = lines.map((_, i) => (i + 1).toString()).join('\n');
        
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="file-content-with-lines">
                    <pre class="line-numbers">${lineNumbers}</pre>
                    <div class="file-content-scrollable">
                        <pre class="file-content-code"><code id="file-code-content">${escapeHtml(content)}</code></pre>
                    </div>
                </div>
            </div>
        `;
        
        // Apply syntax highlighting
        setTimeout(() => {
            if (window.Prism) {
                const codeElement = container.querySelector('#file-code-content');
                if (codeElement) {
                    const language = getLanguageFromExtension(ext);
                    if (language) {
                        codeElement.className = `language-${language}`;
                        console.log('Applied syntax highlighting for language:', language);
                    }
                    try {
                        Prism.highlightElement(codeElement);
                        console.log('Prism highlighting applied successfully');
                    } catch (e) {
                        console.log('Prism highlighting failed:', e.message);
                    }
                }
            } else {
                console.log('Prism not available for syntax highlighting');
            }
            
            // Ensure content is fully displayed by checking the rendered dimensions
            const contentElement = container.querySelector('.file-content-code');
            if (contentElement) {
                console.log('Content rendered dimensions:', {
                    scrollHeight: contentElement.scrollHeight,
                    clientHeight: contentElement.clientHeight,
                    scrollWidth: contentElement.scrollWidth,
                    clientWidth: contentElement.clientWidth
                });
            }
        }, 150);
    } else {
        // Fallback for unknown file types
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="file-preview-error">
                    <i class="fas fa-file-times"></i>
                    <h3>Unable to preview this file</h3>
                    <p>This file type cannot be displayed or the file content is not available.</p>
                </div>
            </div>
        `;
    }
}

function generateLineNumbers(content) {
    const lines = content.split('\n');
    return lines.map((_, i) => (i + 1).toString().padStart(4, ' ')).join('\n');
}

// Helper function for HTML tab switching
window.showHtmlTab = function(tabElement, panel) {
    // Remove active class from all tabs
    document.querySelectorAll('.html-preview-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active class to clicked tab
    tabElement.classList.add('active');
    
    // Hide all panels
    document.querySelectorAll('.html-preview-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // Show selected panel
    if (panel === 'preview') {
        document.getElementById('html-preview-panel').style.display = 'block';
    } else if (panel === 'source') {
        document.getElementById('html-source-panel').style.display = 'block';
    }
};

function closeFilePreviewModal() {
    const modal = document.getElementById('filePreviewModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Reset any fullscreen or font size changes
    modal.style.padding = '20px';
    if (modalContent) {
        modalContent.style.width = '95vw';
        modalContent.style.height = '90vh';
        modalContent.style.borderRadius = '12px';
    }
    
    // Reset font sizes
    const codeElement = modal.querySelector('.file-content-code');
    const lineNumbers = modal.querySelector('.line-numbers');
    if (codeElement) {
        codeElement.style.fontSize = '13px';
    }
    if (lineNumbers) {
        lineNumbers.style.fontSize = '13px';
    }
    
    modal.classList.remove('visible');
    
    // Use setTimeout to allow CSS transition to complete
    setTimeout(() => {
        if (!modal.classList.contains('visible')) {
            modal.style.display = 'none';
        }
    }, 300); // Match the CSS transition duration
    
    document.body.style.overflow = ''; // Restore background scrolling
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function getLanguageFromExtension(ext) {
    const languageMap = {
        'js': 'javascript',
        'jsx': 'javascript', 
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'c': 'c',
        'cpp': 'cpp',
        'cxx': 'cpp',
        'cc': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'hxx': 'cpp',
        'java': 'java',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'r': 'r',
        'matlab': 'matlab',
        'm': 'matlab',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'bat': 'batch',
        'cmd': 'batch',
        'ps1': 'powershell',
        'sql': 'sql',
        'json': 'json',
        'xml': 'xml',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
        'md': 'markdown',
        'markdown': 'markdown',
        'tex': 'latex',
        'vim': 'vim',
        'asm': 'assembly',
        'nasm': 'assembly',
        'dockerfile': 'dockerfile',
        'makefile': 'makefile',
        'make': 'makefile',
        'gradle': 'gradle',
        'properties': 'properties',
        'gitignore': 'gitignore',
        'log': 'log',
        'csv': 'csv',
        'tsv': 'csv',
        'ino': 'arduino'
    };
    return languageMap[ext.toLowerCase()] || null;
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    currentPath.forEach((pathItem, index) => {
        // Add separator
        if (index > 0) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);
        }
        
        // Add breadcrumb item
        const item = document.createElement('div');
        item.className = 'breadcrumb-item';
        
        if (index < currentPath.length - 1) {
            item.classList.add('clickable');
            item.addEventListener('click', () => navigateToBreadcrumbItem(index));
        }
        
        item.innerHTML = `
            <i class="fas ${index === 0 ? 'fa-home' : (index === currentPath.length - 1 && currentPath[index].name.includes('.') ? 'fa-file' : 'fa-folder')}"></i>
            <span>${pathItem.name}</span>
        `;
        
        breadcrumb.appendChild(item);
    });
}

function navigateToBreadcrumbItem(index) {
    // Truncate path and columns to the selected level
    currentPath = currentPath.slice(0, index + 1);
    columns = columns.slice(0, index + 1);
    selectedItems = selectedItems.slice(0, index + 1);
    
    renderColumns();
    updateBreadcrumb();
}

function getItemIcon(item) {
    if (item.type === 'folder') {
        return 'fas fa-folder';
    }
    
    const ext = getFileExtension(item.name).toLowerCase();
    const iconMap = {
        'c': 'fab fa-copyright',
        'cpp': 'fab fa-cuttlefish',
        'h': 'fas fa-file-code',
        'py': 'fab fa-python',
        'js': 'fab fa-js-square',
        'html': 'fab fa-html5',
        'css': 'fab fa-css3-alt',
        'java': 'fab fa-java',
        'cs': 'fas fa-code',
        'php': 'fab fa-php',
        'txt': 'fas fa-file-alt',
        'md': 'fab fa-markdown',
        'json': 'fas fa-file-code',
        'xml': 'fas fa-file-code',
        'pdf': 'fas fa-file-pdf',
        'png': 'fas fa-file-image',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'svg': 'fas fa-file-image',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        '7z': 'fas fa-file-archive',
        'cmd': 'fas fa-terminal',
        'bat': 'fas fa-terminal',
        'ps1': 'fas fa-terminal',
        'sh': 'fas fa-terminal'
    };
    
    return iconMap[ext] || 'fas fa-file';
}

function getFileExtension(filename) {
    const ext = filename.split('.').pop();
    return ext === filename ? '' : ext;
}

function getItemInfo(item) {
    if (item.type === 'folder') {
        // Check if we have children data from the backend
        if (item.children && Array.isArray(item.children)) {
            const count = item.children.length;
            return count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : 'Empty folder';
        }
        return 'Folder';
    } else {
        return formatFileSize(item.size || 0);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getRelativePath(fullPath) {
    if (!folderStructure || !fullPath) return fullPath;
    
    // Get the root path from the initial structure load
    const rootPath = currentPath[0]?.path || '';
    if (fullPath.startsWith(rootPath)) {
        const relative = fullPath.substring(rootPath.length);
        return relative.startsWith('/') || relative.startsWith('\\') ? relative.substring(1) : relative;
    }
    return fullPath;
}

function showError(message) {
    console.error(message);
    // You could implement a toast notification or modal here
    alert(message);
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('filePreviewModal');
    
    if (modal.classList.contains('visible')) {
        // Modal is open - handle modal-specific shortcuts
        if (e.key === 'Escape') {
            e.preventDefault();
            closeFilePreviewModal();
        } else if (e.key === 'F11') {
            e.preventDefault();
            // Toggle fullscreen mode for modal
            if (modal.style.padding === '0px') {
                modal.style.padding = '20px';
                const content = modal.querySelector('.modal-content');
                content.style.width = '95vw';
                content.style.height = '90vh';
                content.style.borderRadius = '12px';
            } else {
                modal.style.padding = '0px';
                const content = modal.querySelector('.modal-content');
                content.style.width = '100vw';
                content.style.height = '100vh';
                content.style.borderRadius = '0px';
            }
        } else if (e.ctrlKey && e.key === '+') {
            e.preventDefault();
            // Increase font size
            const codeElement = modal.querySelector('.file-content-code');
            if (codeElement) {
                const currentSize = parseInt(window.getComputedStyle(codeElement).fontSize);
                codeElement.style.fontSize = (currentSize + 1) + 'px';
                // Also update line numbers
                const lineNumbers = modal.querySelector('.line-numbers');
                if (lineNumbers) {
                    lineNumbers.style.fontSize = (currentSize + 1) + 'px';
                }
            }
        } else if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            // Decrease font size
            const codeElement = modal.querySelector('.file-content-code');
            if (codeElement) {
                const currentSize = parseInt(window.getComputedStyle(codeElement).fontSize);
                if (currentSize > 10) {
                    codeElement.style.fontSize = (currentSize - 1) + 'px';
                    // Also update line numbers
                    const lineNumbers = modal.querySelector('.line-numbers');
                    if (lineNumbers) {
                        lineNumbers.style.fontSize = (currentSize - 1) + 'px';
                    }
                }
            }
        } else if (e.ctrlKey && e.key === '0') {
            e.preventDefault();
            // Reset font size
            const codeElement = modal.querySelector('.file-content-code');
            const lineNumbers = modal.querySelector('.line-numbers');
            if (codeElement) {
                codeElement.style.fontSize = '13px';
            }
            if (lineNumbers) {
                lineNumbers.style.fontSize = '13px';
            }
        }
    } else {
        // Column navigation shortcuts
        if (e.key === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            navigateBackOneLevel();
        } else if (e.key === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            // Focus on the rightmost column
            const columns = document.querySelectorAll('.navigation-column');
            if (columns.length > 0) {
                const lastColumn = columns[columns.length - 1];
                const firstItem = lastColumn.querySelector('.column-item');
                if (firstItem) {
                    firstItem.focus();
                }
            }
        } else if (e.key === 'Enter' && e.target.classList.contains('column-item')) {
            e.preventDefault();
            e.target.click();
        }
    }
});

function navigateBackOneLevel() {
    if (currentPath.length > 1) {
        navigateToBreadcrumbItem(currentPath.length - 2);
    }
}

// Add smooth scrolling behavior for columns
function scrollToActiveColumn() {
    const container = document.getElementById('columnNavigation');
    const activeColumns = container.querySelectorAll('.navigation-column');
    
    if (activeColumns.length > 0) {
        // Always scroll to show the rightmost column
        setTimeout(() => {
            container.scrollLeft = container.scrollWidth - container.clientWidth;
        }, 50);
    }
}
