"""
API Module Initialization
"""

from .search import search_bp
from .admin import admin_bp
from .auth import auth_bp
from .files import file_bp
from .browse import browse_bp

__all__ = ['search_bp', 'admin_bp', 'auth_bp', 'file_bp', 'browse_bp']
