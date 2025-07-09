// DC Codex - Enhanced Internal Code Search System
// Integrated with the new file preview module

const API_BASE = '/api';
let currentUser = null;
let currentResults = [];
let currentPage = 1;
let currentSort = 'relevance';
let currentSearchQuery = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProjects();
    setupEventListeners();
    
    // Check if user is coming from a search
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        document.getElementById('searchInput').value = searchQuery;
        performSearch();
    }
});

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
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Global shortcuts when not in modal
        if (!dcCodexFilePreview || !dcCodexFilePreview.isModalVisible) {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'k':
                        e.preventDefault();
                        document.getElementById('searchInput').focus();
                        break;
                }
            }
        }
    });
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
    currentSearchQuery = query;
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
    const searchSection = document.querySelector('.search-section');
    
    // Add compact class to search section when showing results
    searchSection.classList.add('compact');
    
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
    
    searchResults.innerHTML = results.map((file, index) => `
        <div class="result-item search-result" 
             data-file-id="${file.id}"
             data-file-index="${index}"
             data-file-name="${escapeHtml(file.filename)}"
             data-file-path="${escapeHtml(file.filepath)}"
             data-file-size="${file.size || 0}"
             onclick="viewFileFromSearch(${file.id}, ${index})">
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
        
        searchResults.innerHTML = sortedResults.map((file, index) => `
            <div class="result-item search-result" 
                 data-file-id="${file.id}"
                 data-file-index="${index}"
                 data-file-name="${escapeHtml(file.filename)}"
                 data-file-path="${escapeHtml(file.filepath)}"
                 data-file-size="${file.size || 0}"
                 onclick="viewFileFromSearch(${file.id}, ${index})">
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

// View file from search results using the new file preview module
async function viewFileFromSearch(fileId, resultIndex) {
    try {
        // First, fetch the file details
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load file details');
        }
        
        const fileData = await response.json();
        
        // Prepare the file object for the preview module
        const file = {
            id: fileData.id,
            name: fileData.filename,
            path: fileData.filepath,
            type: 'file',
            size: fileData.size || 0,
            modified_date: fileData.modified_date,
            line_count: fileData.line_count,
            project: fileData.project
        };
        
        // Convert current search results to the format expected by the file preview module
        const searchFiles = currentResults.map(result => ({
            id: result.id,
            name: result.filename,
            path: result.filepath,
            type: 'file',
            size: result.size || 0,
            modified_date: result.modified_date,
            line_count: result.line_count,
            project: result.project
        }));
        
        // Use the file preview module to show the file with search context
        if (dcCodexFilePreview) {
            // Override the API endpoint for file content
            const originalShowFile = dcCodexFilePreview.showFile;
            dcCodexFilePreview.showFile = async function(file, context) {
                // Temporarily override to use our file ID endpoint
                const originalApiBase = this.options.apiBase;
                this.currentFile = file;
                this.currentContext = context;
                
                try {
                    // Show loading state
                    this.showModal(file, null, true);
                    
                    // Fetch file content using the file ID
                    const contentResponse = await fetch(`${API_BASE}/files/${file.id}/content`, {
                        credentials: 'include'
                    });
                    
                    if (contentResponse.ok) {
                        const contentData = await contentResponse.json();
                        // Transform the response to match expected format
                        const transformedData = {
                            success: true,
                            content: contentData.content,
                            type: contentData.type || 'text',
                            size: file.size,
                            modified: file.modified_date
                        };
                        this.showModal(file, transformedData, false);
                    } else {
                        this.showModal(file, { error: 'Failed to load file content' }, false);
                    }
                } catch (error) {
                    console.error('Error loading file:', error);
                    this.showModal(file, { error: 'Failed to connect to server' }, false);
                }
                
                // Restore original API base
                this.options.apiBase = originalApiBase;
            };
            
            dcCodexFilePreview.showFileFromSearch(file, searchFiles, currentSearchQuery);
            
            // Restore original method
            dcCodexFilePreview.showFile = originalShowFile;
        } else {
            console.error('File preview module not loaded');
            showToast('Failed to open file preview', 'error');
        }
    } catch (error) {
        console.error('View file error:', error);
        showToast('Failed to load file details', 'error');
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
    const searchSection = document.querySelector('.search-section');
    
    // Remove compact class when hiding results to restore original size
    searchSection.classList.remove('compact');
    
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

function getFileExtension(filename) {
    const ext = filename.split('.').pop();
    return ext === filename ? '' : ext;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
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