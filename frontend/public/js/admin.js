// Codex Admin Panel JavaScript - Complete Implementation

const API_BASE = '/api';
let currentSection = 'dashboard';
let currentUser = null;
let currentPage = 1;
let dragDropArea = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    setupEventListeners();
    showSection('dashboard');
    initializeDragDrop();
    setupSidebarToggle();
});

// Initialize drag and drop functionality
function initializeDragDrop() {
    // Initialize drag and drop for main area
    const dragDropArea = document.getElementById('dragDropArea');
    if (dragDropArea) {
        setupDragDropEvents(dragDropArea, 'fileInput');
    }

    // Initialize drag and drop for modal
    const dragDropModalArea = document.getElementById('dragDropModalArea');
    if (dragDropModalArea) {
        setupDragDropEvents(dragDropModalArea, 'modalFileInput');
    }
}

function setupDragDropEvents(area, inputId) {
    const fileInput = document.getElementById(inputId);
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.remove('drag-over'), false);
    });

    area.addEventListener('drop', handleDrop, false);
    
    // Only trigger file input when clicking on the main drag area, not on form elements
    area.addEventListener('click', function(e) {
        // Don't trigger file input if clicking on form elements
        if (e.target.tagName === 'SELECT' || 
            e.target.tagName === 'INPUT' || 
            e.target.tagName === 'LABEL' ||
            e.target.closest('.upload-form') ||
            e.target.closest('.form-group')) {
            return;
        }
        fileInput.click();
    });

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, inputId.includes('modal'));
    }

    // File input change handler
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            handleFiles(e.target.files, inputId.includes('modal'));
        });
    }
}

// Handle file uploads
async function handleFiles(files, isModal = false) {
    const projectSelectId = isModal ? 'modalUploadProjectSelect' : 'uploadProjectSelect';
    const descriptionId = isModal ? 'modalUploadDescription' : 'uploadDescription';
    const tagsId = isModal ? 'modalUploadTags' : 'uploadTags';
    
    const projectSelect = document.getElementById(projectSelectId);
    const descriptionInput = document.getElementById(descriptionId);
    const tagsInput = document.getElementById(tagsId);

    if (!projectSelect.value) {
        showMessage('Please select a project first', 'error');
        return;
    }

    const progressContainer = isModal ? document.getElementById('uploadProgress') : null;
    const resultsContainer = isModal ? document.getElementById('uploadResults') : null;
    const resultsList = isModal ? document.getElementById('uploadResultsList') : null;
    
    if (progressContainer) {
        progressContainer.style.display = 'block';
        if (resultsContainer) resultsContainer.style.display = 'none';
    }

    const results = [];
    const totalFiles = files.length;
    let processedFiles = 0;

    for (let file of files) {
        try {
            const result = await uploadSingleFile(file, {
                project_id: projectSelect.value,
                description: descriptionInput.value,
                tags: tagsInput.value
            });
            results.push({ file: file.name, success: true, message: 'Uploaded successfully' });
        } catch (error) {
            results.push({ file: file.name, success: false, message: error.message });
        }
        
        processedFiles++;
        if (progressContainer) {
            const progress = (processedFiles / totalFiles) * 100;
            const progressFill = document.getElementById('uploadProgressFill');
            const status = document.getElementById('uploadStatus');
            if (progressFill) progressFill.style.width = progress + '%';
            if (status) status.textContent = `Processing ${processedFiles}/${totalFiles} files...`;
        }
    }

    // Show results
    if (progressContainer) progressContainer.style.display = 'none';
    
    if (resultsContainer && resultsList) {
        resultsContainer.style.display = 'block';
        resultsList.innerHTML = results.map(result => 
            `<li class="${result.success ? 'success' : 'error'}">
                <i class="fas fa-${result.success ? 'check' : 'times'}"></i>
                ${result.file}: ${result.message}
            </li>`
        ).join('');
    }

    // Clear form
    const fileInput = document.getElementById(isModal ? 'modalFileInput' : 'fileInput');
    if (fileInput) fileInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (tagsInput) tagsInput.value = '';
    
    // Refresh files list
    loadFiles();
}

// Upload single file
async function uploadSingleFile(file, metadata) {
    return new Promise(async (resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', metadata.project_id);
        formData.append('description', metadata.description);
        formData.append('tags', metadata.tags);

        try {
            const response = await fetch(`${API_BASE}/admin/files/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const result = await response.json();

            if (response.ok) {
                resolve(result);
            } else {
                reject(new Error(result.error || 'Upload failed'));
            }
        } catch (error) {
            console.error('Upload error:', error);
            reject(error);
        }
    });
}

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
            window.location.href = '/';  // Redirect to browse page (now default)
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
    
    // Load projects for custom indexing
    loadProjectsForSelect('customPathProject');
}

// Sidebar toggle logic
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !toggle || !overlay) return;
    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
        sidebar.focus();
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
    }
    toggle.addEventListener('click', function() {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });
    overlay.addEventListener('click', closeSidebar);
    // Keyboard accessibility
    toggle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle.click();
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
    sidebar.setAttribute('tabindex', '-1');
    sidebar.addEventListener('transitionend', function() {
        if (sidebar.classList.contains('open')) {
            const firstNav = sidebar.querySelector('.nav-item');
            if (firstNav) firstNav.focus();
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
            // Show upload area if it exists
            const dragDropArea = document.getElementById('dragDropArea');
            if (dragDropArea) {
                loadProjectsForSelect('uploadProjectSelect');
                dragDropArea.style.display = 'block';
            }
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
        case 'backup':
            loadBackups();
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

// Edit project
async function editProject(projectId) {
    try {
        const response = await fetch(`${API_BASE}/admin/projects`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load projects');
        
        const projects = await response.json();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            showMessage('Project not found', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectDescription').value = project.description || '';
        
        // Show modal
        document.getElementById('editProjectModal').style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load project:', error);
        showMessage('Failed to load project details', 'error');
    }
}

// Handle edit project form
async function handleEditProject(event) {
    event.preventDefault();
    
    const projectId = document.getElementById('editProjectId').value;
    const formData = new FormData(event.target);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description')
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Project updated successfully', 'success');
            closeModal('editProjectModal');
            loadProjects();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to update project', 'error');
    }
}

// Delete project
async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/projects/${projectId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Project deleted successfully', 'success');
            loadProjects();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Error deleting project', 'error');
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

// Edit tag
async function editTag(tagId) {
    try {
        const response = await fetch(`${API_BASE}/admin/tags`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load tags');
        
        const tags = await response.json();
        const tag = tags.find(t => t.id === tagId);
        
        if (!tag) {
            showMessage('Tag not found', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('editTagId').value = tag.id;
        document.getElementById('editTagName').value = tag.name;
        document.getElementById('editTagDescription').value = tag.description || '';
        
        // Show modal
        document.getElementById('editTagModal').style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load tag:', error);
        showMessage('Failed to load tag details', 'error');
    }
}

// Handle edit tag form
async function handleEditTag(event) {
    event.preventDefault();
    
    const tagId = document.getElementById('editTagId').value;
    const formData = new FormData(event.target);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description')
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/tags/${tagId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Tag updated successfully', 'success');
            closeModal('editTagModal');
            loadTags();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to update tag', 'error');
    }
}

// Delete tag
async function deleteTag(tagId) {
    if (!confirm('Are you sure you want to delete this tag? This will remove it from all files.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/tags/${tagId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('Tag deleted successfully', 'success');
            loadTags();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Error deleting tag', 'error');
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

// Start custom path indexing
async function startCustomIndexing() {
    const pathInput = document.getElementById('customPathInput');
    const projectSelect = document.getElementById('customPathProject');
    const btn = document.getElementById('startCustomIndexingBtn');
    const progressDiv = document.getElementById('customIndexingProgress');
    const resultsDiv = document.getElementById('customIndexingResults');
    const progressFill = document.getElementById('customProgressFill');
    const statusText = document.getElementById('customIndexingStatus');
    
    if (!pathInput.value.trim()) {
        showMessage('Please enter a directory path', 'error');
        return;
    }
    
    btn.disabled = true;
    progressDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    
    const data = {
        path: pathInput.value.trim(),
        project_id: projectSelect.value ? parseInt(projectSelect.value) : null
    };
    
    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
            statusText.textContent = `Indexing custom path... ${Math.round(progress)}%`;
        }, 500);
        
        const response = await fetch(`${API_BASE}/admin/index/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        // Complete progress
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        statusText.textContent = 'Custom indexing complete!';
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Custom indexing failed');
        }
        
        // Show results
        setTimeout(() => {
            document.getElementById('customIndexedPath').textContent = result.path || pathInput.value;
            document.getElementById('customFilesIndexed').textContent = result.files_indexed || 0;
            document.getElementById('customFilesUpdated').textContent = result.files_updated || 0;
            document.getElementById('customFilesSkipped').textContent = result.files_skipped || 0;
            
            const errorsDiv = document.getElementById('customIndexingErrors');
            if (result.errors && result.errors.length > 0) {
                errorsDiv.innerHTML = '<h4>Errors:</h4><ul class="error-list">' + 
                    result.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
            } else {
                errorsDiv.innerHTML = '';
            }
            
            progressDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
            
            showMessage('Custom path indexing completed successfully', 'success');
            
            // Clear the path input
            pathInput.value = '';
            
            // Reload files and stats
            loadFiles();
            loadDashboardStats();
        }, 1000);
        
    } catch (error) {
        showMessage('Custom indexing failed: ' + error.message, 'error');
        progressDiv.style.display = 'none';
    } finally {
        btn.disabled = false;
    }
}

// Show upload modal
function showUploadModal() {
    // Load projects for dropdown
    loadProjectsForSelect('modalUploadProjectSelect');
    document.getElementById('uploadModal').style.display = 'block';
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

// Load users
async function loadUsers() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/admin/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        const tbody = document.getElementById('usersTableBody');
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.full_name || '-')}</td>
                <td>${escapeHtml(user.email || '-')}</td>
                <td>
                    <span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">
                        ${escapeHtml(user.role)}
                    </span>
                </td>
                <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-edit" onclick="editUser(${user.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${user.id !== currentUser.id ? `
                        <button class="btn btn-icon btn-delete" onclick="deleteUser(${user.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load users:', error);
        showMessage('Failed to load users', 'error');
    } finally {
        showLoading(false);
    }
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'block';
}

// Handle add user form
async function handleAddUser(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        username: formData.get('username'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        role: formData.get('role')
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('User created successfully', 'success');
            closeModal('addUserModal');
            form.reset();
            loadUsers();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to create user', 'error');
    }
}

// Edit user
async function editUser(userId) {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            showMessage('User not found', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserUsername').value = user.username;
        document.getElementById('editUserFullName').value = user.full_name || '';
        document.getElementById('editUserEmail').value = user.email || '';
        document.getElementById('editUserRole').value = user.role;
        
        // Show modal
        document.getElementById('editUserModal').style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load user:', error);
        showMessage('Failed to load user details', 'error');
    }
}

// Handle edit user form
async function handleEditUser(event) {
    event.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const formData = new FormData(event.target);
    
    const data = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        role: formData.get('role')
    };
    
    // Only include password if provided
    const password = formData.get('password');
    if (password) {
        data.password = password;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('User updated successfully', 'success');
            closeModal('editUserModal');
            loadUsers();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Failed to update user', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showMessage('User deleted successfully', 'success');
            loadUsers();
        } else {
            const error = await response.json();
            showMessage('Error: ' + error.error, 'error');
        }
    } catch (error) {
        showMessage('Error deleting user', 'error');
    }
}

// Backup and Restore Functions
async function loadBackups() {
    try {
        const response = await fetch('/api/admin/backups');
        if (!response.ok) throw new Error('Failed to load backups');
        
        const data = await response.json();
        const backupsList = document.getElementById('backupsList');
        
        if (!data.backups || data.backups.length === 0) {
            backupsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-archive"></i>
                    <p>No backups found</p>
                    <small>Create your first backup to get started</small>
                </div>
            `;
            return;
        }
        
        backupsList.innerHTML = data.backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <h4>${backup.name}</h4>
                    <div class="backup-details">
                        <span class="backup-date">
                            <i class="fas fa-calendar"></i>
                            ${new Date(backup.created_at).toLocaleString()}
                        </span>
                        <span class="backup-size">
                            <i class="fas fa-hdd"></i>
                            ${backup.size_mb} MB
                        </span>
                    </div>
                    <div class="backup-stats">
                        ${backup.statistics.files_count ? `<span class="stat-badge">📄 ${backup.statistics.files_count} files</span>` : ''}
                        ${backup.statistics.projects_count ? `<span class="stat-badge">📁 ${backup.statistics.projects_count} projects</span>` : ''}
                        ${backup.statistics.users_count ? `<span class="stat-badge">👥 ${backup.statistics.users_count} users</span>` : ''}
                    </div>
                </div>
                <div class="backup-actions">
                    <button class="btn btn-sm btn-warning" onclick="showRestoreBackupModal('${backup.name}')" title="Restore">
                        <i class="fas fa-upload"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.name}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading backups:', error);
        showNotification('Failed to load backups', 'error');
    }
}

function showCreateBackupModal() {
    document.getElementById('createBackupForm').reset();
    document.getElementById('createBackupModal').style.display = 'block';
}

async function handleCreateBackup(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        name: formData.get('name') || null
    };
    
    try {
        showLoading();
        
        const response = await fetch('/api/admin/backup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Backup created successfully: ${result.backup_name} (${result.size_mb} MB)`, 'success');
            closeModal('createBackupModal');
            loadBackups(); // Refresh the list
        } else {
            showNotification(`Backup failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Failed to create backup', 'error');
    } finally {
        hideLoading();
    }
}

function showRestoreBackupModal(backupName) {
    document.getElementById('restoreBackupName').value = backupName;
    document.getElementById('restoreBackupInfo').innerHTML = `
        <div class="info-box">
            <i class="fas fa-info-circle"></i>
            <p><strong>Backup:</strong> ${backupName}</p>
        </div>
    `;
    document.getElementById('confirmRestore').checked = false;
    document.getElementById('restoreBackupModal').style.display = 'block';
}

async function handleRestoreBackup(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        backup_name: formData.get('backup_name')
    };
    
    if (!document.getElementById('confirmRestore').checked) {
        showNotification('Please confirm that you understand this action', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/admin/restore', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`${result.message}`, 'success');
            closeModal('restoreBackupModal');
            
            // Show restart message
            setTimeout(() => {
                if (confirm('Restore completed successfully! The application needs to be restarted. Restart now?')) {
                    window.location.reload();
                }
            }, 2000);
        } else {
            showNotification(`Restore failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Error restoring backup:', error);
        showNotification('Failed to restore backup', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteBackup(backupName) {
    if (!confirm(`Are you sure you want to delete the backup "${backupName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/backup/${backupName}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Backup deleted successfully', 'success');
            loadBackups(); // Refresh the list
        } else {
            showNotification(`Delete failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Error deleting backup:', error);
        showNotification('Failed to delete backup', 'error');
    }
}

// System Maintenance Functions

async function analyzeSystem() {
    try {
        showLoading();
        showMessage('Analyzing system...', 'info');
        
        const response = await fetch('/api/admin/system/analyze', {
            method: 'POST',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayAnalysisResults(result);
            showMessage(`Analysis complete. Found ${result.issues_found} issues.`, 
                       result.issues_found > 0 ? 'warning' : 'success');
        } else {
            showMessage(`Analysis failed: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error analyzing system:', error);
        showMessage('Failed to analyze system', 'error');
    } finally {
        hideLoading();
    }
}

async function fixSystemIssues() {
    if (!confirm('This will automatically fix all detected issues. Are you sure?')) {
        return;
    }
    
    try {
        showLoading();
        showMessage('Fixing system issues...', 'info');
        
        const response = await fetch('/api/admin/system/fix', {
            method: 'POST',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayFixResults(result);
            showMessage(`Fix complete. Applied ${result.actions_taken} fixes.`, 'success');
        } else {
            showMessage(`Fix failed: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error fixing system issues:', error);
        showMessage('Failed to fix system issues', 'error');
    } finally {
        hideLoading();
    }
}

async function smartReindex() {
    if (!confirm('This will perform smart re-indexing of all files. Continue?')) {
        return;
    }
    
    try {
        showLoading();
        showMessage('Performing smart re-indexing...', 'info');
        
        const response = await fetch('/api/admin/system/smart-reindex', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayReindexResults(result);
            showMessage('Smart re-indexing completed successfully', 'success');
        } else {
            showMessage(`Re-indexing failed: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error during smart re-indexing:', error);
        showMessage('Failed to perform smart re-indexing', 'error');
    } finally {
        hideLoading();
    }
}

function displayAnalysisResults(result) {
    const container = document.getElementById('analysisResults');
    
    if (result.issues_found === 0) {
        container.innerHTML = `
            <div class="results-summary">
                <div class="summary-stat">
                    <div class="number">✅</div>
                    <div class="label">System Healthy</div>
                </div>
            </div>
            <div class="issue-item success">
                <i class="fas fa-check-circle"></i>
                <span>No issues found. Your system is in perfect sync!</span>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="results-summary">
            <div class="summary-stat">
                <div class="number">${result.issues_found}</div>
                <div class="label">Issues Found</div>
            </div>
        </div>
        <h4>Issues Detected:</h4>
    `;
    
    result.issues.forEach(issue => {
        html += `
            <div class="issue-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${escapeHtml(issue)}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayFixResults(result) {
    const container = document.getElementById('analysisResults');
    
    let html = `
        <div class="results-summary">
            <div class="summary-stat">
                <div class="number">${result.issues_found}</div>
                <div class="label">Issues Found</div>
            </div>
            <div class="summary-stat">
                <div class="number">${result.actions_taken}</div>
                <div class="label">Fixes Applied</div>
            </div>
        </div>
    `;
    
    if (result.actions_taken > 0) {
        html += `<h4>Actions Taken:</h4>`;
        result.actions.forEach(action => {
            html += `
                <div class="action-item">
                    <i class="fas fa-check"></i>
                    <span>${escapeHtml(action)}</span>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

function displayReindexResults(result) {
    const container = document.getElementById('analysisResults');
    
    const html = `
        <div class="results-summary">
            <div class="summary-stat">
                <div class="number">${result.files_indexed}</div>
                <div class="label">New Files</div>
            </div>
            <div class="summary-stat">
                <div class="number">${result.files_updated}</div>
                <div class="label">Updated Files</div>
            </div>
            <div class="summary-stat">
                <div class="number">${result.ghost_files_reactivated}</div>
                <div class="label">Ghost Files Fixed</div>
            </div>
            <div class="summary-stat">
                <div class="number">${result.files_skipped}</div>
                <div class="label">Skipped</div>
            </div>
        </div>
        
        ${result.ghost_files_reactivated > 0 ? `
            <div class="action-item">
                <i class="fas fa-magic"></i>
                <span>Successfully reactivated ${result.ghost_files_reactivated} ghost files!</span>
            </div>
        ` : ''}
        
        ${result.errors.length > 0 ? `
            <h4>Errors:</h4>
            ${result.errors.slice(0, 5).map(error => `
                <div class="issue-item error">
                    <i class="fas fa-times-circle"></i>
                    <span>${escapeHtml(error)}</span>
                </div>
            `).join('')}
        ` : ''}
    `;
    
    container.innerHTML = html;
}

// Enhanced file deletion with options
async function deleteFile(fileId, deleteFromDisk = false) {
    const confirmMessage = deleteFromDisk ? 
        'Are you sure you want to delete this file from both database and disk? This action cannot be undone.' :
        'Are you sure you want to delete this file from the database? (File will remain on disk)';
        
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/files/${fileId}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ delete_from_disk: deleteFromDisk }),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            loadFiles();
        } else {
            showMessage(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage('Error deleting file', 'error');
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
