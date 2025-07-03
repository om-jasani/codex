// DC Codex - Enhanced Internal Code Search System
// Professional file preview with advanced IDE-like features

const API_BASE = '/api';
let currentUser = null;
let currentResults = [];
let currentPage = 1;
let currentFileId = null;
let currentSort = 'relevance';
let currentModalFile = null;
let currentTheme = 'light';
let currentFontSize = 14;
let searchTerm = '';
let searchResults = [];
let currentSearchIndex = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProjects();
    setupEventListeners();
    initializeTheme();
    
    // Check if user is coming from a search
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        document.getElementById('searchInput').value = searchQuery;
        performSearch();
    }
});

function initializeTheme() {
    currentTheme = localStorage.getItem('codexTheme') || 'light';
    currentFontSize = parseInt(localStorage.getItem('codexFontSize')) || 14;
}

// Setup all event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsDiv = document.getElementById('suggestions');
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Auto-suggestions with debounce
    let suggestionTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(suggestionTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        suggestionTimeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-container')) {
            suggestionsDiv.style.display = 'none';
        }
    });
    
    // Setup modal keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyboard);
    
    // Close modal when clicking outside
    const modal = document.getElementById('fileModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
}

function handleGlobalKeyboard(e) {
    const modal = document.getElementById('fileModal');
    
    if (modal && modal.style.display === 'block') {
        handleModalKeyboard(e);
    } else {
        // Global shortcuts when not in modal
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'k':
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
            }
        }
    }
}

function handleModalKeyboard(e) {
    switch(e.key) {
        case 'Escape':
            e.preventDefault();
            closeModal();
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
            

            
        case 'c':
            if (e.ctrlKey || e.metaKey && e.shiftKey) {
                e.preventDefault();
                copyAllContent();
            }
            break;
    }
}

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = await response.json();
            updateUserInterface();
        } else {
            currentUser = null;
            updateUserInterface();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        updateUserInterface();
    }
}

// Update UI based on user authentication status
function updateUserInterface() {
    const userInfo = document.getElementById('userInfo');
    const loginLink = document.getElementById('loginLink');
    const adminLink = document.getElementById('adminLink');
    const username = document.getElementById('username');
    
    if (currentUser) {
        userInfo.style.display = 'flex';
        loginLink.style.display = 'none';
        username.textContent = currentUser.full_name || currentUser.username;
        
        if (currentUser.role === 'admin') {
            adminLink.style.display = 'flex';
        }
    } else {
        userInfo.style.display = 'none';
        loginLink.style.display = 'flex';
        adminLink.style.display = 'none';
    }
}

// Perform search
async function performSearch(page = 1) {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'warning');
        return;
    }
    
    currentPage = page;
    const projectFilter = document.getElementById('projectFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    
    showLoading(true);
    hideResults();
    
    const params = new URLSearchParams({
        q: query,
        page: page
    });
    
    if (projectFilter) params.append('project', projectFilter);
    if (typeFilter) params.append('filetype', typeFilter);
    
    try {
        const response = await fetch(`${API_BASE}/search?${params}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentResults = data.results;
            displayResults(data);
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('q', query);
            window.history.pushState({}, '', newUrl);
        } else {
            showToast('Search failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Display search results
function displayResults(data) {
    const resultsSection = document.getElementById('resultsSection');
    const searchResults = document.getElementById('searchResults');
    const resultCount = document.getElementById('resultCount');
    const noResults = document.getElementById('noResults');
    
    if (data.results.length === 0) {
        resultsSection.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    noResults.style.display = 'none';
    resultsSection.style.display = 'block';
    resultCount.textContent = data.total;
    
    let results = [...data.results];
    if (currentSort !== 'relevance') {
        results = sortResultsArray(results, currentSort);
    }
    
    searchResults.innerHTML = results.map(file => `
        <div class="result-item" onclick="viewFile(${file.id})">
            <div class="result-header">
                <h3 class="result-title">
                    <i class="${getFileIcon(file.filetype)} file-type-icon"></i>
                    <span class="file-name">${escapeHtml(file.filename)}</span>
                    <span class="file-extension">${getFileExtension(file.filename).toUpperCase()}</span>
                </h3>
                <div class="result-meta">
                    <span class="meta-item">
                        <i class="fas fa-folder"></i> 
                        ${escapeHtml(file.project || 'No Project')}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-code"></i> 
                        ${file.line_count || 0} lines
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-hdd"></i> 
                        ${formatFileSize(file.size)}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-clock"></i> 
                        ${file.modified_date ? new Date(file.modified_date).toLocaleDateString() : 'Unknown'}
                    </span>
                </div>
            </div>
            <div class="result-path">
                <i class="fas fa-folder-open"></i>
                ${escapeHtml(file.filepath)}
            </div>
            ${file.description ? `<p class="result-description">${escapeHtml(file.description)}</p>` : ''}
            <div class="result-tags">
                ${file.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        </div>
    `).join('');
    
    displayPagination(data);
}

// Sort results array
function sortResultsArray(results, sortBy) {
    const sortedResults = [...results];
    
    switch(sortBy) {
        case 'name':
            sortedResults.sort((a, b) => a.filename.localeCompare(b.filename));
            break;
        case 'modified':
            sortedResults.sort((a, b) => {
                const dateA = a.modified_date ? new Date(a.modified_date) : new Date(0);
                const dateB = b.modified_date ? new Date(b.modified_date) : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'size':
            sortedResults.sort((a, b) => (b.size || 0) - (a.size || 0));
            break;
    }
    
    return sortedResults;
}

// Sort results when dropdown changes
function sortResults() {
    const sortBy = document.getElementById('sortBy').value;
    currentSort = sortBy;
    
    if (currentResults.length > 0) {
        const sortedResults = sortResultsArray(currentResults, sortBy);
        const searchResults = document.getElementById('searchResults');
        
        searchResults.innerHTML = sortedResults.map(file => `
            <div class="result-item" onclick="viewFile(${file.id})">
                <div class="result-header">
                    <h3 class="result-title">
                        <i class="${getFileIcon(file.filetype)} file-type-icon"></i>
                        <span class="file-name">${escapeHtml(file.filename)}</span>
                        <span class="file-extension">${getFileExtension(file.filename).toUpperCase()}</span>
                    </h3>
                    <div class="result-meta">
                        <span class="meta-item">
                            <i class="fas fa-folder"></i> 
                            ${escapeHtml(file.project || 'No Project')}
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-code"></i> 
                            ${file.line_count || 0} lines
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-hdd"></i> 
                            ${formatFileSize(file.size)}
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-clock"></i> 
                            ${file.modified_date ? new Date(file.modified_date).toLocaleDateString() : 'Unknown'}
                        </span>
                    </div>
                </div>
                <div class="result-path">
                    <i class="fas fa-folder-open"></i>
                    ${escapeHtml(file.filepath)}
                </div>
                ${file.description ? `<p class="result-description">${escapeHtml(file.description)}</p>` : ''}
                <div class="result-tags">
                    ${file.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }
}

// Display pagination
function displayPagination(data) {
    const pagination = document.getElementById('pagination');
    const pages = [];
    
    if (data.page > 1) {
        pages.push(`<button class="page-btn" onclick="performSearch(${data.page - 1})">
            <i class="fas fa-chevron-left"></i> Previous
        </button>`);
    }
    
    const maxPages = 5;
    const halfPages = Math.floor(maxPages / 2);
    let startPage = Math.max(1, data.page - halfPages);
    let endPage = Math.min(data.pages, startPage + maxPages - 1);
    
    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    if (startPage > 1) {
        pages.push(`<button class="page-btn" onclick="performSearch(1)">1</button>`);
        if (startPage > 2) {
            pages.push(`<span class="page-ellipsis">...</span>`);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages.push(`<button class="page-btn ${i === data.page ? 'active' : ''}" 
                            onclick="performSearch(${i})">${i}</button>`);
    }
    
    if (endPage < data.pages) {
        if (endPage < data.pages - 1) {
            pages.push(`<span class="page-ellipsis">...</span>`);
        }
        pages.push(`<button class="page-btn" onclick="performSearch(${data.pages})">${data.pages}</button>`);
    }
    
    if (data.page < data.pages) {
        pages.push(`<button class="page-btn" onclick="performSearch(${data.page + 1})">
            Next <i class="fas fa-chevron-right"></i>
        </button>`);
    }
    
    pagination.innerHTML = pages.join('');
}

// Fetch search suggestions
async function fetchSuggestions(query) {
    try {
        const response = await fetch(`${API_BASE}/search/suggestions?q=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displaySuggestions(data.suggestions);
        }
    } catch (error) {
        console.error('Suggestions error:', error);
    }
}

// Display search suggestions
function displaySuggestions(suggestions) {
    const suggestionsDiv = document.getElementById('suggestions');
    
    if (!suggestions || suggestions.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = suggestions.map(suggestion => `
        <div class="suggestion-item" onclick="selectSuggestion('${escapeHtml(suggestion)}')">
            <i class="fas fa-search suggestion-icon"></i>
            <span>${escapeHtml(suggestion)}</span>
        </div>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
}

// Select a suggestion
function selectSuggestion(suggestion) {
    document.getElementById('searchInput').value = suggestion;
    document.getElementById('suggestions').style.display = 'none';
    performSearch();
}

// Enhanced file viewer
async function viewFile(fileId) {
    currentFileId = fileId;
    currentModalFile = null;
    
    const modal = document.getElementById('fileModal');
    
    // Show modal immediately with loading state
    modal.style.display = 'block';
    showModalLoading();
    
    try {
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load file details');
        }
        
        const file = await response.json();
        currentModalFile = file;
        
        // Update modal with file details
        updateModalContent(file);
        
        // Try to fetch file content
        try {
            const contentResponse = await fetch(`${API_BASE}/files/${fileId}/content`, {
                credentials: 'include'
            });
            
            if (contentResponse.ok) {
                const contentData = await contentResponse.json();
                renderModalFileContent(file, contentData);
            } else {
                showModalError('Unable to load file content');
            }
        } catch (contentError) {
            showModalError('Failed to load file content');
        }
        
    } catch (error) {
        console.error('View file error:', error);
        showToast('Failed to load file details', 'error');
        closeModal();
    }
}

function showModalLoading() {
    const modal = document.getElementById('fileModal');
    modal.innerHTML = `
        <div class="modal-content" data-theme="${currentTheme}">
            <div class="modal-header">
                <div class="modal-title">
                    <div class="file-icon">
                        <i class="fas fa-file"></i>
                    </div>
                    <h2>Loading...</h2>
                </div>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="file-preview-loading">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                    <h3>Loading file content...</h3>
                    <p>Please wait while we fetch the file details.</p>
                </div>
            </div>
        </div>
    `;
}

function updateModalContent(file) {
    const modal = document.getElementById('fileModal');
    const icon = getFileIconWithColor(file.filename);
    const fileSize = file.size ? formatFileSize(file.size) : 'Unknown';
    const fileType = getFileExtension(file.filename).toUpperCase() || 'FILE';
    const lastModified = file.modified_date ? 
        new Date(file.modified_date).toLocaleDateString() : 'Unknown';
    
    modal.innerHTML = `
        <div class="modal-content" data-theme="${currentTheme}">
            <div class="modal-header">
                <div class="modal-title">
                    <div class="file-icon" style="color: ${icon.color}">
                        <i class="${icon.class}"></i>
                    </div>
                    <h2>${escapeHtml(file.filename)}</h2>
                </div>
                <div class="modal-controls">
                    <div class="keyboard-shortcuts">
                        <span class="shortcut-group">
                            <kbd>Ctrl</kbd>+<kbd>F</kbd> Search
                        </span>
                        <span class="shortcut-group">
                            <kbd>F11</kbd> Fullscreen
                        </span>
                        <span class="shortcut-group">
                            <kbd>Esc</kbd> Close
                        </span>
                    </div>
                    <button class="modal-close" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="modal-body">
                <div class="modal-sidebar">
                    <div class="file-info-section">
                        <h3>File Information</h3>
                        <div class="file-meta-grid">
                            <div class="file-meta-item">
                                <span class="file-meta-label">Name</span>
                                <span class="file-meta-value" title="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</span>
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
                                <span class="file-meta-label">Lines</span>
                                <span class="file-meta-value">${file.line_count || 0}</span>
                            </div>
                            <div class="file-meta-item">
                                <span class="file-meta-label">Modified</span>
                                <span class="file-meta-value">${lastModified}</span>
                            </div>
                            <div class="file-meta-item">
                                <span class="file-meta-label">Project</span>
                                <span class="file-meta-value">${escapeHtml(file.project || 'No Project')}</span>
                            </div>
                            <div class="file-meta-item">
                                <span class="file-meta-label">Path</span>
                                <span class="file-meta-value" title="${escapeHtml(file.filepath)}">${escapeHtml(file.filepath)}</span>
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
                                <label>Theme</label>
                                <div class="theme-buttons">
                                    <button class="control-btn ${currentTheme === 'light' ? 'active' : ''}" onclick="setTheme('light')" title="Light theme">
                                        <i class="fas fa-sun"></i>
                                    </button>
                                    <button class="control-btn ${currentTheme === 'dark' ? 'active' : ''}" onclick="setTheme('dark')" title="Dark theme">
                                        <i class="fas fa-moon"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="control-group">
                                <label>Font Size</label>
                                <div class="font-controls">
                                    <button class="control-btn" onclick="decreaseFontSize()" title="Decrease font size">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span class="font-size-display">${currentFontSize}px</span>
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
                        <h3>Keyboard Shortcuts</h3>
                        <div class="shortcuts-list">
                            <div class="shortcut-item">
                                <span class="shortcut-key">Ctrl+C</span>
                                <span class="shortcut-desc">Copy content</span>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-key">Ctrl+F</span>
                                <span class="shortcut-desc">Search in file</span>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-key">F11</span>
                                <span class="shortcut-desc">Toggle fullscreen</span>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-key">Esc</span>
                                <span class="shortcut-desc">Close modal</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-main" id="modalMainContent">
                    <div class="file-preview-loading">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                        </div>
                        <h3>Loading file content...</h3>
                        <p>Please wait while we fetch the file content.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderModalFileContent(file, fileData) {
    const mainContent = document.getElementById('modalMainContent');
    if (!mainContent) return;
    
    if (fileData.type === 'image') {
        mainContent.innerHTML = `
            <div class="file-content-wrapper image-wrapper">
                <div class="image-preview">
                    <img src="${fileData.content}" alt="${escapeHtml(file.filename)}" loading="lazy">
                </div>
            </div>
        `;
    } else if (fileData.type === 'pdf') {
        const inlineUrl = fileData.inline_url;
        mainContent.innerHTML = `
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
        renderCodeContent(file, fileData, mainContent);
    } else {
        showModalError('Preview not available for this file type');
    }
}

function renderCodeContent(file, fileData, container) {
    let content = fileData.content || '';
    
    if (!content) {
        showModalError('No content available - the file appears to be empty');
        return;
    }
    
    // Format JSON and XML for better readability
    const ext = getFileExtension(file.filename);
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
    const lineNumbers = lines.map((_, i) => (i + 1).toString()).join('\n');
    
    container.innerHTML = `
        <div class="file-content-wrapper code-wrapper" data-theme="${currentTheme}">
            <div class="code-header">
                <div class="code-title">
                    <i class="${getFileIconWithColor(file.filename).class}"></i>
                    <span>${escapeHtml(file.filename)}</span>
                    <span class="line-count">${lines.length} lines</span>
                </div>
                <div class="code-actions">
                    <button class="code-action-btn" onclick="copyAllContent()" title="Copy all content">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="code-action-btn" onclick="openSearch()" title="Search in file">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="code-action-btn" onclick="toggleWrap()" title="Toggle word wrap">
                        <i class="fas fa-align-left"></i>
                    </button>
                </div>
            </div>
            
            <div class="search-bar" id="searchBar" style="display: none;">
                <div class="search-input-group">
                    <input type="text" id="searchInput" placeholder="Search in file..." onkeyup="searchInFile(event)">
                    <button onclick="findNext()" title="Find next (Enter)">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button onclick="findPrevious()" title="Find previous (Shift+Enter)">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <span class="search-results" id="searchResults"></span>
                    <button onclick="closeSearch()" title="Close search (Escape)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="code-content" id="codeContent">
                <div class="line-numbers" id="lineNumbers">${lineNumbers}</div>
                <div class="code-scroll-container">
                    <pre class="code-display" id="codeDisplay"><code id="codeText" class="${getPrismLanguage(`.${ext}`)}" style="font-size: ${currentFontSize}px;">${escapeHtml(content)}</code></pre>
                </div>
            </div>
        </div>
    `;
    
    // Apply syntax highlighting
    setTimeout(() => {
        if (window.Prism) {
            const codeElement = container.querySelector('#codeText');
            if (codeElement) {
                try {
                    Prism.highlightElement(codeElement);
                } catch (e) {
                    console.warn('Syntax highlighting failed:', e);
                }
            }
        }
        
        // Sync scroll between line numbers and code
        setupScrollSync();
        
        // Apply theme
        applyCodeTheme();
        
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

function showModalError(message) {
    const mainContent = document.getElementById('modalMainContent');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <div class="file-content-wrapper">
            <div class="file-preview-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to load file</h3>
                <p>${escapeHtml(message)}</p>
                <button class="retry-btn" onclick="viewFile(${currentFileId})">
                    <i class="fas fa-refresh"></i>
                    Try Again
                </button>
            </div>
        </div>
    `;
}

// Theme management
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('codexTheme', theme);
    
    // Update UI
    document.querySelectorAll('.theme-buttons .control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`.theme-buttons .control-btn[onclick="setTheme('${theme}')"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    // Update modal theme
    const modalContent = document.querySelector('.enhanced-modal');
    if (modalContent) {
        modalContent.setAttribute('data-theme', theme);
    }
    
    applyCodeTheme();
}

function applyCodeTheme() {
    const wrapper = document.querySelector('.code-wrapper');
    if (wrapper) {
        wrapper.setAttribute('data-theme', currentTheme);
    }
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
    
    const codeText = document.getElementById('codeText');
    const lineNumbers = document.getElementById('lineNumbers');
    const fontDisplay = document.querySelector('.font-size-display');
    
    if (codeText) codeText.style.fontSize = currentFontSize + 'px';
    if (lineNumbers) lineNumbers.style.fontSize = currentFontSize + 'px';
    if (fontDisplay) fontDisplay.textContent = currentFontSize + 'px';
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
        if (event.shiftKey) {
            findPrevious();
        } else {
            findNext();
        }
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
    
    performFileSearch(query);
}

function performFileSearch(query) {
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
    updateSearchResults(searchResults.length, searchResults.length > 0 ? 1 : 0);
    
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
    // Simple implementation - in production, you'd want more sophisticated highlighting
    updateSearchResultsVisual();
}

function updateSearchResultsVisual() {
    // This would update visual highlights in the code
    // For now, we'll just update the results counter
}

function clearSearchHighlights() {
    searchResults = [];
    currentSearchIndex = 0;
    updateSearchResults(0, 0);
}

function updateSearchResults(total, current) {
    const resultsDisplay = document.getElementById('searchResults');
    if (resultsDisplay) {
        if (total === 0) {
            resultsDisplay.textContent = 'No results';
            resultsDisplay.className = 'search-results no-results';
        } else {
            resultsDisplay.textContent = `${current} of ${total}`;
            resultsDisplay.className = 'search-results has-results';
        }
    }
}

function scrollToSearchResult(index) {
    // This would scroll to the specific search result
    // Implementation depends on how search highlighting is done
}

// Word wrap toggle
function toggleWrap() {
    const codeDisplay = document.getElementById('codeDisplay');
    const wrapBtn = document.querySelector('.code-action-btn[onclick="toggleWrap()"]');
    
    if (codeDisplay && wrapBtn) {
        const isWrapped = codeDisplay.classList.contains('wrapped');
        
        if (isWrapped) {
            codeDisplay.classList.remove('wrapped');
            codeDisplay.style.whiteSpace = 'pre';
            wrapBtn.title = 'Enable word wrap';
            wrapBtn.querySelector('i').className = 'fas fa-align-left';
        } else {
            codeDisplay.classList.add('wrapped');
            codeDisplay.style.whiteSpace = 'pre-wrap';
            wrapBtn.title = 'Disable word wrap';
            wrapBtn.querySelector('i').className = 'fas fa-align-justify';
        }
    }
}

// File actions
function copyAllContent() {
    const codeText = document.getElementById('codeText');
    if (codeText) {
        copyToClipboard(codeText.textContent, 'File content copied to clipboard');
    } else {
        showToast('No content available to copy', 'warning');
    }
}

function toggleFullscreen() {
    const modal = document.getElementById('fileModal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.modal-content');
    const btn = document.querySelector('button[onclick="toggleFullscreen()"]');
    
    if (modalContent && btn) {
        const isFullscreen = modalContent.classList.contains('fullscreen');
        
        if (isFullscreen) {
            modalContent.classList.remove('fullscreen');
            btn.title = 'Enter fullscreen';
            btn.querySelector('i').className = 'fas fa-expand';
        } else {
            modalContent.classList.add('fullscreen');
            btn.title = 'Exit fullscreen';
            btn.querySelector('i').className = 'fas fa-compress';
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
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast(successMessage, 'success');
    } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Close modal
function closeModal() {
    const modal = document.getElementById('fileModal');
    if (modal) {
        modal.style.display = 'none';
        currentFileId = null;
        currentModalFile = null;
    }
}

// Load projects for filter
async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/admin/projects`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const projects = await response.json();
            const projectFilter = document.getElementById('projectFilter');
            
            projectFilter.innerHTML = '<option value="">All Projects</option>';
            
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = `${project.name} (${project.file_count} files)`;
                projectFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Load projects error:', error);
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('projectFilter').value = '';
    document.getElementById('typeFilter').value = '';
    
    if (document.getElementById('resultsSection').style.display !== 'none') {
        performSearch(currentPage);
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, { 
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

// Show loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Hide results
function hideResults() {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                          type === 'warning' ? 'exclamation-triangle' : 
                          type === 'success' ? 'check-circle' : 'info-circle'}"></i>
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

// Utility Functions
function getFileIcon(filetype) {
    const iconMap = {
        '.py': 'fab fa-python',
        '.js': 'fab fa-js-square',
        '.java': 'fab fa-java',
        '.c': 'fas fa-file-code',
        '.cpp': 'fas fa-file-code',
        '.h': 'fas fa-file-code',
        '.cs': 'fas fa-file-code',
        '.php': 'fab fa-php',
        '.rb': 'fas fa-gem',
        '.go': 'fas fa-file-code',
        '.rs': 'fas fa-file-code',
        '.swift': 'fas fa-file-code',
        '.kt': 'fas fa-file-code',
        '.ino': 'fas fa-microchip',
        '.html': 'fab fa-html5',
        '.css': 'fab fa-css3-alt',
        '.sql': 'fas fa-database',
        '.json': 'fas fa-file-code',
        '.xml': 'fas fa-file-code',
        '.yaml': 'fas fa-file-code',
        '.yml': 'fas fa-file-code',
        '.md': 'fab fa-markdown',
        '.txt': 'fas fa-file-alt'
    };
    
    return iconMap[filetype] || 'fas fa-file';
}

function getFileIconWithColor(filename) {
    const extension = getFileExtension(filename).toLowerCase();
    
    const iconMap = {
        'py': { class: 'fab fa-python', color: '#3776ab' },
        'js': { class: 'fab fa-js-square', color: '#f7df1e' },
        'ts': { class: 'fab fa-js-square', color: '#3178c6' },
        'html': { class: 'fab fa-html5', color: '#e34f26' },
        'css': { class: 'fab fa-css3-alt', color: '#1572b6' },
        'java': { class: 'fab fa-java', color: '#ed8b00' },
        'c': { class: 'fas fa-file-code', color: '#00599c' },
        'cpp': { class: 'fas fa-file-code', color: '#00599c' },
        'h': { class: 'fas fa-file-code', color: '#00599c' },
        'cs': { class: 'fas fa-file-code', color: '#239120' },
        'php': { class: 'fab fa-php', color: '#777bb4' },
        'rb': { class: 'fas fa-gem', color: '#cc342d' },
        'go': { class: 'fas fa-file-code', color: '#00add8' },
        'rs': { class: 'fas fa-file-code', color: '#000000' },
        'swift': { class: 'fas fa-file-code', color: '#fa7343' },
        'kt': { class: 'fas fa-file-code', color: '#7f52ff' },
        'ino': { class: 'fas fa-microchip', color: '#00979d' },
        'json': { class: 'fas fa-file-code', color: '#000000' },
        'xml': { class: 'fas fa-file-code', color: '#e34f26' },
        'sql': { class: 'fas fa-database', color: '#336791' },
        'md': { class: 'fab fa-markdown', color: '#000000' },
        'txt': { class: 'fas fa-file-alt', color: '#64748b' },
        'pdf': { class: 'fas fa-file-pdf', color: '#dc2626' },
        'jpg': { class: 'fas fa-file-image', color: '#059669' },
        'jpeg': { class: 'fas fa-file-image', color: '#059669' },
        'png': { class: 'fas fa-file-image', color: '#059669' },
        'gif': { class: 'fas fa-file-image', color: '#059669' },
        'svg': { class: 'fas fa-file-image', color: '#059669' }
    };
    
    return iconMap[extension] || { class: 'fas fa-file', color: '#64748b' };
}

function getFileExtension(filename) {
    const ext = filename.split('.').pop();
    return ext === filename ? '' : ext;
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

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
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