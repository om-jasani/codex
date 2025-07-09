/**
 * DC Codex - Enhanced Column Navigation Browser JavaScript
 * Professional IDE-like interface with smart navigation and comprehensive features
 * Updated to use the file preview module
 */

// Global state
let folderStructure = null;
let currentPath = [];
let columns = [];
let selectedItems = [];
let maxVisibleColumns = 5;
let pathHistory = [];
let historyIndex = -1;
let navigationAnimation = null;
let isNavigating = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeBrowser();
    loadInitialStructure();
    setupKeyboardShortcuts();
    setupEnhancedFeatures();
});

function initializeBrowser() {
    checkAuthStatus();
    updateMaxVisibleColumns();
    window.addEventListener('resize', updateMaxVisibleColumns);
    
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
        maxVisibleColumns = 3;
    } else if (screenWidth < 1024) {
        maxVisibleColumns = 4;
    } else if (screenWidth < 1400) {
        maxVisibleColumns = 5;
    } else if (screenWidth < 1920) {
        maxVisibleColumns = 6;
    } else {
        maxVisibleColumns = 7;
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only handle browser navigation shortcuts when file preview is not visible
        if (dcCodexFilePreview && dcCodexFilePreview.isModalVisible) {
            return;
        }
        
        handleBrowserKeyboard(e);
    });
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
        
        // Get all files in the current folder for the file navigation sidebar
        const currentFolderFiles = [];
        const folderPath = item.path.substring(0, item.path.lastIndexOf('/'));
        
        // Find the folder column that contains this file
        const folderColumn = columns[columnIndex];
        if (folderColumn && folderColumn.items) {
            // Filter to only include files (not folders) and sort them
            folderColumn.items.forEach(folderItem => {
                if (folderItem.type === 'file') {
                    currentFolderFiles.push(folderItem);
                }
            });
            
            // Sort files by name
            currentFolderFiles.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // Use the file preview module to show the file with folder context
        if (dcCodexFilePreview) {
            if (currentFolderFiles.length > 0) {
                dcCodexFilePreview.showFileFromFolder(item, folderPath, currentFolderFiles);
            } else {
                // Fallback to simple file preview if no folder context
                dcCodexFilePreview.showFile(item);
            }
        } else {
            console.error('DC Codex: File preview module not loaded');
        }
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