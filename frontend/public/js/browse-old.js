/**
 * DC Codex - Repository Browser JavaScript
 * Beautiful, interactive file system browser
 */

// Global state
let currentPath = '';
let currentViewMode = 'grid';
let folderStructure = null;
let currentSelection = null;
let contextMenuTarget = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeBrowser();
    loadFolderStructure();
    setupEventListeners();
});

function initializeBrowser() {
    // Set initial view mode
    setViewMode('grid');
    
    // Set up authentication check
    checkAuthStatus();
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('locationSearchInput');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchInLocation();
        }
    });
    
    // Hide context menu on click outside
    document.addEventListener('click', function(e) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // Prevent context menu on right click for custom handling
    document.addEventListener('contextmenu', function(e) {
        if (e.target.closest('.content-item')) {
            e.preventDefault();
        }
    });
}

function checkAuthStatus() {
    fetch('/api/auth/status')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated) {
                document.getElementById('userInfo').style.display = 'block';
                document.getElementById('loginLink').style.display = 'none';
                document.getElementById('username').textContent = data.user.username;
                
                if (data.user.role === 'admin') {
                    document.getElementById('adminLink').style.display = 'block';
                }
            }
        })
        .catch(error => {
            console.error('Auth check failed:', error);
            // Continue without authentication - browse should work for public access
        });
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('Logout failed:', error);
            window.location.href = '/login.html';
        });
}

// Load the complete folder structure
async function loadFolderStructure() {
    showLoading('folderTree');
    
    try {
        const response = await fetch('/api/browse/structure');
        const data = await response.json();
        
        if (data.success) {
            folderStructure = data.structure;
            currentPath = data.root_path;
            renderFolderTree(data.structure);
            loadFolderContents(data.root_path);
        } else {
            showError('folderTree', data.error || 'Failed to load folder structure');
        }
    } catch (error) {
        console.error('Error loading folder structure:', error);
        showError('folderTree', 'Failed to connect to server');
    }
}

function renderFolderTree(structure, container = null, level = 0) {
    if (!container) {
        container = document.getElementById('folderTree');
        container.innerHTML = '';
    }
    
    structure.forEach(item => {
        if (item.type === 'folder') {
            const treeItem = createTreeItem(item, level);
            container.appendChild(treeItem);
            
            if (item.children && item.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children';
                childContainer.style.marginLeft = `${(level + 1) * 16}px`;
                
                renderFolderTree(item.children.filter(child => child.type === 'folder'), 
                               childContainer, level + 1);
                
                treeItem.appendChild(childContainer);
            }
        }
    });
}

function createTreeItem(item, level) {
    const treeItem = document.createElement('div');
    treeItem.className = `tree-item folder ${item.expandable ? 'expandable' : ''}`;
    treeItem.dataset.path = item.path;
    
    const hasChildren = item.children && item.children.some(child => child.type === 'folder');
    
    treeItem.innerHTML = `
        ${hasChildren ? '<span class="tree-expand"><i class="fas fa-chevron-right"></i></span>' : ''}
        <i class="tree-icon ${item.icon}"></i>
        <span class="tree-name">${item.name}</span>
    `;
    
    // Click handler for folder navigation
    treeItem.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Remove active class from all items
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to clicked item
        treeItem.classList.add('active');
        
        // Load folder contents
        loadFolderContents(item.path);
        
        // Handle expand/collapse
        if (hasChildren) {
            const childContainer = treeItem.querySelector('.tree-children');
            if (childContainer) {
                const isExpanded = treeItem.classList.contains('expanded');
                if (isExpanded) {
                    treeItem.classList.remove('expanded');
                    childContainer.classList.remove('expanded');
                } else {
                    treeItem.classList.add('expanded');
                    childContainer.classList.add('expanded');
                }
            }
        }
    });
    
    return treeItem;
}

// Load contents of a specific folder
async function loadFolderContents(folderPath) {
    showLoading('contentGrid');
    currentPath = folderPath;
    
    // Update breadcrumb
    updateBreadcrumb(folderPath);
    
    try {
        const response = await fetch(`/api/browse/folder?path=${encodeURIComponent(folderPath)}`);
        const data = await response.json();
        
        if (data.success) {
            renderFolderContents(data.contents);
            updateFileStats(data.contents);
        } else {
            showError('contentGrid', data.error || 'Failed to load folder contents');
        }
    } catch (error) {
        console.error('Error loading folder contents:', error);
        showError('contentGrid', 'Failed to connect to server');
    }
}

function renderFolderContents(contents) {
    const contentGrid = document.getElementById('contentGrid');
    contentGrid.innerHTML = '';
    contentGrid.className = `content-grid ${currentViewMode}-view`;
    
    if (!contents || contents.length === 0) {
        contentGrid.innerHTML = `
            <div class="empty-folder">
                <i class="fas fa-folder-open" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                <p>This folder is empty</p>
            </div>
        `;
        return;
    }
    
    // Sort contents (folders first, then files)
    const sortedContents = [...contents].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    
    sortedContents.forEach(item => {
        const contentItem = createContentItem(item);
        contentGrid.appendChild(contentItem);
    });
}

function createContentItem(item) {
    const contentItem = document.createElement('div');
    contentItem.className = `content-item ${item.type} ${currentViewMode}`;
    contentItem.dataset.path = item.path;
    contentItem.dataset.type = item.type;
    contentItem.dataset.name = item.name;
    
    // Store item data for sorting
    contentItem.itemData = item;
    
    if (currentViewMode === 'grid') {
        contentItem.innerHTML = `
            <i class="item-icon ${item.icon}"></i>
            <div class="item-name" title="${item.name}">${item.name}</div>
            <div class="item-meta">
                ${item.type === 'file' ? formatFileSize(item.size) : 'Folder'}
                ${item.modified ? `• ${formatDate(item.modified)}` : ''}
            </div>
        `;
    } else {
        contentItem.innerHTML = `
            <i class="item-icon ${item.icon}"></i>
            <div class="item-info">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-path">${item.path}</div>
                </div>
                <div class="item-meta">
                    <div class="item-size">${item.type === 'file' ? formatFileSize(item.size) : 'Folder'}</div>
                    <div class="item-date">${item.modified ? formatDate(item.modified) : 'Unknown'}</div>
                </div>
            </div>
        `;
    }
    
    // Click handler
    contentItem.addEventListener('click', function() {
        handleItemClick(item);
    });
    
    // Right-click context menu
    contentItem.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showContextMenu(e, item);
    });
    
    // Double-click handler
    contentItem.addEventListener('dblclick', function() {
        if (item.type === 'folder') {
            loadFolderContents(item.path);
        } else {
            openFilePreview(item);
        }
    });
    
    return contentItem;
}

function handleItemClick(item) {
    // Remove previous selection
    document.querySelectorAll('.content-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to clicked item
    event.currentTarget.classList.add('selected');
    currentSelection = item;
    
    if (item.type === 'folder') {
        loadFolderContents(item.path);
    } else {
        // For files, show quick preview or info
        showFileQuickInfo(item);
    }
}

// File preview functionality
async function openFilePreview(file) {
    showLoadingOverlay();
    
    try {
        const response = await fetch(`/api/browse/file?path=${encodeURIComponent(file.path)}`);
        const data = await response.json();
        
        hideLoadingOverlay();
        
        if (data.success) {
            showFileModal(data);
        } else {
            showErrorModal('File Preview Error', data.error || 'Failed to load file');
        }
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error loading file:', error);
        showErrorModal('File Preview Error', 'Failed to connect to server');
    }
}

function showFileModal(fileData) {
    const modal = document.getElementById('fileModal');
    const fileName = document.getElementById('modalFileName');
    const filePath = document.getElementById('modalPath');
    const fileModified = document.getElementById('modalModified');
    const fileLines = document.getElementById('modalLines');
    const codeContainer = document.getElementById('codeContainer');
    const codePreview = document.getElementById('codePreview');
    const fileError = document.getElementById('fileError');
    const extensionBadge = document.getElementById('fileExtensionBadge');
    const sizeBadge = document.getElementById('fileSizeBadge');
    
    // Set file info
    fileName.textContent = fileData.name;
    filePath.textContent = fileData.path;
    fileModified.textContent = formatDate(fileData.modified);
    fileLines.textContent = `${fileData.lines} lines`;
    extensionBadge.textContent = fileData.extension || 'FILE';
    sizeBadge.textContent = formatFileSize(fileData.size);
    
    // Hide error and show code container
    fileError.style.display = 'none';
    codeContainer.style.display = 'block';
    
    // Set code content with syntax highlighting
    const codeElement = codePreview.querySelector('code');
    codeElement.textContent = fileData.content;
    
    // Apply syntax highlighting
    const language = getLanguageFromExtension(fileData.extension);
    codeElement.className = `language-${language}`;
    
    // Apply Prism highlighting
    if (window.Prism) {
        Prism.highlightElement(codeElement);
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Store current file data for actions
    modal.currentFileData = fileData;
}

function getLanguageFromExtension(ext) {
    const languageMap = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.py': 'python',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.java': 'java',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.sql': 'sql',
        '.sh': 'bash',
        '.bat': 'batch',
        '.ps1': 'powershell',
        '.md': 'markdown',
        '.ino': 'arduino'
    };
    
    return languageMap[ext] || 'text';
}

// Navigation functions
function updateBreadcrumb(path) {
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    const currentLocationTitle = document.getElementById('currentLocationTitle');
    const currentLocationPath = document.getElementById('currentLocationPath');
    
    breadcrumbPath.innerHTML = '';
    
    if (path) {
        // Split path and create breadcrumb items
        const parts = path.split(/[/\\]/).filter(part => part);
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath += (index === 0 ? '' : '/') + part;
            
            const breadcrumbItem = document.createElement('span');
            breadcrumbItem.className = 'breadcrumb-item';
            breadcrumbItem.textContent = part;
            breadcrumbItem.dataset.path = currentPath;
            
            breadcrumbItem.addEventListener('click', function() {
                loadFolderContents(currentPath);
            });
            
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.innerHTML = '<i class="fas fa-chevron-right"></i>';
            
            breadcrumbPath.appendChild(separator);
            breadcrumbPath.appendChild(breadcrumbItem);
        });
        
        // Update location display
        const folderName = parts[parts.length - 1] || 'Repository Root';
        currentLocationTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${folderName}`;
        currentLocationPath.textContent = path;
    } else {
        currentLocationTitle.innerHTML = '<i class="fas fa-home"></i> Repository Root';
        currentLocationPath.textContent = '';
    }
}

function navigateToRoot() {
    if (folderStructure) {
        const rootPath = document.querySelector('.tree-item[data-path]')?.dataset.path || '';
        loadFolderContents(rootPath.split('/').slice(0, -1).join('/'));
    }
}

// View mode functions
function setViewMode(mode) {
    currentViewMode = mode;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${mode}"]`).classList.add('active');
    
    // Re-render current contents with new view mode
    const contentGrid = document.getElementById('contentGrid');
    if (contentGrid.children.length > 0 && !contentGrid.querySelector('.loading-content')) {
        contentGrid.className = `content-grid ${mode}-view`;
        // Re-render all items with new view mode
        document.querySelectorAll('.content-item').forEach(item => {
            item.className = item.className.replace(/(grid|list)/, mode);
        });
    }
}

// Search functionality
async function searchInLocation() {
    const query = document.getElementById('locationSearchInput').value.trim();
    
    if (!query) {
        // If empty, reload current folder
        loadFolderContents(currentPath);
        return;
    }
    
    showLoading('contentGrid');
    
    try {
        const response = await fetch(`/api/browse/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            renderSearchResults(data.results, query);
        } else {
            showError('contentGrid', data.error || 'Search failed');
        }
    } catch (error) {
        console.error('Error searching:', error);
        showError('contentGrid', 'Failed to connect to server');
    }
}

function renderSearchResults(results, query) {
    const contentGrid = document.getElementById('contentGrid');
    contentGrid.innerHTML = '';
    contentGrid.className = `content-grid ${currentViewMode}-view`;
    
    if (!results || results.length === 0) {
        contentGrid.innerHTML = `
            <div class="empty-folder">
                <i class="fas fa-search" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                <p>No results found for "${query}"</p>
                <button class="btn btn-secondary" onclick="loadFolderContents(currentPath)" style="margin-top: 16px;">
                    <i class="fas fa-arrow-left"></i> Back to Current Folder
                </button>
            </div>
        `;
        return;
    }
    
    // Add search header
    const searchHeader = document.createElement('div');
    searchHeader.className = 'search-results-header';
    searchHeader.innerHTML = `
        <div style="padding: 16px; background: var(--card-bg); border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="margin: 0; color: var(--text-primary);">
                    <i class="fas fa-search"></i> Search Results for "${query}"
                </h3>
                <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 14px;">
                    Found ${results.length} results
                </p>
            </div>
            <button class="btn btn-secondary" onclick="loadFolderContents(currentPath)">
                <i class="fas fa-arrow-left"></i> Back to Current Folder
            </button>
        </div>
    `;
    contentGrid.appendChild(searchHeader);
    
    // Render results
    results.forEach(item => {
        const contentItem = createContentItem(item);
        contentGrid.appendChild(contentItem);
    });
    
    updateFileStats(results);
}

// Context menu functionality
function showContextMenu(event, item) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenuTarget = item;
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    
    // Adjust position if menu goes off screen
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = `${event.pageX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = `${event.pageY - rect.height}px`;
    }
}

function hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
    contextMenuTarget = null;
}

// Context menu actions
function openFile() {
    if (contextMenuTarget) {
        if (contextMenuTarget.type === 'folder') {
            loadFolderContents(contextMenuTarget.path);
        } else {
            openFilePreview(contextMenuTarget);
        }
    }
    hideContextMenu();
}

function copyPath() {
    if (contextMenuTarget) {
        navigator.clipboard.writeText(contextMenuTarget.path).then(() => {
            showNotification('Path copied to clipboard');
        });
    }
    hideContextMenu();
}

function copyName() {
    if (contextMenuTarget) {
        navigator.clipboard.writeText(contextMenuTarget.name).then(() => {
            showNotification('Name copied to clipboard');
        });
    }
    hideContextMenu();
}

function showFileInfo() {
    if (contextMenuTarget) {
        const info = `
Name: ${contextMenuTarget.name}
Type: ${contextMenuTarget.type}
Path: ${contextMenuTarget.path}
${contextMenuTarget.size ? `Size: ${formatFileSize(contextMenuTarget.size)}` : ''}
${contextMenuTarget.modified ? `Modified: ${formatDate(contextMenuTarget.modified)}` : ''}
        `;
        alert(info);
    }
    hideContextMenu();
}

// Modal functions
function closeModal() {
    document.getElementById('fileModal').style.display = 'none';
}

function copyCode() {
    const modal = document.getElementById('fileModal');
    const fileData = modal.currentFileData;
    
    if (fileData) {
        navigator.clipboard.writeText(fileData.content).then(() => {
            showNotification('Code copied to clipboard');
        });
    }
}

function toggleLineNumbers() {
    const codePreview = document.getElementById('codePreview');
    codePreview.classList.toggle('line-numbers');
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateFileStats(contents) {
    const fileStats = document.getElementById('fileStats');
    const folderCount = document.getElementById('folderCount');
    const fileCount = document.getElementById('fileCount');
    const totalSize = document.getElementById('totalSize');
    
    if (!contents) {
        fileStats.style.display = 'none';
        return;
    }
    
    const folders = contents.filter(item => item.type === 'folder');
    const files = contents.filter(item => item.type === 'file');
    const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
    
    folderCount.textContent = folders.length;
    fileCount.textContent = files.length;
    totalSize.textContent = formatFileSize(totalBytes);
    
    fileStats.style.display = 'flex';
}

function sortItems() {
    const sortBy = document.getElementById('sortBy').value;
    const contentGrid = document.getElementById('contentGrid');
    const items = Array.from(contentGrid.querySelectorAll('.content-item'));
    
    items.sort((a, b) => {
        const itemA = a.itemData || {};
        const itemB = b.itemData || {};
        
        // Always put folders first
        if (itemA.type !== itemB.type) {
            return itemA.type === 'folder' ? -1 : 1;
        }
        
        switch (sortBy) {
            case 'name':
                return itemA.name.localeCompare(itemB.name);
            case 'size':
                return (itemB.size || 0) - (itemA.size || 0);
            case 'modified':
                return new Date(itemB.modified) - new Date(itemA.modified);
            case 'type':
                return itemA.extension?.localeCompare(itemB.extension || '') || 0;
            default:
                return itemA.name.localeCompare(itemB.name);
        }
    });
    
    // Re-append sorted items
    items.forEach(item => contentGrid.appendChild(item));
}

function refreshFolderTree() {
    loadFolderStructure();
}

// Loading and error states
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="file-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="refreshFolderTree()" style="margin-top: 16px;">
                <i class="fas fa-refresh"></i> Try Again
            </button>
        </div>
    `;
}

function showLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function showErrorModal(title, message) {
    alert(`${title}\n\n${message}`);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(style);
