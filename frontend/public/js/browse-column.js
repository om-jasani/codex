/**
 * DC Codex - Enhanced Column Navigation Browser JavaScript
 * Professional IDE-like interface with smart navigation and comprehensive features
 */

// Global state
let folderStructure = null;
let currentPath = [];
let columns = [];
let selectedItems = [];
let maxVisibleColumns = 5;
let currentModalFile = null;
let currentFontSize = 14;
let searchTerm = '';
let searchResults = [];
let currentSearchIndex = 0;
let pathHistory = [];
let historyIndex = -1;
let navigationAnimation = null;
let isNavigating = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('filePreviewModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible');
    }
    
    initializeBrowser();
    loadInitialStructure();
    setupModalHandlers();
    setupKeyboardShortcuts();
    setupEnhancedFeatures();
});

function initializeBrowser() {
    checkAuthStatus();
    updateMaxVisibleColumns();
    window.addEventListener('resize', updateMaxVisibleColumns);
    
    currentFontSize = parseInt(localStorage.getItem('codexFontSize')) || 14;
    
    // Initialize path history
    pathHistory = [];
    historyIndex = -1;
    
    // Add smooth scrolling behavior
    document.documentElement.style.scrollBehavior = 'smooth';
}

function setupEnhancedFeatures() {
    // Add path tracking
    setupPathTracking();
    
    // Add enhanced visual feedback
    setupVisualFeedback();
}

function setupPathTracking() {
    // Initialize path indicator
    updatePathIndicator();
    updateNavigationButtons();
}

function setupVisualFeedback() {
    // Add hover effects and animations
    document.addEventListener('mouseover', handleItemHover);
    document.addEventListener('mouseout', handleItemUnhover);
}

function handleItemHover(e) {
    const item = e.target.closest('.file-item, .folder-item');
    if (item && !item.classList.contains('selected')) {
        item.style.transform = 'translateX(4px)';
    }
}

function handleItemUnhover(e) {
    const item = e.target.closest('.file-item, .folder-item');
    if (item && !item.classList.contains('selected')) {
        item.style.transform = '';
    }
}

function updateMaxVisibleColumns() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) {
        maxVisibleColumns = 2;
    } else if (screenWidth < 1024) {
        maxVisibleColumns = 3;
    } else if (screenWidth < 1400) {
        maxVisibleColumns = 4;
    } else {
        maxVisibleColumns = 5;
    }
}

function setupModalHandlers() {
    const modal = document.getElementById('filePreviewModal');
    if (!modal) return;
    
    // Close modal handlers
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFilePreviewModal);
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeFilePreviewModal();
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('filePreviewModal');
        
        if (modal && modal.classList.contains('visible')) {
            handleModalKeyboard(e);
        } else {
            handleBrowserKeyboard(e);
        }
    });
}

function handleModalKeyboard(e) {
    switch(e.key) {
        case 'Escape':
            e.preventDefault();
            closeFilePreviewModal();
            break;
            
        case 'F11':
            e.preventDefault();
            toggleFullscreen();
            break;
            
        case '+':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                increaseFontSize();
            }
            break;
            
        case '-':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                decreaseFontSize();
            }
            break;
            
        case '0':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                resetFontSize();
            }
            break;
            
        case 'f':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                openSearch();
            }
            break;
    }
}

function handleBrowserKeyboard(e) {
    if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateBackOneLevel();
    } else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateForwardInHistory();
    } else if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadInitialStructure();
    }
}

async function checkAuthStatus() {
    // Authentication handled by main navigation
}

async function loadInitialStructure() {
    showLoadingState();
    
    try {
        const response = await fetch('/api/browse/structure');
        const data = await response.json();
        
        if (data.success) {
            folderStructure = data.structure;
            currentPath = [{ name: 'Root', path: data.root_path }];
            
            const rootItems = data.structure || [];
            
            columns = [{
                title: 'Root Directory',
                path: data.root_path,
                items: rootItems
            }];
            
            // Add to history
            addToHistory();
            
            hideLoadingState();
            renderColumns();
            updateBreadcrumb();
            updatePathIndicator();
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
                    <div class="spinner-ring">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
                <h3>Loading Repository</h3>
                <p>Please wait while we load your repository structure...</p>
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
            <div class="empty-state error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Repository</h3>
                <p>${message}</p>
                <button onclick="loadInitialStructure()" class="btn-retry">
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
    
    const currentScrollLeft = container.scrollLeft;
    const preservedSelections = [...selectedItems];
    
    container.innerHTML = '';
    selectedItems = [];
    
    columns.forEach((column, columnIndex) => {
        if (column.isFilePreview) {
            return;
        }
        
        const columnElement = createColumn(column, columnIndex);
        
        if (!columnElement) {
            console.error(`DC Codex: Failed to create column ${columnIndex}`);
            return;
        }
        
        if (columnIndex === columns.length - 1 && columns.length > 1) {
            columnElement.classList.add('column-slide-in');
        }
        
        container.appendChild(columnElement);
        selectedItems.push(null);
    });
    
    // Optimize display for too many columns
    optimizeColumnDisplay();
    
    // Add enhanced animations
    requestAnimationFrame(() => {
        restoreActivePathVisuals();
        updatePathIndicator();
    });
    
    setTimeout(() => {
        scrollToActiveColumn();
        
        const newColumn = container.querySelector('.column-slide-in');
        if (newColumn) {
            setTimeout(() => {
                newColumn.classList.remove('column-slide-in');
            }, 400);
        }
    }, 50);
}

function optimizeColumnDisplay() {
    const container = document.getElementById('columnNavigation');
    if (!container) return;
    
    const columns = container.querySelectorAll('.column');
    
    // Ensure all columns are fully visible and functional
    columns.forEach((column) => {
        column.style.opacity = '1';
        column.style.transform = 'translateX(0)';
        column.style.pointerEvents = 'auto';
        column.style.filter = 'none';
        column.style.zIndex = 'auto';
    });
}

function restoreActivePathVisuals() {
    // Clear all previous path indicators first
    document.querySelectorAll('.file-item, .folder-item').forEach(el => {
        el.classList.remove('selected', 'in-path', 'has-next-column');
    });

    // Apply path visualization for each item in currentPath
    currentPath.forEach((pathItem, pathIndex) => {
        if (pathIndex === 0) return; // Skip root
        
        const columnIndex = pathIndex - 1;
        const column = document.querySelectorAll('.column')[columnIndex];
        
        if (!column) return;
        
        const items = column.querySelectorAll('.folder-item, .file-item');
        items.forEach(itemElement => {
            const itemName = itemElement.dataset.itemName;
            const itemPath = itemElement.dataset.itemPath;
            
            if (itemName === pathItem.name || itemPath === pathItem.path) {
                // Determine if this is the last item in the path (currently selected)
                const isCurrentlySelected = pathIndex === currentPath.length - 1;
                
                if (isCurrentlySelected) {
                    // This is the currently selected/active folder
                    itemElement.classList.add('selected');
                } else {
                    // This is an intermediate folder in the path
                    itemElement.classList.add('in-path');
                    
                    // If it has a next column, add the has-next-column class
                    if (pathIndex < currentPath.length - 1) {
                        itemElement.classList.add('has-next-column');
                    }
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

function restoreActivePathVisualsForFileSelection() {
    // This function maintains folder path highlighting when files are selected
    // It only highlights folders in the path, not the file itself
    currentPath.forEach((pathItem, pathIndex) => {
        if (pathIndex === 0) return; // Skip root
        
        const columnIndex = pathIndex - 1;
        const column = document.querySelectorAll('.column')[columnIndex];
        
        if (!column) return;
        
        const folderItems = column.querySelectorAll('.folder-item');
        folderItems.forEach(itemElement => {
            const itemName = itemElement.dataset.itemName;
            const itemPath = itemElement.dataset.itemPath;
            
            if (itemName === pathItem.name || itemPath === pathItem.path) {
                // This is a folder in our navigation path
                if (pathIndex === currentPath.length - 1) {
                    // This is the last folder in our path (parent of selected file)
                    itemElement.classList.add('in-path');
                    itemElement.classList.add('has-next-column');
                } else {
                    // This is an intermediate folder in the path
                    itemElement.classList.add('in-path');
                    
                    // If it has a next column, add the has-next-column class
                    if (pathIndex < currentPath.length - 1) {
                        itemElement.classList.add('has-next-column');
                    }
                }
            }
        });
    });
}

function createColumn(columnData, columnIndex) {
    const column = document.createElement('div');
    column.className = 'column';
    column.dataset.columnIndex = columnIndex;
    
    const header = document.createElement('div');
    header.className = 'column-header';
    header.innerHTML = `
        <div class="column-title-section">
            <i class="fas fa-folder"></i>
            <span class="column-title">${escapeHtml(columnData.title)}</span>
        </div>
        <span class="item-count">${columnData.items.length} items</span>
    `;
    
    const content = document.createElement('div');
    content.className = 'column-content';
    
    if (columnData.items.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>Empty Directory</h3>
                <p>This folder contains no items</p>
            </div>
        `;
    } else {
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
    
    const hasChildren = item.type === 'folder' && (
        (item.children && item.children.length > 0) || 
        (item.item_count && item.item_count > 0)
    );
    
    if (hasChildren) {
        itemElement.classList.add('has-children');
    }
    
    const icon = getFileIcon(item);
    const itemMeta = formatItemMeta(item);
    const fileExtension = item.type === 'file' ? getFileExtension(item.name) : '';
    
    itemElement.innerHTML = `
        <div class="item-main">
            <i class="${icon.class} ${item.type === 'folder' ? 'folder-icon' : 'file-icon'}" ${icon.color ? `style="color: ${icon.color}"` : ''}></i>
            <div class="item-details">
                <span class="item-name">${escapeHtml(item.name)}</span>
                <span class="item-meta">${itemMeta}</span>
            </div>
        </div>
        ${fileExtension ? `<span class="file-extension">${fileExtension.toUpperCase()}</span>` : ''}
        ${hasChildren ? '<i class="fas fa-chevron-right item-arrow"></i>' : ''}
    `;
    
    itemElement.addEventListener('click', (e) => {
        e.preventDefault();
        handleItemClick(item, columnIndex, itemElement);
    });
    
    // Add hover effects
    itemElement.addEventListener('mouseenter', () => {
        if (!itemElement.classList.contains('selected')) {
            itemElement.style.transform = 'translateX(4px)';
        }
    });
    
    itemElement.addEventListener('mouseleave', () => {
        if (!itemElement.classList.contains('selected')) {
            itemElement.style.transform = '';
        }
    });
    
    return itemElement;
}

function getFileIcon(item) {
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

function formatItemMeta(item) {
    if (item.type === 'folder') {
        const childCount = item.children ? item.children.length : (item.item_count || 0);
        return childCount > 0 ? `${childCount} items` : 'Empty folder';
    }
    
    if (item.size) {
        return formatFileSize(item.size);
    }
    
    return 'Unknown size';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function handleItemClick(item, columnIndex, itemElement) {
    if (isNavigating) return;
    
    // Clear previous selections but MAINTAIN path highlighting for folders
    document.querySelectorAll('.file-item, .folder-item').forEach(el => {
        el.classList.remove('selected');
        el.style.transform = '';
        // Only clear path indicators if it's not a folder in our current path
        if (item.type === 'file') {
            // For file selections, we keep folder path highlighting
            // Only remove file-specific selections
            if (el.classList.contains('file-item')) {
                el.classList.remove('has-next-column', 'in-path');
            }
        } else {
            // For folder selections, clear everything as we'll rebuild the path
            el.classList.remove('has-next-column', 'in-path');
        }
    });
    
    // Add selection to clicked item
    itemElement.classList.add('selected');
    selectedItems[columnIndex] = item;
    
    // Remove columns to the right with animation
    const container = document.getElementById('columnNavigation');
    const allColumns = container.querySelectorAll('.column');
    
    // Smart column removal
    for (let i = allColumns.length - 1; i > columnIndex; i--) {
        const column = allColumns[i];
        column.style.animation = 'slideOutToRight 0.3s ease-in-out';
        column.style.transform = 'translateX(100px)';
        column.style.opacity = '0';
        
        setTimeout(() => {
            if (column.parentNode) {
                column.remove();
            }
        }, 300);
    }
    
    columns = columns.slice(0, columnIndex + 1);
    currentPath = currentPath.slice(0, columnIndex + 1);
    
    if (item.type === 'folder') {
        // Add folder opening animation
        showFolderLoadingAnimation(itemElement);
        
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
            newColumnData = {
                title: item.name,
                path: item.path,
                items: item.children || []
            };
        }
        
        columns.push(newColumnData);
        currentPath.push({ name: item.name, path: item.path });
        
        // Add to history
        addToHistory();
        
        // Remove loading animation
        removeFolderLoadingAnimation(itemElement);
        
        const newColumnElement = createColumn(newColumnData, columnIndex + 1);
        newColumnElement.classList.add('column-slide-in');
        container.appendChild(newColumnElement);
        
        updateBreadcrumb();
        updatePathIndicator();
        updateNavigationButtons();
        
        // Apply path visualization to show the full navigation trail
        setTimeout(() => {
            restoreActivePathVisuals();
            scrollToActiveColumn();
            
            setTimeout(() => {
                newColumnElement.classList.remove('column-slide-in');
            }, 400);
        }, 100);
        
        // Optimize column display
        optimizeColumnDisplay();
        
    } else {
        // For file selection, maintain folder path highlighting and show file preview
        // Restore path highlighting for folders while keeping file selected
        restoreActivePathVisualsForFileSelection();
        await showFilePreview(item);
    }
}

function showFolderLoadingAnimation(itemElement) {
    const arrow = itemElement.querySelector('.item-arrow');
    if (arrow) {
        arrow.classList.add('fa-spin');
    }
}

function removeFolderLoadingAnimation(itemElement) {
    const arrow = itemElement.querySelector('.item-arrow');
    if (arrow) {
        arrow.classList.remove('fa-spin');
    }
}

function addToHistory() {
    const state = {
        path: [...currentPath],
        columns: [...columns],
        selectedItems: [...selectedItems]
    };
    
    // Remove forward history if we're not at the end
    if (historyIndex < pathHistory.length - 1) {
        pathHistory = pathHistory.slice(0, historyIndex + 1);
    }
    
    pathHistory.push(state);
    historyIndex = pathHistory.length - 1;
    
    // Keep only last 50 states
    if (pathHistory.length > 50) {
        pathHistory = pathHistory.slice(-50);
        historyIndex = pathHistory.length - 1;
    }
    
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    
    if (backBtn) {
        backBtn.disabled = historyIndex <= 0;
    }
    
    if (forwardBtn) {
        forwardBtn.disabled = historyIndex >= pathHistory.length - 1;
    }
}

function navigateForwardInHistory() {
    if (historyIndex < pathHistory.length - 1) {
        historyIndex++;
        restoreHistoryState();
    }
}

function restoreHistoryState() {
    if (historyIndex < 0 || historyIndex >= pathHistory.length) return;
    
    const state = pathHistory[historyIndex];
    isNavigating = true;
    
    currentPath = [...state.path];
    columns = [...state.columns];
    selectedItems = [...state.selectedItems];
    
    renderColumns();
    updateBreadcrumb();
    updatePathIndicator();
    updateNavigationButtons();
    
    // Ensure path highlighting is restored
    setTimeout(() => {
        restoreActivePathVisuals();
    }, 50);
    
    setTimeout(() => {
        isNavigating = false;
    }, 500);
}

function updatePathIndicator() {
    const pathIndicator = document.getElementById('pathIndicator');
    if (pathIndicator) {
        const pathString = currentPath.map(p => p.name).join(' → ');
        pathIndicator.textContent = pathString;
    }
}

async function showFilePreview(file) {
    currentModalFile = file;
    
    try {
        showFilePreviewModal(file, null, true);
        
        const response = await fetch(`/api/browse/file?path=${encodeURIComponent(file.path)}`);
        const data = await response.json();
        
        if (data.success) {
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
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    
    // Update modal content
    updateModalContent(file, fileData, isLoading);
    
    // Show modal with animation
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });
}

function updateModalContent(file, fileData, isLoading) {
    // Update header
    updateModalHeader(file, fileData);
    
    // Update sidebar
    updateModalSidebar(file, fileData);
    
    // Update main content
    updateModalMainContent(file, fileData, isLoading);
}

function updateModalHeader(file, fileData) {
    const fileName = document.getElementById('modalFileName');
    const fileIcon = document.querySelector('#filePreviewModal .modal-title .file-icon');
    const fileBadges = document.getElementById('fileBadges');
    
    if (fileName) fileName.textContent = file.name;
    
    if (fileIcon) {
        const icon = getFileIcon(file);
        fileIcon.className = `file-icon ${icon.class}`;
        fileIcon.style.color = icon.color || '#3b82f6';
    }
    
    if (fileBadges && fileData && !fileData.error) {
        const extension = getFileExtension(file.name);
        const size = fileData.size ? formatFileSize(fileData.size) : null;
        
        fileBadges.innerHTML = '';
        
        if (extension) {
            const extBadge = document.createElement('span');
            extBadge.className = 'badge ext-badge';
            extBadge.textContent = extension.toUpperCase();
            fileBadges.appendChild(extBadge);
        }
        
        if (size) {
            const sizeBadge = document.createElement('span');
            sizeBadge.className = 'badge size-badge';
            sizeBadge.textContent = size;
            fileBadges.appendChild(sizeBadge);
        }
    }
}

function updateModalSidebar(file, fileData) {
    const sidebar = document.querySelector('#filePreviewModal .modal-sidebar');
    if (!sidebar) return;
    
    const fileSize = fileData && fileData.size ? formatFileSize(fileData.size) : 'Unknown';
    const fileType = getFileExtension(file.name).toUpperCase() || 'FILE';
    const relativePath = getRelativePath(file.path);
    const lastModified = fileData && fileData.modified ? 
        new Date(fileData.modified).toLocaleDateString() : 'Unknown';
    
    sidebar.innerHTML = `
        <div class="file-info-section">
            <h3>File Information</h3>
            <div class="file-meta-grid">
                <div class="file-meta-item">
                    <span class="file-meta-label">Name</span>
                    <span class="file-meta-value" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                </div>
                <div class="file-meta-item">
                    <span class="file-meta-label">Type</span>
                    <span class="file-meta-value">${fileType}</span>
                </div>
                <div class="file-meta-item">
                    <span class="file-meta-label">Size</span>
                    <span class="file-meta-value">${fileSize}</span>
                </div>
                <div class="file-meta-item">
                    <span class="file-meta-label">Modified</span>
                    <span class="file-meta-value">${lastModified}</span>
                </div>
                <div class="file-meta-item">
                    <span class="file-meta-label">Path</span>
                    <span class="file-meta-value" title="${relativePath}">${escapeHtml(relativePath)}</span>
                </div>
            </div>
        </div>
        
        <div class="file-actions-section">
            <h3>Actions</h3>
            <div class="action-buttons">
                <button class="action-btn" onclick="copyAllContent()" title="Copy file content">
                    <i class="fas fa-clipboard"></i>
                    Copy Content
                </button>
                <button class="action-btn" onclick="toggleFullscreen()" title="Toggle fullscreen">
                    <i class="fas fa-expand"></i>
                    Fullscreen
                </button>
            </div>
        </div>
        
        <div class="file-controls-section">
            <h3>View Controls</h3>
            <div class="control-groups">
                <div class="control-group">
                    <label>Font Size</label>
                    <div class="font-controls">
                        <button class="control-btn" onclick="decreaseFontSize()" title="Decrease font size">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="font-size-display">${currentFontSize}</span>
                        <button class="control-btn" onclick="increaseFontSize()" title="Increase font size">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                
                <div class="control-group">
                    <label>Search</label>
                    <div class="search-controls">
                        <button class="control-btn" onclick="openSearch()" title="Search in file">
                            <i class="fas fa-search"></i>
                            Search
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="keyboard-shortcuts-section">
            <h3>Shortcuts</h3>
            <div class="shortcuts-list">
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+F</span>
                    <span class="shortcut-desc">Search</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">F11</span>
                    <span class="shortcut-desc">Fullscreen</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Esc</span>
                    <span class="shortcut-desc">Close</span>
                </div>
            </div>
        </div>
    `;
}

function updateModalMainContent(file, fileData, isLoading) {
    const mainContent = document.querySelector('#filePreviewModal .modal-main');
    if (!mainContent) return;
    
    if (isLoading) {
        mainContent.innerHTML = `
            <div class="file-preview-loading">
                <div class="loading-spinner">
                    <div class="spinner-ring">
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
            <div class="file-preview-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to load file</h3>
                <p>${escapeHtml(fileData.error)}</p>
                <button class="retry-btn" onclick="showFilePreview(currentModalFile)">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            </div>
        `;
        return;
    }
    
    if (fileData) {
        renderFileContent(file, fileData, mainContent);
    }
}

function renderFileContent(file, fileData, container) {
    const ext = getFileExtension(file.name);
    
    if (fileData.type === 'image') {
        container.innerHTML = `
            <div class="file-content-wrapper image-wrapper">
                <div class="image-preview">
                    <img src="${fileData.content}" alt="${escapeHtml(file.name)}" loading="lazy">
                </div>
            </div>
        `;
    } else if (fileData.type === 'pdf') {
        const inlineUrl = fileData.inline_url || `/api/browse/file-inline?path=${encodeURIComponent(file.path)}`;
        container.innerHTML = `
            <div class="file-content-wrapper pdf-wrapper">
                <div class="pdf-preview">
                    <iframe class="pdf-embed" src="${inlineUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf">
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
        renderCodeContent(file, fileData, container);
    } else {
        container.innerHTML = `
            <div class="file-content-wrapper">
                <div class="file-preview-error">
                    <i class="fas fa-file-times"></i>
                    <h3>Preview not available</h3>
                    <p>This file type cannot be displayed or the file content is not available.</p>
                </div>
            </div>
        `;
    }
}

function renderCodeContent(file, fileData, container) {
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
    
    // Store original content for copying
    const originalContent = content;
    
    // Format JSON and XML for better readability
    const ext = getFileExtension(file.name);
    if (ext === 'json') {
        try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Keep original content if parsing fails
        }
    } else if (ext === 'xml') {
        try {
            content = formatXml(content);
        } catch (e) {
            // Keep original content if formatting fails
        }
    }
    
    const lines = content.split('\n');
    
    // Create HTML with line numbers as spans for precise control
    const codeWithLineNumbers = lines.map((line, index) => {
        const lineNum = index + 1;
        return `<div class="code-line-wrapper"><span class="line-number-span" data-line="${lineNum}">${lineNum}</span><span class="code-content-span">${escapeHtml(line)}</span></div>`;
    }).join('');
    
    container.innerHTML = `
        <div class="file-content-wrapper code-wrapper">
            <!-- Hidden element to store original content for copying -->
            <div id="originalContent" style="display: none;" data-original-content="${escapeHtml(originalContent)}"></div>
            <div class="code-header">
                <div class="code-title">
                    <i class="${getFileIcon(file).class}"></i>
                    <span>${escapeHtml(file.name)}</span>
                    <span class="line-count">${lines.length} lines</span>
                </div>
                <div class="code-actions">
                    <button class="code-action-btn" onclick="copyAllContent()" title="Copy file content">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="code-action-btn" onclick="openSearch()" title="Search in file">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
            
            <div class="search-bar" id="searchBar" style="display: none;">
                <div class="search-input-group">
                    <input type="text" id="searchInput" placeholder="Search in file..." onkeyup="searchInFile(event)">
                    <button onclick="findNext()" title="Find next">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button onclick="findPrevious()" title="Find previous">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <span class="search-results" id="searchResults"></span>
                    <button onclick="closeSearch()" title="Close search">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="code-display-container">
                <pre class="code-display-robust" id="codeDisplay" style="font-size: ${currentFontSize}px;"><code id="codeText" class="${getPrismLanguage(`.${ext}`)}" data-formatted-content="${escapeHtml(content)}">${codeWithLineNumbers}</code></pre>
            </div>
        </div>
    `;
    
    // Apply syntax highlighting to code content only
    setTimeout(() => {
        if (window.Prism) {
            const codeSpans = container.querySelectorAll('.code-content-span');
            codeSpans.forEach(span => {
                // Apply highlighting to individual code spans
                const tempCode = document.createElement('code');
                tempCode.className = getPrismLanguage(`.${ext}`);
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

function setupScrollSync() {
    const lineNumbers = document.getElementById('lineNumbers');
    const codeScrollContainer = document.querySelector('.code-scroll-container');
    
    if (lineNumbers && codeScrollContainer) {
        codeScrollContainer.addEventListener('scroll', () => {
            lineNumbers.scrollTop = codeScrollContainer.scrollTop;
        });
    }
}

function formatXml(xml) {
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

// Font size management
function increaseFontSize() {
    if (currentFontSize < 24) {
        currentFontSize += 1;
        updateFontSize();
    }
}

function decreaseFontSize() {
    if (currentFontSize > 8) {
        currentFontSize -= 1;
        updateFontSize();
    }
}

function resetFontSize() {
    currentFontSize = 14;
    updateFontSize();
}

function updateFontSize() {
    localStorage.setItem('codexFontSize', currentFontSize.toString());
    
    const codeDisplay = document.getElementById('codeDisplay');
    const fontDisplay = document.querySelector('.font-size-display');
    
    if (codeDisplay) codeDisplay.style.fontSize = currentFontSize + 'px';
    if (fontDisplay) fontDisplay.textContent = currentFontSize;
}

// Search functionality
function openSearch() {
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBar) {
        searchBar.style.display = 'block';
        if (searchInput) {
            searchInput.focus();
        }
    }
}

function closeSearch() {
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.style.display = 'none';
    }
    clearSearchHighlights();
}

function searchInFile(event) {
    if (event.key === 'Enter') {
        findNext();
        return;
    }
    
    if (event.key === 'Escape') {
        closeSearch();
        return;
    }
    
    const query = event.target.value.toLowerCase();
    if (query.length < 2) {
        clearSearchHighlights();
        updateSearchResults(0, 0);
        return;
    }
    
    performSearch(query);
}

function performSearch(query) {
    const codeText = document.getElementById('codeText');
    if (!codeText) return;
    
    const content = codeText.textContent.toLowerCase();
    searchResults = [];
    searchTerm = query;
    currentSearchIndex = 0;
    
    let index = content.indexOf(query);
    while (index !== -1) {
        searchResults.push(index);
        index = content.indexOf(query, index + 1);
    }
    
    highlightSearchResults();
    updateSearchResults(searchResults.length, currentSearchIndex + 1);
    
    if (searchResults.length > 0) {
        scrollToSearchResult(0);
    }
}

function findNext() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    updateSearchResults(searchResults.length, currentSearchIndex + 1);
    scrollToSearchResult(currentSearchIndex);
}

function findPrevious() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    updateSearchResults(searchResults.length, currentSearchIndex + 1);
    scrollToSearchResult(currentSearchIndex);
}

function highlightSearchResults() {
    // This would require more complex implementation
    // For now, we'll use browser's built-in find functionality
    // In a real implementation, you'd manipulate the DOM to add highlight spans
}

function clearSearchHighlights() {
    // Clear any search highlights
    searchResults = [];
    currentSearchIndex = 0;
    updateSearchResults(0, 0);
}

function updateSearchResults(total, current) {
    const resultsDisplay = document.getElementById('searchResults');
    if (resultsDisplay) {
        if (total === 0) {
            resultsDisplay.textContent = 'No results';
        } else {
            resultsDisplay.textContent = `${current} of ${total}`;
        }
    }
}

function scrollToSearchResult(index) {
    // This would scroll to the specific search result
    // Implementation depends on how search highlighting is done
}

// File actions
function copyAllContent() {
    // Try to get the original content from the hidden element (for exact file copy)
    const originalContentElement = document.getElementById('originalContent');
    if (originalContentElement) {
        const originalContent = originalContentElement.dataset.originalContent;
        if (originalContent) {
            // Decode HTML entities
            const decodedContent = decodeHtmlEntities(originalContent);
            copyToClipboard(decodedContent, 'Original file content copied to clipboard');
            return;
        }
    }

    // Try to get the formatted content from the code element (for pretty-printed copy)
    const codeText = document.getElementById('codeText');
    if (codeText) {
        const formattedContent = codeText.dataset.formattedContent;
        if (formattedContent) {
            // Decode HTML entities
            const decodedContent = decodeHtmlEntities(formattedContent);
            copyToClipboard(decodedContent, 'Formatted file content copied to clipboard');
            return;
        }
    }

    // Try to extract content from code-content-span elements (robust: preserves line breaks)
    if (codeText) {
        const codeLines = codeText.querySelectorAll('.code-content-span');
        if (codeLines.length > 0) {
            // Get text content from each line and join with newlines
            const content = Array.from(codeLines).map(line => line.textContent || '').join('\n');
            copyToClipboard(content, 'File content copied to clipboard');
            return;
        }
    }

    // Fallback: use API call if we have the current modal file
    if (currentModalFile) {
        copyOriginalFileContent();
        return;
    }

    // Last resort: use textContent but warn about potential formatting issues
    if (codeText) {
        // Try to split by line wrappers if possible
        let fallbackContent = codeText.textContent;
        // If there are code-line-wrapper divs, join their textContent with newlines
        const codeLineWrappers = codeText.querySelectorAll('.code-line-wrapper');
        if (codeLineWrappers.length > 0) {
            fallbackContent = Array.from(codeLineWrappers).map(div => {
                const codeSpan = div.querySelector('.code-content-span');
                return codeSpan ? codeSpan.textContent : '';
            }).join('\n');
        }
        copyToClipboard(fallbackContent, 'File content copied to clipboard (formatting may be affected)');
    } else {
        showToast('No content available to copy', 'error');
    }
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Helper function to copy original file content
async function copyOriginalFileContent() {
    if (!currentModalFile) {
        showToast('No file selected', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(currentModalFile.path)}`);
        if (response.ok) {
            const fileData = await response.json();
            if (fileData.content) {
                copyToClipboard(fileData.content, 'Original file content copied to clipboard');
            } else {
                showToast('File content is empty', 'error');
            }
        } else {
            showToast('Failed to fetch original file content', 'error');
        }
    } catch (error) {
        console.error('Error fetching original file content:', error);
        showToast('Error fetching file content', 'error');
    }
}

function toggleFullscreen() {
    const modal = document.getElementById('filePreviewModal');
    if (!modal) return;
    
    modal.classList.toggle('fullscreen');
    
    const btn = document.querySelector('button[onclick="toggleFullscreen()"]');
    if (btn) {
        const icon = btn.querySelector('i');
        if (modal.classList.contains('fullscreen')) {
            icon.className = 'fas fa-compress';
            btn.title = 'Exit fullscreen';
        } else {
            icon.className = 'fas fa-expand';
            btn.title = 'Enter fullscreen';
        }
    }
}

function copyToClipboard(text, successMessage) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success');
        }).catch(() => {
            fallbackCopyToClipboard(text, successMessage);
        });
    } else {
        fallbackCopyToClipboard(text, successMessage);
    }
}

function fallbackCopyToClipboard(text, successMessage) {
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
            showToast(successMessage, 'success');
        } else {
            showToast('Failed to copy to clipboard', 'error');
        }
    } catch (err) {
        console.error('Copy failed:', err);
        showToast('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
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

function closeFilePreviewModal() {
    const modal = document.getElementById('filePreviewModal');
    if (modal && modal.classList.contains('visible')) {
        modal.classList.remove('visible');
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            currentModalFile = null;
            
            // Restore path highlighting when closing file modal
            restoreActivePathVisualsForFileSelection();
        }, 300);
    }
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    breadcrumb.innerHTML = '';
    
    currentPath.forEach((pathItem, index) => {
        const item = document.createElement('div');
        item.className = 'breadcrumb-item';
        
        if (index < currentPath.length - 1) {
            item.classList.add('clickable');
            item.addEventListener('click', () => navigateToBreadcrumbItem(index));
        }
        
        if (index === currentPath.length - 1) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <i class="fas ${index === 0 ? 'fa-home' : 'fa-folder'}"></i>
            <span>${escapeHtml(pathItem.name)}</span>
        `;
        
        breadcrumb.appendChild(item);
    });
}

function navigateToBreadcrumbItem(index) {
    const container = document.getElementById('columnNavigation');
    const allColumns = container.querySelectorAll('.column');
    
    // Add slide-out animation to removed columns
    for (let i = allColumns.length - 1; i > index; i--) {
        allColumns[i].style.animation = 'slideOutToRight 0.3s ease-in-out';
        setTimeout(() => {
            if (allColumns[i].parentNode) {
                allColumns[i].remove();
            }
        }, 300);
    }
    
    currentPath = currentPath.slice(0, index + 1);
    columns = columns.slice(0, index + 1);
    selectedItems = selectedItems.slice(0, index + 1);
    
    document.querySelectorAll('.file-item, .folder-item').forEach(el => {
        el.classList.remove('selected', 'has-next-column', 'in-path');
    });
    
    // Add to history
    addToHistory();
    
    setTimeout(() => {
        restoreActivePathVisuals();
        updateBreadcrumb();
        updatePathIndicator();
        updateNavigationButtons();
    }, 10);
}

function navigateBackOneLevel() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreHistoryState();
    } else if (currentPath.length > 1) {
        navigateToBreadcrumbItem(currentPath.length - 2);
    }
}

function scrollToActiveColumn() {
    const container = document.getElementById('columnNavigation');
    if (container) {
        setTimeout(() => {
            container.scrollLeft = container.scrollWidth - container.clientWidth;
        }, 50);
    }
}

// Add CSS keyframes for slide-out animation
const slideOutKeyframes = `
    @keyframes slideOutToRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(50px);
        }
    }
`;

// Inject keyframes into the document
if (!document.getElementById('slideOutKeyframes')) {
    const style = document.createElement('style');
    style.id = 'slideOutKeyframes';
    style.textContent = slideOutKeyframes;
    document.head.appendChild(style);
}

// Utility functions
function getFileExtension(filename) {
    const ext = filename.split('.').pop();
    return ext === filename ? '' : ext;
}

function getRelativePath(fullPath) {
    if (!folderStructure || !fullPath) return fullPath;
    
    const rootPath = currentPath[0]?.path || '';
    if (fullPath.startsWith(rootPath)) {
        const relative = fullPath.substring(rootPath.length);
        return relative.startsWith('/') || relative.startsWith('\\') ? relative.substring(1) : relative;
    }
    return fullPath;
}

function getPrismLanguage(filetype) {
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

function escapeHtml(text) {
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

// Global function for forward navigation
window.navigateForwardInHistory = navigateForwardInHistory;