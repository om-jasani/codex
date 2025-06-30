"""
Admin API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.models import File, Tag, Project, User, SearchLog, db
from app.services.file_indexer import FileIndexer
from app.utils.decorators import admin_required
import os
import json
import hashlib
from datetime import datetime, timedelta
from sqlalchemy import func, and_
import zipfile
import tempfile
import subprocess
import shutil

admin_bp = Blueprint('admin', __name__)

# Configuration for file uploads
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'file_storage')
ALLOWED_EXTENSIONS = {
    'txt', 'py', 'js', 'html', 'css', 'cpp', 'c', 'h', 'hpp',
    'java', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala',
    'ino', 'pde', 'json', 'xml', 'yaml', 'yml', 'md', 'rst',
    'sql', 'sh', 'bat', 'ps1', 'dockerfile', 'makefile'
}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_hash(filepath):
    """Calculate MD5 hash of file"""
    hash_md5 = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except:
        return None

def count_lines(filepath):
    """Count lines in a text file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for line in f)
    except:
        return 0

# Files Management

@admin_bp.route('/files', methods=['GET'])
@login_required
@admin_required
def get_files():
    """Get paginated list of files"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # Build query
    query = File.query.filter_by(is_active=True)
    
    # Add search filter if provided
    search = request.args.get('search')
    if search:
        query = query.filter(File.filename.ilike(f'%{search}%'))
    
    # Add project filter if provided
    project_id = request.args.get('project_id')
    if project_id:
        query = query.filter_by(project_id=project_id)
    
    # Order by indexed date
    query = query.order_by(File.indexed_date.desc())
    
    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    results = []
    for file in pagination.items:
        results.append({
            'id': file.id,
            'filename': file.filename,
            'filepath': file.filepath,
            'filetype': file.filetype,
            'description': file.description,
            'size': file.size,
            'line_count': file.line_count,
            'modified_date': file.modified_date.isoformat() if file.modified_date else None,
            'indexed_date': file.indexed_date.isoformat() if file.indexed_date else None,
            'project': file.project.name if file.project else None,
            'project_id': file.project_id,
            'tags': [tag.name for tag in file.tags]
        })
    
    return jsonify({
        'results': results,
        'total': pagination.total,
        'page': page,
        'pages': pagination.pages,
        'per_page': per_page
    })

@admin_bp.route('/files', methods=['POST'])
@login_required
@admin_required
def add_file():
    """Add a new file to the system"""
    data = request.get_json()
    
    required_fields = ['filename', 'filepath', 'project_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if file already exists
    existing_file = File.query.filter_by(filepath=data['filepath']).first()
    if existing_file:
        return jsonify({'error': 'File already exists in the system'}), 409
    
    # Create new file record
    new_file = File(
        filename=data['filename'],
        filepath=data['filepath'],
        filetype=os.path.splitext(data['filename'])[1].lower(),
        project_id=data['project_id'],
        description=data.get('description', ''),
        size=data.get('size', 0),
        line_count=data.get('line_count', 0),
        modified_date=datetime.fromisoformat(data['modified_date']) if 'modified_date' in data else datetime.utcnow()
    )
    
    # Add tags if provided
    if 'tags' in data:
        for tag_name in data['tags']:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, description=f"Created from file {data['filename']}")
                db.session.add(tag)
            new_file.tags.append(tag)
    
    db.session.add(new_file)
    db.session.commit()
    
    return jsonify({
        'message': 'File added successfully',
        'file_id': new_file.id
    }), 201

@admin_bp.route('/files/<int:file_id>', methods=['PUT'])
@login_required
@admin_required
def update_file(file_id):
    """Update file information"""
    file = File.query.get_or_404(file_id)
    data = request.get_json()
    
    # Update file fields
    if 'description' in data:
        file.description = data['description']
    if 'project_id' in data:
        file.project_id = data['project_id']
    
    # Update tags
    if 'tags' in data:
        file.tags.clear()
        for tag_name in data['tags']:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, description="Auto-created tag")
                db.session.add(tag)
            file.tags.append(tag)
    
    db.session.commit()
    return jsonify({'message': 'File updated successfully'})

@admin_bp.route('/files/<int:file_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_file(file_id):
    """Delete a file with options for physical deletion"""
    file = File.query.get_or_404(file_id)
    
    # Get delete options from request
    data = request.get_json() or {}
    delete_from_disk = data.get('delete_from_disk', False)
    
    if delete_from_disk:
        # Delete physical file
        try:
            if os.path.exists(file.filepath):
                os.remove(file.filepath)
                current_app.logger.info(f'Physical file deleted: {file.filepath}')
        except Exception as e:
            current_app.logger.error(f'Error deleting physical file {file.filepath}: {e}')
            return jsonify({'error': f'Failed to delete physical file: {str(e)}'}), 500
    
    # Always mark as inactive in database
    file.is_active = False
    db.session.commit()
    
    message = 'File deleted from database'
    if delete_from_disk:
        message += ' and removed from disk'
    
    return jsonify({'message': message})

# Projects Management

@admin_bp.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects - public endpoint for filters"""
    projects = Project.query.filter_by(is_active=True).order_by(Project.name).all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'created_date': p.created_date.isoformat() if p.created_date else None,
        'file_count': p.files.filter_by(is_active=True).count()
    } for p in projects])

@admin_bp.route('/projects', methods=['POST'])
@login_required
@admin_required
def create_project():
    """Create a new project"""
    data = request.get_json()
    
    if 'name' not in data:
        return jsonify({'error': 'Project name is required'}), 400
    
    if Project.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Project already exists'}), 409
    
    project = Project(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        'message': 'Project created successfully',
        'project_id': project.id
    }), 201

@admin_bp.route('/projects/<int:project_id>', methods=['PUT'])
@login_required
@admin_required
def update_project(project_id):
    """Update project information"""
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    if 'name' in data:
        # Check if new name already exists
        existing = Project.query.filter_by(name=data['name']).first()
        if existing and existing.id != project_id:
            return jsonify({'error': 'Project name already exists'}), 409
        project.name = data['name']
    
    if 'description' in data:
        project.description = data['description']
    
    project.updated_date = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Project updated successfully'})

@admin_bp.route('/projects/<int:project_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_project(project_id):
    """Delete (deactivate) a project"""
    project = Project.query.get_or_404(project_id)
    
    # Check if project has files
    if project.files.filter_by(is_active=True).count() > 0:
        return jsonify({'error': 'Cannot delete project with active files'}), 400
    
    project.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Project deleted successfully'})

# Tags Management

@admin_bp.route('/tags', methods=['GET'])
def get_tags():
    """Get all tags - public endpoint for filters"""
    tags = Tag.query.order_by(Tag.name).all()
    return jsonify([{
        'id': t.id,
        'name': t.name,
        'description': t.description,
        'file_count': len([f for f in t.files if f.is_active])
    } for t in tags])

@admin_bp.route('/tags', methods=['POST'])
@login_required
@admin_required
def create_tag():
    """Create a new tag"""
    data = request.get_json()
    
    if 'name' not in data:
        return jsonify({'error': 'Tag name is required'}), 400
    
    if Tag.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Tag already exists'}), 409
    
    tag = Tag(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(tag)
    db.session.commit()
    
    return jsonify({
        'message': 'Tag created successfully',
        'tag_id': tag.id
    }), 201

@admin_bp.route('/tags/<int:tag_id>', methods=['PUT'])
@login_required
@admin_required
def update_tag(tag_id):
    """Update tag information"""
    tag = Tag.query.get_or_404(tag_id)
    data = request.get_json()
    
    if 'name' in data:
        # Check if new name already exists
        existing = Tag.query.filter_by(name=data['name']).first()
        if existing and existing.id != tag_id:
            return jsonify({'error': 'Tag name already exists'}), 409
        tag.name = data['name']
    
    if 'description' in data:
        tag.description = data['description']
    
    db.session.commit()
    
    return jsonify({'message': 'Tag updated successfully'})

@admin_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_tag(tag_id):
    """Delete a tag"""
    tag = Tag.query.get_or_404(tag_id)
    
    # Remove tag from all files
    for file in tag.files:
        file.tags.remove(tag)
    
    db.session.delete(tag)
    db.session.commit()
    
    return jsonify({'message': 'Tag deleted successfully'})

@admin_bp.route('/index', methods=['POST'])
@login_required
@admin_required
def trigger_indexing():
    """Trigger file indexing process"""
    try:
        repo_path = os.getenv('CODE_REPOSITORY_PATH')
        
        if not repo_path:
            return jsonify({'error': 'Repository path not configured'}), 500
        
        indexer = FileIndexer()
        result = indexer.index_directory(repo_path)
        
        return jsonify({
            'message': 'Indexing completed',
            'files_indexed': result['files_indexed'],
            'files_updated': result['files_updated'],
            'files_skipped': result['files_skipped'],
            'errors': result['errors'][:10] if result['errors'] else []  # Limit errors to 10
        })
    except Exception as e:
        current_app.logger.error(f'Indexing error: {str(e)}')
        return jsonify({'error': f'Indexing failed: {str(e)}'}), 500

# Enhanced indexing with custom paths
@admin_bp.route('/index/custom', methods=['POST'])
@login_required
@admin_required
def index_custom_path():
    """Index files from a custom directory path"""
    data = request.get_json()
    
    if 'path' not in data:
        return jsonify({'error': 'Path is required'}), 400
    
    path = data['path']
    project_id = data.get('project_id')
    
    if not os.path.exists(path):
        return jsonify({'error': 'Path does not exist'}), 400
    
    if not os.path.isdir(path):
        return jsonify({'error': 'Path is not a directory'}), 400
    
    # Verify project if specified
    project = None
    if project_id:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
    
    try:
        indexer = FileIndexer()
        result = indexer.index_directory(path, project_id=project_id)
        
        return jsonify({
            'message': 'Custom path indexing completed',
            'path': path,
            'project': project.name if project else 'Default',
            'files_indexed': result['files_indexed'],
            'files_updated': result['files_updated'],
            'files_skipped': result['files_skipped'],
            'errors': result['errors'][:10] if result['errors'] else []
        })
    except Exception as e:
        current_app.logger.error(f'Custom indexing error: {str(e)}')
        return jsonify({'error': f'Indexing failed: {str(e)}'}), 500

# Statistics

@admin_bp.route('/stats/files', methods=['GET'])
@login_required
@admin_required
def get_file_stats():
    """Get file statistics"""
    total_files = File.query.filter_by(is_active=True).count()
    total_size = db.session.query(func.sum(File.size)).filter_by(is_active=True).scalar() or 0
    
    # Files by type
    files_by_type = db.session.query(
        File.filetype, 
        func.count(File.id)
    ).filter_by(is_active=True).group_by(File.filetype).all()
    
    return jsonify({
        'total': total_files,
        'total_size': total_size,
        'by_type': dict(files_by_type)
    })

@admin_bp.route('/stats/searches', methods=['GET'])
@login_required
@admin_required
def get_search_stats():
    """Get search statistics"""
    # Searches today
    today = datetime.utcnow().date()
    searches_today = SearchLog.query.filter(
        func.date(SearchLog.timestamp) == today
    ).count()
    
    # Popular searches
    popular_searches = db.session.query(
        SearchLog.search_term,
        func.count(SearchLog.id).label('count')
    ).group_by(SearchLog.search_term).order_by(func.count(SearchLog.id).desc()).limit(10).all()
    
    return jsonify({
        'searches_today': searches_today,
        'popular_searches': [{'term': term, 'count': count} for term, count in popular_searches]
    })

@admin_bp.route('/activity/recent', methods=['GET'])
@login_required
@admin_required
def get_recent_activity():
    """Get recent activity"""
    activities = []
    
    # Recent files
    recent_files = File.query.filter_by(is_active=True)\
                           .order_by(File.indexed_date.desc())\
                           .limit(5).all()
    
    for file in recent_files:
        activities.append({
            'icon': 'file-plus',
            'description': f'File "{file.filename}" was added',
            'timestamp': file.indexed_date.isoformat() if file.indexed_date else None
        })
    
    # Recent searches
    recent_searches = SearchLog.query.order_by(SearchLog.timestamp.desc()).limit(5).all()
    
    for search in recent_searches:
        activities.append({
            'icon': 'search',
            'description': f'Search for "{search.search_term}" ({search.results_count} results)',
            'timestamp': search.timestamp.isoformat() if search.timestamp else None
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x['timestamp'] if x['timestamp'] else '', reverse=True)
    
    return jsonify(activities[:10])  # Return top 10 activities

# Users Management

@admin_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    """Get all users"""
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'full_name': u.full_name,
        'email': u.email,
        'role': u.role,
        'is_active': u.is_active,
        'created_date': u.created_date.isoformat() if u.created_date else None,
        'last_login': u.last_login.isoformat() if u.last_login else None
    } for u in users])

@admin_bp.route('/users', methods=['POST'])
@login_required
@admin_required
def create_user():
    """Create a new user"""
    data = request.get_json()
    
    required_fields = ['username', 'password', 'role']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    user = User(
        username=data['username'],
        email=data.get('email', ''),
        full_name=data.get('full_name', ''),
        role=data['role']
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user_id': user.id
    }), 201

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
@admin_required
def update_user(user_id):
    """Update user information"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if 'email' in data:
        user.email = data['email']
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'role' in data:
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = data['is_active']
    if 'password' in data:
        user.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify({'message': 'User updated successfully'})

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    """Delete (deactivate) a user"""
    if user_id == current_user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user = User.query.get_or_404(user_id)
    user.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'User deactivated successfully'})

# File upload endpoint
@admin_bp.route('/files/upload', methods=['POST'])
@login_required
@admin_required
def upload_file():
    """Upload files via drag-and-drop or file selection"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Get additional form data
    project_id = request.form.get('project_id', type=int)
    description = request.form.get('description', '')
    tags = request.form.get('tags', '').split(',') if request.form.get('tags') else []
    
    if not project_id:
        return jsonify({'error': 'Project is required'}), 400
    
    # Verify project exists
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    try:
        # Create upload directory if it doesn't exist
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Secure filename and create unique name if necessary
        filename = secure_filename(file.filename)
        base_name, ext = os.path.splitext(filename)
        counter = 1
        
        while File.query.filter_by(filename=filename).first():
            filename = f"{base_name}_{counter}{ext}"
            counter += 1
        
        # Save file
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Get file info
        file_size = os.path.getsize(filepath)
        file_hash = get_file_hash(filepath)
        line_count = count_lines(filepath)
        
        # Create database record
        new_file = File(
            filename=filename,
            filepath=os.path.abspath(filepath),
            filetype=ext.lower(),
            project_id=project_id,
            description=description,
            size=file_size,
            line_count=line_count,
            content_hash=file_hash,
            modified_date=datetime.utcnow()
        )
        
        # Add tags
        for tag_name in tags:
            tag_name = tag_name.strip()
            if tag_name:
                tag = Tag.query.filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name, description=f"Auto-created from upload")
                    db.session.add(tag)
                new_file.tags.append(tag)
        
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file': {
                'id': new_file.id,
                'filename': new_file.filename,
                'size': new_file.size,
                'project': project.name
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'File upload error: {str(e)}')
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

# Enhanced dashboard stats
@admin_bp.route('/dashboard/stats', methods=['GET'])
@login_required
@admin_required
def get_dashboard_stats():
    """Get comprehensive dashboard statistics"""
    try:
        # Basic counts
        total_files = File.query.filter_by(is_active=True).count()
        total_projects = Project.query.filter_by(is_active=True).count()
        total_tags = Tag.query.count()
        total_users = User.query.filter_by(is_active=True).count()
        
        # File statistics
        total_size = db.session.query(func.sum(File.size)).filter_by(is_active=True).scalar() or 0
        
        # Recent activity counts
        today = datetime.utcnow().date()
        week_ago = today - timedelta(days=7)
        
        files_this_week = File.query.filter(
            File.is_active == True,
            func.date(File.indexed_date) >= week_ago
        ).count()
        
        searches_this_week = SearchLog.query.filter(
            func.date(SearchLog.timestamp) >= week_ago
        ).count()
        
        # Popular file types
        file_types = db.session.query(
            File.filetype,
            func.count(File.id).label('count')
        ).filter_by(is_active=True).group_by(File.filetype).order_by(func.count(File.id).desc()).limit(10).all()
        
        # Most active projects
        active_projects = db.session.query(
            Project.name,
            func.count(File.id).label('file_count')
        ).join(File).filter(File.is_active == True).group_by(Project.name).order_by(func.count(File.id).desc()).limit(5).all()
        
        return jsonify({
            'totals': {
                'files': total_files,
                'projects': total_projects,
                'tags': total_tags,
                'users': total_users,
                'total_size': total_size
            },
            'activity': {
                'files_this_week': files_this_week,
                'searches_this_week': searches_this_week
            },
            'file_types': [{'type': ft, 'count': count} for ft, count in file_types],
            'active_projects': [{'name': name, 'files': count} for name, count in active_projects]
        })
        
    except Exception as e:
        current_app.logger.error(f'Dashboard stats error: {str(e)}')
        return jsonify({'error': 'Failed to load dashboard statistics'}), 500

# Backup and Restore

@admin_bp.route('/backup', methods=['POST'])
@login_required
@admin_required
def create_backup():
    """Create a system backup"""
    try:
        data = request.get_json()
        backup_name = data.get('name') or f"codex_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Create backup directory
        backup_dir = os.path.join(current_app.root_path, '..', '..', 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        
        backup_path = os.path.join(backup_dir, f"{backup_name}.zip")
        
        # Create backup using the backup script
        script_path = os.path.join(current_app.root_path, '..', '..', 'backup_restore.py')
        result = subprocess.run([
            'python', script_path, 'backup', '--name', backup_name, '--force'
        ], capture_output=True, text=True, cwd=os.path.dirname(script_path))
        
        if result.returncode == 0:
            backup_size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
            return jsonify({
                'success': True,
                'message': 'Backup created successfully',
                'backup_name': backup_name,
                'backup_path': backup_path,
                'size_mb': round(backup_size, 2)
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Backup failed: {result.stderr}'
            }), 500
            
    except Exception as e:
        current_app.logger.error(f'Backup error: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/backups', methods=['GET'])
@login_required
@admin_required
def list_backups():
    """List available backups"""
    try:
        backup_dir = os.path.join(current_app.root_path, '..', '..', 'backups')
        
        if not os.path.exists(backup_dir):
            return jsonify({'backups': []})
        
        backups = []
        for backup_file in os.listdir(backup_dir):
            if backup_file.endswith('.zip'):
                backup_path = os.path.join(backup_dir, backup_file)
                size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
                modified = datetime.fromtimestamp(os.path.getmtime(backup_path))
                
                backup_info = {
                    'filename': backup_file,
                    'name': backup_file.replace('.zip', ''),
                    'path': backup_path,
                    'size_mb': round(size, 2),
                    'created_at': modified.isoformat(),
                    'statistics': {}
                }
                
                # Try to read manifest
                try:
                    with zipfile.ZipFile(backup_path, 'r') as backup_zip:
                        manifest_data = backup_zip.read('manifest.json')
                        manifest = json.loads(manifest_data)
                        backup_info['statistics'] = manifest.get('statistics', {})
                except:
                    backup_info['statistics'] = {'error': 'Could not read backup manifest'}
                
                backups.append(backup_info)
        
        # Sort by creation time, newest first
        backups.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({'backups': backups})
        
    except Exception as e:
        current_app.logger.error(f'List backups error: {e}')
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/restore', methods=['POST'])
@login_required
@admin_required
def restore_backup():
    """Restore from backup"""
    try:
        data = request.get_json()
        backup_name = data.get('backup_name')
        
        if not backup_name:
            return jsonify({'success': False, 'message': 'Backup name required'}), 400
        
        backup_dir = os.path.join(current_app.root_path, '..', '..', 'backups')
        backup_path = os.path.join(backup_dir, f"{backup_name}.zip")
        
        if not os.path.exists(backup_path):
            return jsonify({'success': False, 'message': 'Backup file not found'}), 404
        
        # Use the backup script to restore
        script_path = os.path.join(current_app.root_path, '..', '..', 'backup_restore.py')
        result = subprocess.run([
            'python', script_path, 'restore', '--file', backup_path, '--force'
        ], capture_output=True, text=True, cwd=os.path.dirname(script_path))
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'Restore completed successfully. Please restart the application.',
                'backup_name': backup_name
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Restore failed: {result.stderr}'
            }), 500
            
    except Exception as e:
        current_app.logger.error(f'Restore error: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/backup/<backup_name>', methods=['DELETE'])
@login_required
@admin_required
def delete_backup(backup_name):
    """Delete a backup file"""
    try:
        backup_dir = os.path.join(current_app.root_path, '..', '..', 'backups')
        backup_path = os.path.join(backup_dir, f"{backup_name}.zip")
        
        if not os.path.exists(backup_path):
            return jsonify({'error': 'Backup file not found'}), 404
        
        os.remove(backup_path)
        
        return jsonify({
            'success': True,
            'message': 'Backup deleted successfully'
        })
        
    except Exception as e:
        current_app.logger.error(f'Delete backup error: {e}')
        return jsonify({'error': str(e)}), 500

# System Maintenance Endpoints

@admin_bp.route('/system/analyze', methods=['POST'])
@login_required
@admin_required
def analyze_system():
    """Analyze system for file synchronization issues"""
    try:
        # Import the advanced file manager
        import sys
        sys.path.append(os.path.join(current_app.root_path, '..', '..'))
        from advanced_file_manager import AdvancedFileManager
        
        manager = AdvancedFileManager()
        manager.analyze_system()
        
        return jsonify({
            'success': True,
            'issues_found': len(manager.issues_found),
            'issues': manager.issues_found
        })
        
    except Exception as e:
        current_app.logger.error(f'System analysis error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/system/fix', methods=['POST'])
@login_required
@admin_required
def fix_system_issues():
    """Fix system file synchronization issues"""
    try:
        # Import the advanced file manager
        import sys
        sys.path.append(os.path.join(current_app.root_path, '..', '..'))
        from advanced_file_manager import AdvancedFileManager
        
        manager = AdvancedFileManager()
        manager.analyze_system()
        manager.fix_all_issues(auto_fix=True)
        
        return jsonify({
            'success': True,
            'issues_found': len(manager.issues_found),
            'actions_taken': len(manager.actions_taken),
            'actions': manager.actions_taken
        })
        
    except Exception as e:
        current_app.logger.error(f'System fix error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/system/smart-reindex', methods=['POST'])
@login_required
@admin_required
def smart_reindex():
    """Perform smart re-indexing that handles ghost files"""
    try:
        data = request.get_json() or {}
        directory_path = data.get('directory_path')
        project_id = data.get('project_id')
        
        # Import the advanced file manager
        import sys
        sys.path.append(os.path.join(current_app.root_path, '..', '..'))
        from advanced_file_manager import AdvancedFileManager
        
        manager = AdvancedFileManager()
        result = manager.smart_reindex(directory_path, project_id)
        
        return jsonify({
            'success': True,
            'message': 'Smart re-indexing completed',
            'files_indexed': result.get('files_indexed', 0),
            'files_updated': result.get('files_updated', 0),
            'ghost_files_reactivated': result.get('ghost_files_reactivated', 0),
            'files_skipped': result.get('files_skipped', 0),
            'errors': result.get('errors', [])
        })
        
    except Exception as e:
        current_app.logger.error(f'Smart reindex error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500
