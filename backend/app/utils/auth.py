"""
Authentication utilities
"""

from functools import wraps
from flask import jsonify
from flask_login import current_user
import os

def optional_login_required(f):
    """Decorator that checks authentication only if enabled"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if os.getenv('ENABLE_AUTHENTICATION', 'True').lower() == 'true':
            if not current_user.is_authenticated:
                return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def public_endpoint(f):
    """Decorator for endpoints that don't require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated_function
