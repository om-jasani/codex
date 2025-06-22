// Codex - Internal Code Search System
// Complete Frontend JavaScript with All Features

const API_BASE = '/api';
let currentUser = null;
let currentResults = [];
let currentPage = 1;
let currentFileId = null;
let currentSort = 'relevance';

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
    
    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('fileModal').style.display === 'block') {
            closeModal();
        }
    });
    
    // Close modal when clicking outside
    document.getElementById('fileModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
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
            // User not logged in
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
        // User is logged in
        userInfo.style.display = 'flex';
        loginLink.style.display = 'none';
        username.textContent = currentUser.full_name || currentUser.username;
        
        // Show admin link if user is admin
        if (currentUser.role === 'admin') {
            adminLink.style.display = 'flex';
        }
    } else {
        // User is not logged in
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
        showMessage('Please enter a search query', 'warning');
        return;
    }
    
    currentPage = page;
    const projectFilter = document.getElementById('projectFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    
    // Show loading spinner
    showLoading(true);
    hideResults();
    
    // Build query parameters
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
            // Update URL without reloading
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('q', query);
            window.history.pushState({}, '', newUrl);
        } else {
            showMessage('Search failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Search error:', error);
        showMessage('Search failed. Please try again.', 'error');
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
    
    // Sort results if needed
    let results = [...data.results];
    if (currentSort !== 'relevance') {
        results = sortResultsArray(results, currentSort);
    }
    
    searchResults.innerHTML = results.map(file => `
        <div class="result-item" onclick="viewFile(${file.id})">
            <div class="result-header">
                <h3 class="result-title">
                    <i class="${getFileIcon(file.filetype)} file-type-icon"></i>
                    ${escapeHtml(file.filename)}
                </h3>
                <div class="result-meta">
                    <span><i class="fas fa-folder"></i> ${escapeHtml(file.project || 'No Project')}</span>
                    <span><i class="fas fa-code"></i> ${file.line_count || 0} lines</span>
                    <span><i class="fas fa-hdd"></i> ${formatFileSize(file.size)}</span>
                </div>
            </div>
            <div class="result-path">${escapeHtml(file.filepath)}</div>
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
                        ${escapeHtml(file.filename)}
                    </h3>
                    <div class="result-meta">
                        <span><i class="fas fa-folder"></i> ${escapeHtml(file.project || 'No Project')}</span>
                        <span><i class="fas fa-code"></i> ${file.line_count || 0} lines</span>
                        <span><i class="fas fa-hdd"></i> ${formatFileSize(file.size)}</span>
                    </div>
                </div>
                <div class="result-path">${escapeHtml(file.filepath)}</div>
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
    
    // Previous button
    if (data.page > 1) {
        pages.push(`<button class="page-btn" onclick="performSearch(${data.page - 1})">
            <i class="fas fa-chevron-left"></i> Previous
        </button>`);
    }
    
    // Page numbers
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
            pages.push(`<span>...</span>`);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages.push(`<button class="page-btn ${i === data.page ? 'active' : ''}" 
                            onclick="performSearch(${i})">${i}</button>`);
    }
    
    if (endPage < data.pages) {
        if (endPage < data.pages - 1) {
            pages.push(`<span>...</span>`);
        }
        pages.push(`<button class="page-btn" onclick="performSearch(${data.pages})">${data.pages}</button>`);
    }
    
    // Next button
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
            ${escapeHtml(suggestion)}
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

// View file details
async function viewFile(fileId) {
    currentFileId = fileId;
    const modal = document.getElementById('fileModal');
    const codeContainer = document.getElementById('codeContainer');
    const fileError = document.getElementById('fileError');
    
    // Show modal immediately with loading state
    modal.style.display = 'block';
    codeContainer.style.display = 'none';
    fileError.style.display = 'none';
    
    try {
        // Fetch file details
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load file details');
        }
        
        const file = await response.json();
        
        // Update modal with file details
        document.getElementById('modalFileName').textContent = file.filename;
        document.getElementById('modalProject').textContent = file.project || 'No Project';
        document.getElementById('modalModified').textContent = file.modified_date ? 
            new Date(file.modified_date).toLocaleDateString() : 'Unknown';
        document.getElementById('modalLines').textContent = file.line_count || 0;
        document.getElementById('modalPath').textContent = file.filepath;
        
        // Try to fetch file content
        try {
            const contentResponse = await fetch(`${API_BASE}/files/${fileId}/content`, {
                credentials: 'include'
            });
            
            if (contentResponse.ok) {
                const contentData = await contentResponse.json();
                
                // Display code with syntax highlighting
                const codeElement = document.querySelector('#codePreview code');
                codeElement.textContent = contentData.content || '// Empty file';
                codeElement.className = getPrismLanguage(file.filetype);
                
                // Re-run Prism highlighting
                if (window.Prism) {
                    Prism.highlightElement(codeElement);
                }
                
                codeContainer.style.display = 'block';
            } else {
                // Show error message
                fileError.style.display = 'block';
                codeContainer.style.display = 'none';
            }
        } catch (contentError) {
            // Show error message
            fileError.style.display = 'block';
            codeContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('View file error:', error);
        showMessage('Failed to load file details', 'error');
        closeModal();
    }
}

// Close modal
function closeModal() {
    document.getElementById('fileModal').style.display = 'none';
    currentFileId = null;
}

// Download file
function downloadFile() {
    if (!currentFileId) return;
    
    // Create a form to submit the download request
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = `${API_BASE}/files/${currentFileId}/download`;
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

// Copy file path to clipboard
function copyFilePath() {
    const filePath = document.getElementById('modalPath').textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(filePath).then(() => {
            showMessage('File path copied to clipboard', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(filePath);
        });
    } else {
        fallbackCopyToClipboard(filePath);
    }
}

// Fallback clipboard copy
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showMessage('File path copied to clipboard', 'success');
    } catch (err) {
        showMessage('Failed to copy path', 'error');
    }
    
    document.body.removeChild(textArea);
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
            
            // Clear existing options except the first one
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
    
    // Re-run search if there are results
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
        // Force redirect anyway
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

// Show message
function showMessage(message, type = 'info') {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                          type === 'warning' ? 'exclamation-triangle' : 
                          type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${escapeHtml(message)}
    `;
    
    // Add styles
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: ${type === 'error' ? '#ef4444' : 
                            type === 'warning' ? '#f59e0b' : 
                            type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
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

function getPrismLanguage(filetype) {
    const langMap = {
        '.py': 'language-python',
        '.js': 'language-javascript',
        '.java': 'language-java',
        '.c': 'language-c',
        '.cpp': 'language-cpp',
        '.h': 'language-c',
        '.cs': 'language-csharp',
        '.php': 'language-php',
        '.rb': 'language-ruby',
        '.go': 'language-go',
        '.rs': 'language-rust',
        '.swift': 'language-swift',
        '.kt': 'language-kotlin',
        '.html': 'language-html',
        '.css': 'language-css',
        '.sql': 'language-sql',
        '.json': 'language-json',
        '.xml': 'language-xml',
        '.yaml': 'language-yaml',
        '.yml': 'language-yaml',
        '.md': 'language-markdown',
        '.ino': 'language-arduino'
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

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
