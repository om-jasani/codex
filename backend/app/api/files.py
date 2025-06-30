"""
File Handling API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_login import login_required, current_user
from app.models import File, db
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
        # Check file type for special handling
        file_ext = os.path.splitext(file.filename)[1].lower()
        is_html = file_ext in ['.html', '.htm']
        is_pdf = file_ext == '.pdf'
        
        if is_pdf:
            # For PDF files, provide URL for inline viewing only
            from urllib.parse import quote
            return jsonify({
                'filename': file.filename,
                'filetype': file.filetype,
                'type': 'pdf',
                'inline_url': f'/api/files/{file_id}/inline'
            })
        
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
            'filetype': file.filetype,
            'type': 'html' if is_html else 'text'
        })
    except Exception as e:
        current_app.logger.error(f'Error reading file {file.filepath}: {str(e)}')
        return jsonify({'error': 'Unable to read file'}), 500

@file_bp.route('/<int:file_id>/inline', methods=['GET'])
def inline_file(file_id):
    """Serve a file inline (for PDFs and other viewable content)"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if file exists
    if not os.path.exists(file.filepath):
        return jsonify({'error': 'File not found on disk'}), 404
    
    try:
        # Determine MIME type
        mime_type = mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
        
        # For PDFs, set Content-Disposition to inline
        response = send_file(file.filepath, mimetype=mime_type)
        if file.filename.lower().endswith('.pdf'):
            response.headers['Content-Disposition'] = f'inline; filename="{file.filename}"'
        
        return response
    except Exception as e:
        current_app.logger.error(f'Error serving file inline {file.filepath}: {str(e)}')
        return jsonify({'error': 'Unable to serve file'}), 500

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
