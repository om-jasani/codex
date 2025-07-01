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
    // Ensure modal is hidden on startup
    const modal = document.getElementById('filePreviewModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible');
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
    // Authentication is now handled by the main navigation in browse.html
    // This function can be kept for backward compatibility but is no longer needed
}

async function loadInitialStructure() {
    // Show loading state
    showLoadingState();
    
    try {
        const response = await fetch('/api/browse/structure');
        const data = await response.json();
        
        if (data.success) {
            folderStructure = data.structure;
            currentPath = [{ name: 'Root', path: data.root_path }];
            
            // Initialize first column with root contents directly from structure
            const rootItems = data.structure || [];
            
            columns = [{
                title: 'Root Directory',
                path: data.root_path,
                items: rootItems
            }];
            
            hideLoadingState();
            renderColumns();
            updateBreadcrumb();
        } else {
            hideLoadingState();
            showError('Failed to load directory structure: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading structure:', error);
        hideLoadingState();
        showError('Failed to connect to server. Please check your connection and try again.');
    }
}

function showLoadingState() {
    const container = document.getElementById('columnNavigation');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <p>Loading repository structure...</p>
            </div>
        `;
    }
}

function hideLoadingState() {
    // Loading state will be replaced by renderColumns()
}

function showError(message) {
    const container = document.getElementById('columnNavigation');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Repository</h3>
                <p>${message}</p>
                <button onclick="loadInitialStructure()" class="btn-retry" style="
                    margin-top: 1rem;
                    padding: 0.5rem 1rem;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    font-weight: 500;
                ">
                    <i class="fas fa-refresh"></i> Try Again
                </button>
            </div>
        `;
    }
}

function renderColumns() {
    const container = document.getElementById('columnNavigation');
    
    if (!container) {
        console.error('DC Codex: columnNavigation element not found!');
        return;
    }
    
    // Store current scroll position and selection state
    const currentScrollLeft = container.scrollLeft;
    const preservedSelections = [...selectedItems]; // Preserve current selections
    
    container.innerHTML = '';
    selectedItems = []; // Will rebuild this
    
    columns.forEach((column, columnIndex) => {
        // Skip file preview columns - we'll show them in modal instead
        if (column.isFilePreview) {
            return;
        }
        
        const columnElement = createColumn(column, columnIndex);
        
        if (!columnElement) {
            console.error(`DC Codex: Failed to create column ${columnIndex}`);
            return;
        }
        
        // Add animation class for new columns
        if (columnIndex === columns.length - 1 && columns.length > 1) {
            columnElement.classList.add('column-slide-in');
        }
        
        container.appendChild(columnElement);
        selectedItems.push(null); // Initialize selection state
    });
    
    // Restore active path visual indicators after DOM is created
    setTimeout(() => {
        restoreActivePathVisuals();
    }, 10);
    
    // Auto-scroll to show the last column with smooth animation
    setTimeout(() => {
        scrollToActiveColumn();
        
        // Remove animation class after animation completes
        const newColumn = container.querySelector('.column-slide-in');
        if (newColumn) {
            setTimeout(() => {
                newColumn.classList.remove('column-slide-in');
            }, 300);
        }
    }, 50);
}

function restoreActivePathVisuals() {
    // For each path segment, find and highlight the corresponding item
    currentPath.forEach((pathItem, pathIndex) => {
        if (pathIndex === 0) return; // Skip root
        
        const columnIndex = pathIndex - 1; // Convert path index to column index
        const column = document.querySelectorAll('.column')[columnIndex];
        
        if (!column) {
            return;
        }
        
        // Find the item in this column that matches the path
        const items = column.querySelectorAll('.folder-item, .file-item');
        items.forEach(itemElement => {
            const itemName = itemElement.dataset.itemName;
            const itemPath = itemElement.dataset.itemPath;
            
            if (itemName === pathItem.name || itemPath === pathItem.path) {
                itemElement.classList.add('selected');
                
                // If this isn't the last item in path, it should have next column arrow
                if (pathIndex < currentPath.length - 1) {
                    itemElement.classList.add('has-next-column');
                }
                
                selectedItems[columnIndex] = {
                    name: itemName,
                    path: itemPath,
                    type: itemElement.dataset.itemType
                };
            }
        });
    });
}

function createColumn(columnData, columnIndex) {
    const column = document.createElement('div');
    column.className = 'column';
    column.dataset.columnIndex = columnIndex;
    
    // Column header
    const header = document.createElement('div');
    header.className = 'column-header';
    header.innerHTML = `
        <i class="fas fa-folder"></i>
        <span>${columnData.title}</span>
        <span class="item-count">(${columnData.items.length})</span>
    `;
    
    // Column content
    const content = document.createElement('div');
    content.className = 'column-content';
    
    if (columnData.items.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>Empty Directory</h3>
                <p>This folder is empty</p>
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
    itemElement.className = item.type === 'folder' ? 'folder-item' : 'file-item';
    itemElement.dataset.itemName = item.name;
    itemElement.dataset.itemPath = item.path;
    itemElement.dataset.itemType = item.type;
    
    // Determine if folder has children for arrow indicator
    const hasChildren = item.type === 'folder' && (
        (item.children && item.children.length > 0) || 
        (item.item_count && item.item_count > 0)
    );
    
    if (hasChildren) {
        itemElement.classList.add('has-children');
    }
    
    // Get file icon based on extension
    const icon = getFileIcon(item);
    
    // Calculate item count for folders
    let itemMeta = '';
    if (item.type === 'folder' && item.children) {
        const count = item.children.length;
        itemMeta = count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : 'Empty';
    } else {
        itemMeta = formatItemMeta(item);
    }
    
    itemElement.innerHTML = `
        <i class="${icon.class} ${item.type === 'folder' ? 'folder-icon' : 'file-icon'}"></i>
        <span class="item-name">${item.name}</span>
        <span class="item-meta">${itemMeta}</span>
    `;
    
    // Add click handler
    itemElement.addEventListener('click', (e) => {
        e.preventDefault();
        handleItemClick(item, columnIndex, itemElement);
    });
    
    return itemElement;
}

function getFileIcon(item) {
    if (item.type === 'folder') {
        return { class: 'fas fa-folder' };
    }
    
    const extension = item.name.split('.').pop().toLowerCase();
    
    const iconMap = {
        // Code files
        'py': { class: 'fas fa-file-code' },
        'js': { class: 'fas fa-file-code' },
        'ts': { class: 'fas fa-file-code' },
        'html': { class: 'fas fa-file-code' },
        'css': { class: 'fas fa-file-code' },
        'c': { class: 'fas fa-file-code' },
        'cpp': { class: 'fas fa-file-code' },
        'h': { class: 'fas fa-file-code' },
        'java': { class: 'fas fa-file-code' },
        'cs': { class: 'fas fa-file-code' },
        'php': { class: 'fas fa-file-code' },
        'rb': { class: 'fas fa-file-code' },
        'go': { class: 'fas fa-file-code' },
        'rs': { class: 'fas fa-file-code' },
        'swift': { class: 'fas fa-file-code' },
        'kt': { class: 'fas fa-file-code' },
        'scala': { class: 'fas fa-file-code' },
        'ino': { class: 'fas fa-file-code' },
        
        // Config files
        'json': { class: 'fas fa-file-code' },
        'xml': { class: 'fas fa-file-code' },
        'yml': { class: 'fas fa-file-code' },
        'yaml': { class: 'fas fa-file-code' },
        'toml': { class: 'fas fa-file-code' },
        'ini': { class: 'fas fa-file-code' },
        'conf': { class: 'fas fa-file-code' },
        
        // Documents
        'pdf': { class: 'fas fa-file-pdf' },
        'doc': { class: 'fas fa-file-word' },
        'docx': { class: 'fas fa-file-word' },
        'xls': { class: 'fas fa-file-excel' },
        'xlsx': { class: 'fas fa-file-excel' },
        'ppt': { class: 'fas fa-file-powerpoint' },
        'pptx': { class: 'fas fa-file-powerpoint' },
        
        // Images
        'jpg': { class: 'fas fa-file-image' },
        'jpeg': { class: 'fas fa-file-image' },
        'png': { class: 'fas fa-file-image' },
        'gif': { class: 'fas fa-file-image' },
        'svg': { class: 'fas fa-file-image' },
        'bmp': { class: 'fas fa-file-image' },
        'ico': { class: 'fas fa-file-image' },
        
        // Archives
        'zip': { class: 'fas fa-file-archive' },
        'rar': { class: 'fas fa-file-archive' },
        '7z': { class: 'fas fa-file-archive' },
        'tar': { class: 'fas fa-file-archive' },
        'gz': { class: 'fas fa-file-archive' },
        
        // Media
        'mp4': { class: 'fas fa-file-video' },
        'avi': { class: 'fas fa-file-video' },
        'mov': { class: 'fas fa-file-video' },
        'wmv': { class: 'fas fa-file-video' },
        'mp3': { class: 'fas fa-file-audio' },
        'wav': { class: 'fas fa-file-audio' },
        'flac': { class: 'fas fa-file-audio' },
        
        // Text files
        'txt': { class: 'fas fa-file-alt' },
        'md': { class: 'fas fa-file-alt' },
        'readme': { class: 'fas fa-file-alt' },
        'log': { class: 'fas fa-file-alt' },
    };
    
    return iconMap[extension] || { class: 'fas fa-file' };
}

function formatItemMeta(item) {
    if (item.type === 'folder') {
        // Check for children array first, then fallback to item_count
        const childCount = item.children ? item.children.length : (item.item_count || 0);
        return childCount > 0 ? `${childCount} items` : 'Empty';
    }
    
    // For files, show file size if available
    if (item.size) {
        return formatFileSize(item.size);
    }
    
    return '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function handleItemClick(item, columnIndex, itemElement) {
    // Remove ALL selection and arrow indicators from all items in all columns
    document.querySelectorAll('.file-item, .folder-item').forEach(el => {
        el.classList.remove('selected', 'has-next-column');
    });
    
    // Select clicked item
    itemElement.classList.add('selected');
    selectedItems[columnIndex] = item;
    
    // Remove all columns after the current one from DOM
    const container = document.getElementById('columnNavigation');
    const allColumns = container.querySelectorAll('.column');
    for (let i = allColumns.length - 1; i > columnIndex; i--) {
        allColumns[i].remove();
    }
    
    // Remove all columns after the current one from data
    columns = columns.slice(0, columnIndex + 1);
    currentPath = currentPath.slice(0, columnIndex + 1);
    
    if (item.type === 'folder') {
        // Add arrow indicator immediately
        itemElement.classList.add('has-next-column');
        
        // For deep navigation (beyond initial structure), load fresh data from API
        const shouldLoadFresh = columnIndex > 2 || !item.children || item.children.length === 0;
        
        let newColumnData;
        
        if (shouldLoadFresh) {
            try {
                const response = await fetch(`/api/browse/folder?path=${encodeURIComponent(item.path)}`);
                const data = await response.json();
                
                if (data.success && data.contents) {
                    newColumnData = {
                        title: item.name,
                        path: item.path,
                        items: data.contents
                    };
                } else {
                    newColumnData = {
                        title: item.name,
                        path: item.path,
                        items: []
                    };
                }
            } catch (error) {
                console.error('DC Codex: Error loading folder contents:', error);
                newColumnData = {
                    title: item.name,
                    path: item.path,
                    items: []
                };
            }
        } else {
            // Use existing children data for fast navigation
            newColumnData = {
                title: item.name,
                path: item.path,
                items: item.children || []
            };
        }
        
        // Add new column to data
        columns.push(newColumnData);
        currentPath.push({ name: item.name, path: item.path });
        
        // Create and add the new column to DOM
        const newColumnElement = createColumn(newColumnData, columnIndex + 1);
        newColumnElement.classList.add('column-slide-in');
        container.appendChild(newColumnElement);
        
        // Update breadcrumb
        updateBreadcrumb();
        
        // Scroll to show the new column
        setTimeout(() => {
            scrollToActiveColumn();
            
            // Remove animation class after animation completes
            setTimeout(() => {
                newColumnElement.classList.remove('column-slide-in');
            }, 300);
        }, 100);
        
    } else {
        // Show file preview in modal
        await showFilePreview(item);
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
                <span class="file-meta-value" title="${relativePath}">${relativePath}</span>
            </div>
        `;
        
        // Show file content based on type
        renderFileContent(file, fileData, fileBody);
    }
    
    // Show modal with smooth animation
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });
}

function renderFileContent(file, fileData, container) {
    const ext = getFileExtension(file.name);
    const mime = fileData.mime_type || '';
    
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
        const inlineUrl = fileData.inline_url || `/api/browse/file-inline?path=${encodeURIComponent(file.path)}`;
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="pdf-preview">
                    <iframe class="pdf-embed" src="${inlineUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf" style="width: 100%; height: 100%; border: none;">
                        <div class="pdf-preview-info">
                            <i class="fas fa-file-pdf"></i>
                            <h3>PDF Preview</h3>
                            <p>Your browser doesn't support embedded PDFs.</p>
                        </div>
                    </iframe>
                </div>
            </div>
        `;
    } else if (fileData.content !== undefined || fileData.type === 'text') {
        // Text files (including code, JSON, XML, HTML, etc.)
        let content = fileData.content || '';
        
        if (!content) {
            container.innerHTML = `
                <div class="file-content-wrapper">
                    <div class="file-error">
                        <i class="fas fa-file-times"></i>
                        <p>No content available</p>
                        <small>The file appears to be empty or could not be read.</small>
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
            }
        } else if (ext === 'xml') {
            try {
                // Basic XML formatting (simple indentation)
                content = content.replace(/></g, '>\n<');
            } catch (e) {
                // Keep original content if formatting fails
            }
        }
        
        // Ensure content is fully displayed
        const lines = content.split('\n');
        const lineNumbers = lines.map((_, i) => (i + 1).toString().padStart(4, ' ')).join('\n');
        
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="code-container">
                    <pre class="code-preview"><code id="file-code-content">${escapeHtml(content)}</code></pre>
                </div>
            </div>
        `;
        
        // Apply syntax highlighting
        setTimeout(() => {
            if (window.Prism) {
                const codeElement = container.querySelector('#file-code-content');
                if (codeElement) {
                    const language = getPrismLanguage(`.${ext}`);
                    codeElement.className = language;
                    try {
                        Prism.highlightElement(codeElement);
                    } catch (e) {
                        // Syntax highlighting failed, continue without it
                    }
                }
            }
            
            // Re-run Prism highlighting if available
            if (window.Prism) {
                Prism.highlightAll();
            }
        }, 150);
    } else {
        // Fallback for unknown file types
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="file-error">
                    <i class="fas fa-file-times"></i>
                    <p>Unable to preview this file</p>
                    <small>This file type cannot be displayed or the file content is not available.</small>
                </div>
            </div>
        `;
    }
}

function generateLineNumbers(content) {
    const lines = content.split('\n');
    return lines.map((_, i) => (i + 1).toString().padStart(4, ' ')).join('\n');
}

function closeFilePreviewModal() {
    const modal = document.getElementById('filePreviewModal');
    if (modal && modal.classList.contains('visible')) {
        // Start closing animation
        modal.classList.remove('visible');
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore background scrolling
        }, 300); // Match CSS transition duration
    }
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

function getPrismLanguage(filetype) {
    const langMap = {
        '.py': 'language-python',
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
        '.ps1': 'language-powershell',
        '.bat': 'language-batch',
        '.cmd': 'language-batch'
    };
    
    return langMap[filetype] || 'language-none';
}

function getLanguageFromExtension(ext) {
    const languageMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'pyw': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cxx': 'cpp',
        'cc': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'ps1': 'powershell',
        'bat': 'batch',
        'cmd': 'batch',
        'sql': 'sql',
        'json': 'json',
        'xml': 'xml',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'scss',
        'less': 'css',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'markdown': 'markdown',
        'ino': 'arduino',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
        'toml': 'ini',
        'r': 'r',
        'm': 'matlab',
        'dockerfile': 'docker',
        'makefile': 'makefile',
        'mk': 'makefile'
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
    // Remove columns after the selected level from DOM
    const container = document.getElementById('columnNavigation');
    const allColumns = container.querySelectorAll('.column');
    for (let i = allColumns.length - 1; i > index; i--) {
        allColumns[i].remove();
    }
    
    // Truncate path and columns to the selected level
    currentPath = currentPath.slice(0, index + 1);
    columns = columns.slice(0, index + 1);
    selectedItems = selectedItems.slice(0, index + 1);
    
    // Clear all selections first
    document.querySelectorAll('.file-item, .folder-item').forEach(el => {
        el.classList.remove('selected', 'has-next-column');
    });
    
    // Restore visual state for the active path
    setTimeout(() => {
        restoreActivePathVisuals();
        updateBreadcrumb();
    }, 10);
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
