"""
Admin API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.models import File, Tag, Project, User, SearchLog, db
from app.services.file_indexer import FileIndexer
from app.utils.decorators import admin_required
import os
from datetime import datetime, timedelta
from sqlalchemy import func, and_

admin_bp = Blueprint('admin', __name__)

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
    """Delete (deactivate) a file"""
    file = File.query.get_or_404(file_id)
    file.is_active = False
    db.session.commit()
    return jsonify({'message': 'File deleted successfully'})

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

# File Indexing

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
