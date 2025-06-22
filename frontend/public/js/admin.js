// Codex Admin Panel JavaScript - Complete Implementation

const API_BASE = '/api';
let currentSection = 'dashboard';
let currentUser = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    setupEventListeners();
    showSection('dashboard');
});

// Check admin authentication
async function checkAdminAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = await response.json();
        
        if (currentUser.role !== 'admin') {
            alert('Admin access required');
            window.location.href = '/';
            return;
        }
        
        // Update UI with user info
        updateAdminUI();
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Update admin UI
function updateAdminUI() {
    const adminName = document.getElementById('adminName');
    if (adminName) {
        adminName.textContent = currentUser.full_name || currentUser.username;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    }
    
    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// Show section
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Remove active class from nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    // Add active class to nav item
    const navItem = document.querySelector(`[onclick="showSection('${section}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    currentSection = section;
    
    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'files':
            loadFiles();
            break;
        case 'projects':
            loadProjects();
            break;
        case 'tags':
            loadTags();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get various statistics
        const [filesResponse, projectsResponse, tagsResponse, searchLogsResponse] = await Promise.all([
            fetch(`${API_BASE}/admin/stats/files`, { credentials: 'include' }),
            fetch(`${API_BASE}/admin/projects`, { credentials: 'include' }),
            fetch(`${API_BASE}/admin/tags`, { credentials: 'include' }),
            fetch(`${API_BASE}/admin/stats/searches`, { credentials: 'include' })
        ]);
        
        // Files count
        if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            document.getElementById('totalFiles').textContent = filesData.total || 0;
        }
        
        // Projects count
        if (projectsResponse.ok) {
            const projects = await projectsResponse.json();
            document.getElementById('totalProjects').textContent = projects.length;
        }
        
        // Tags count
        if (tagsResponse.ok) {
            const tags = await tagsResponse.json();
            document.getElementById('totalTags').textContent = tags.length;
        }
        
        // Searches today
        if (searchLogsResponse.ok) {
            const searchData = await searchLogsResponse.json();
            document.getElementById('totalSearches').textContent = searchData.searches_today || 0;
        }
        
        // Load recent activity
        loadRecentActivity();
        
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch(`${API_BASE}/admin/activity/recent`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const activity = await response.json();
            const activityList = document.getElementById('recentActivity');
            
            if (activityList) {
                activityList.innerHTML = activity.map(item => `
                    <div class="activity-item">
                        <i class="fas fa-${item.icon}"></i>
                        <div class="activity-details">
                            <p>${escapeHtml(item.description)}</p>
                            <span class="activity-time">${formatTimeAgo(item.timestamp)}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load activity:', error);
    }
}

// Load files
async function loadFiles(page = 1) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/admin/files?page=${page}&per_page=20`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        const tbody = document.getElementById('filesTableBody');
        
        tbody.innerHTML = data.results.map(file => `
            <tr>
                <td>
                    <div class="file-name">
                        <i class="${getFileIcon(file.filetype)}"></i>
                        ${escapeHtml(file.filename)}
                    </div>
                </td>
                <td>${escapeHtml(file.project || 'No Project')}</td>
                <td><code>${file.filetype}</code></td>
                <td>${formatFileSize(file.size)}</td>
                <td>
                    <div class="tags-cell">
                        ${file.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-edit" onclick="editFile(${file.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-delete" onclick="deleteFile(${file.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Update pagination
        updatePagination('filesPagination', data.page, data.pages, page => loadFiles(page));
        
    } catch (error) {
        console.error('Failed to load files:', error);
        showMessage('Failed to load files', 'error');
    } finally {
        showLoading(false);
    }
}

// Edit file
async function editFile(fileId) {
    try {
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load file');
        
        const file = await response.json();
        
        // Populate edit form
        document.getElementById('editFileId').value = file.id;
        document.getElementById('editFileName').value = file.filename;
        document.getElementById('editFileDescription').value = file.description || '';
        document.getElementById('editFileProject').value = file.project || '';
        document.getElementById('editFileTags').value = file.tags.join(', ');
        
        // Show modal
        document.getElementById('editFileModal').style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load file:', error);
        showMessage('Failed to load file details', 'error');
    }
}

// Handle edit file form
async function handleEditFile(event) {
    event.preventDefault();
    
    const fileId = document.getElementById('editFileId').value;
    const formData = new FormData(event.target);
    
    const data = {
        description: formData.get('description'),
        project_id: formData.get('project_id'),
        tags: formData.get('tags').split(',').map(t => t.trim()).filter(t => t)
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/files/${fileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('File updated successfully', 'success');
            closeModal('editFileModal');
            loadFiles();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to update file', 'error');
    }
}

// Delete file
async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/files/${fileId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('File deleted successfully', 'success');
            loadFiles();
        } else {
            showMessage('Failed to delete file', 'error');
        }
    } catch (error) {
        showMessage('Error deleting file', 'error');
    }
}

// Load projects
async function loadProjects() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/admin/projects`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load projects');
        
        const projects = await response.json();
        const grid = document.getElementById('projectsGrid');
        
        grid.innerHTML = projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <h3>${escapeHtml(project.name)}</h3>
                    <div class="project-actions">
                        <button class="btn btn-icon" onclick="editProject(${project.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon" onclick="deleteProject(${project.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="project-description">${escapeHtml(project.description || 'No description')}</p>
                <div class="project-stats">
                    <span><i class="fas fa-file-code"></i> ${project.file_count} files</span>
                    <span><i class="fas fa-calendar"></i> ${formatDate(project.created_date)}</span>
                </div>
            </div>
        `).join('');
        
        // Also update project selects
        updateProjectSelects(projects);
        
    } catch (error) {
        console.error('Failed to load projects:', error);
        showMessage('Failed to load projects', 'error');
    } finally {
        showLoading(false);
    }
}

// Create project
function showAddProjectModal() {
    document.getElementById('addProjectModal').style.display = 'block';
}

// Handle add project form
async function handleAddProject(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description')
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Project created successfully', 'success');
            closeModal('addProjectModal');
            form.reset();
            loadProjects();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to create project', 'error');
    }
}

// Load tags
async function loadTags() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/admin/tags`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load tags');
        
        const tags = await response.json();
        const container = document.getElementById('tagsContainer');
        
        container.innerHTML = tags.map(tag => `
            <div class="tag-item">
                <div class="tag-info">
                    <span class="tag-name">${escapeHtml(tag.name)}</span>
                    <span class="tag-count">${tag.file_count} files</span>
                </div>
                <div class="tag-actions">
                    <button class="btn btn-icon" onclick="editTag(${tag.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon" onclick="deleteTag(${tag.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load tags:', error);
        showMessage('Failed to load tags', 'error');
    } finally {
        showLoading(false);
    }
}

// Create tag
function showAddTagModal() {
    document.getElementById('addTagModal').style.display = 'block';
}

// Handle add tag form
async function handleAddTag(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description')
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Tag created successfully', 'success');
            closeModal('addTagModal');
            form.reset();
            loadTags();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to create tag', 'error');
    }
}

// Start indexing
async function startIndexing() {
    const progressDiv = document.getElementById('indexingProgress');
    const resultsDiv = document.getElementById('indexingResults');
    const statusText = document.getElementById('indexingStatus');
    const progressFill = document.getElementById('progressFill');
    const startButton = document.getElementById('startIndexingBtn');
    
    // Disable button
    startButton.disabled = true;
    progressDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    statusText.textContent = 'Starting indexing process...';
    progressFill.style.width = '0%';
    
    try {
        // Start indexing
        const response = await fetch(`${API_BASE}/admin/index`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Indexing failed');
        
        // Simulate progress (in real app, would use WebSocket or SSE)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
            statusText.textContent = `Indexing files... ${Math.round(progress)}%`;
        }, 500);
        
        // Get result
        const result = await response.json();
        
        // Complete progress
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        statusText.textContent = 'Indexing complete!';
        
        // Show results
        setTimeout(() => {
            document.getElementById('filesIndexed').textContent = result.files_indexed || 0;
            document.getElementById('filesUpdated').textContent = result.files_updated || 0;
            document.getElementById('filesSkipped').textContent = result.files_skipped || 0;
            
            const errorsDiv = document.getElementById('indexingErrors');
            if (result.errors && result.errors.length > 0) {
                errorsDiv.innerHTML = '<h4>Errors:</h4><ul class="error-list">' + 
                    result.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
            } else {
                errorsDiv.innerHTML = '<p class="success-message">No errors encountered!</p>';
            }
            
            progressDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
            
            // Reload stats
            loadDashboardStats();
        }, 1000);
        
    } catch (error) {
        statusText.textContent = 'Indexing failed!';
        progressFill.style.backgroundColor = '#ef4444';
        showMessage('Indexing failed: ' + error.message, 'error');
    } finally {
        // Re-enable button
        startButton.disabled = false;
    }
}

// Add file manually
function showAddFileModal() {
    // Load projects for dropdown
    loadProjectsForSelect('addFileProject');
    document.getElementById('addFileModal').style.display = 'block';
}

// Handle add file form
async function handleAddFile(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        filename: formData.get('filename'),
        filepath: formData.get('filepath'),
        project_id: parseInt(formData.get('project_id')),
        description: formData.get('description'),
        tags: formData.get('tags').split(',').map(t => t.trim()).filter(t => t)
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('File added successfully', 'success');
            closeModal('addFileModal');
            form.reset();
            loadFiles();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to add file', 'error');
    }
}

// Utility Functions

// Update project selects
function updateProjectSelects(projects) {
    const selects = document.querySelectorAll('select[name="project_id"]');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Project</option>' + 
            projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        select.value = currentValue;
    });
}

// Load projects for select
async function loadProjectsForSelect(selectId) {
    try {
        const response = await fetch(`${API_BASE}/admin/projects`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const projects = await response.json();
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Project</option>' + 
                    projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Update pagination
function updatePagination(containerId, currentPage, totalPages, onPageClick) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const pages = [];
    
    // Previous button
    if (currentPage > 1) {
        pages.push(`<button class="page-btn" onclick="${onPageClick.name}(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Previous
        </button>`);
    }
    
    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                            onclick="${onPageClick.name}(${i})">${i}</button>`);
    }
    
    // Next button
    if (currentPage < totalPages) {
        pages.push(`<button class="page-btn" onclick="${onPageClick.name}(${currentPage + 1})">
            Next <i class="fas fa-chevron-right"></i>
        </button>`);
    }
    
    container.innerHTML = pages.join('');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Show loading
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// Show message
function showMessage(message, type = 'info') {
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
        max-width: 400px;
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

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Format time ago
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    
    return date.toLocaleDateString();
}

// Get file icon
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

// Escape HTML
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
