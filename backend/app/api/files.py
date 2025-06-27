"""
File Handling API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_login import login_required, current_user
from app.models import File, FileDownload, db
import os
from datetime import datetime
import mimetypes
import tempfile

file_bp = Blueprint('files', __name__)

@file_bp.route('/<int:file_id>', methods=['GET'])
def get_file_details(file_id):
    """Get file details - public endpoint"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({
        'id': file.id,
        'filename': file.filename,
        'filepath': file.filepath,
        'filetype': file.filetype,
        'description': file.description,
        'size': file.size,
        'line_count': file.line_count,
        'modified_date': file.modified_date.isoformat() if file.modified_date else None,
        'project': file.project.name if file.project else None,
        'tags': [tag.name for tag in file.tags]
    })

@file_bp.route('/<int:file_id>/content', methods=['GET'])
def get_file_content(file_id):
    """Get file content for viewing"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if file exists on disk
    if not os.path.exists(file.filepath):
        return jsonify({'error': 'File not found on disk'}), 404
    
    try:
        # Try to read the actual file
        with open(file.filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # Limit content size for display
        max_size = 1024 * 1024  # 1MB
        if len(content) > max_size:
            content = content[:max_size] + '\n\n... (file truncated for display)'
        
        return jsonify({
            'filename': file.filename,
            'content': content,
            'filetype': file.filetype
        })
    except Exception as e:
        current_app.logger.error(f'Error reading file {file.filepath}: {str(e)}')
        return jsonify({'error': 'Unable to read file'}), 500

@file_bp.route('/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    """Download a file"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    # Log download if user is authenticated
    if current_user.is_authenticated:
        download = FileDownload(
            file_id=file.id,
            user_id=current_user.id,
            user_ip=request.remote_addr
        )
        db.session.add(download)
        db.session.commit()
    
    # Check if file exists
    if not os.path.exists(file.filepath):
        return jsonify({'error': 'File not found on disk'}), 404
    
    try:
        return send_file(
            file.filepath,
            as_attachment=True,
            download_name=file.filename,
            mimetype=mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
        )
    except Exception as e:
        current_app.logger.error(f'Error downloading file {file.filepath}: {str(e)}')
        return jsonify({'error': 'Unable to download file'}), 500

@file_bp.route('/recent', methods=['GET'])
def get_recent_files():
    """Get recently added files"""
    limit = request.args.get('limit', 10, type=int)
    limit = min(limit, 50)  # Cap at 50
    
    files = File.query.filter_by(is_active=True)\
                     .order_by(File.indexed_date.desc())\
                     .limit(limit)\
                     .all()
    
    return jsonify([{
        'id': f.id,
        'filename': f.filename,
        'filetype': f.filetype,
        'project': f.project.name if f.project else None,
        'indexed_date': f.indexed_date.isoformat(),
        'size': f.size,
        'description': f.description
    }    for f in files])
