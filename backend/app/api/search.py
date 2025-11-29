"""
Search API Endpoints
"""

from flask import Blueprint, request, jsonify
from flask_login import current_user
from sqlalchemy import or_, and_, select
from app.models import File, Tag, SearchLog, Project, db
from app.utils.search import fuzzy_search, get_search_suggestions
import os

search_bp = Blueprint('search', __name__)

@search_bp.route('/', methods=['GET'])
def search():
    """Main search endpoint"""
    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = int(os.getenv('SEARCH_RESULTS_PER_PAGE', 20))
    project_filter = request.args.get('project')
    filetype_filter = request.args.get('filetype')
    
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    # Build base query
    search_query = File.query.filter(File.is_active == True)
    
    # Apply filters
    if project_filter:
        search_query = search_query.join(Project).filter(Project.name == project_filter)
    
    if filetype_filter:
        search_query = search_query.filter(File.filetype == filetype_filter)
    
    # Search in filename, description, and tags
    # Use select() explicitly to avoid SQLAlchemy warning
    tag_subquery = select(File.id).join(File.tags).filter(
        Tag.name.ilike(f'%{query}%')
    ).scalar_subquery()
    
    search_query = search_query.filter(
        or_(
            File.filename.ilike(f'%{query}%'),
            File.description.ilike(f'%{query}%'),
            File.id.in_(tag_subquery)
        )
    )
    
    # Paginate results
    pagination = search_query.paginate(
        page=page, 
        per_page=per_page,
        error_out=False
    )
    
    # Log search
    user_id = current_user.id if current_user and current_user.is_authenticated else None
    log = SearchLog(
        search_term=query,
        results_count=pagination.total,
        user_id=user_id,
        user_ip=request.remote_addr
    )
    db.session.add(log)
    db.session.commit()
    
    # Format results
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
            'project': file.project.name if file.project else None,
            'tags': [tag.name for tag in file.tags]
        })
    
    return jsonify({
        'results': results,
        'total': pagination.total,
        'page': page,
        'pages': pagination.pages,
        'per_page': per_page
    })

@search_bp.route('/suggestions', methods=['GET'])
def search_suggestions():
    """Get search suggestions based on partial query"""
    query = request.args.get('q', '').strip()
    
    if len(query) < 2:
        return jsonify({'suggestions': []})
    
    suggestions = get_search_suggestions(query)
    return jsonify({'suggestions': suggestions})
