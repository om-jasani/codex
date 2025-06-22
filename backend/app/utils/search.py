"""
Search Utility Functions
"""

from fuzzywuzzy import fuzz, process
from app.models import File, Tag, Project
import os

def fuzzy_search(query, threshold=None):
    """Perform fuzzy search on filenames"""
    if threshold is None:
        threshold = float(os.getenv('FUZZY_THRESHOLD', 0.7)) * 100
    
    # Get all active files
    files = File.query.filter_by(is_active=True).all()
    filenames = [(f.id, f.filename) for f in files]
    
    # Perform fuzzy matching
    matches = []
    for file_id, filename in filenames:
        ratio = fuzz.partial_ratio(query.lower(), filename.lower())
        if ratio >= threshold:
            matches.append((file_id, ratio))
    
    # Sort by relevance
    matches.sort(key=lambda x: x[1], reverse=True)
    return [file_id for file_id, _ in matches]

def get_search_suggestions(query, limit=10):
    """Get search suggestions based on partial query"""
    suggestions = set()
    
    # Search in filenames
    files = File.query.filter(
        File.filename.ilike(f'%{query}%'),
        File.is_active == True
    ).limit(limit).all()
    
    for file in files:
        suggestions.add(file.filename)
        # Add filename without extension
        name_without_ext = os.path.splitext(file.filename)[0]
        if name_without_ext != file.filename:
            suggestions.add(name_without_ext)
    
    # Search in tags
    tags = Tag.query.filter(
        Tag.name.ilike(f'%{query}%')
    ).limit(limit).all()
    
    for tag in tags:
        suggestions.add(tag.name)
    
    # Search in project names
    projects = Project.query.filter(
        Project.name.ilike(f'%{query}%'),
        Project.is_active == True
    ).limit(limit).all()
    
    for project in projects:
        suggestions.add(project.name)
    
    # Convert to list and limit results
    suggestions_list = list(suggestions)[:limit]
    
    # Sort by relevance (exact matches first)
    suggestions_list.sort(key=lambda x: (
        not x.lower().startswith(query.lower()),
        len(x)
    ))
    
    return suggestions_list
