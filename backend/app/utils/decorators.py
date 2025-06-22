"""
Custom Decorators
"""

from functools import wraps
from flask import jsonify
from flask_login import current_user

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def api_response(f):
    """Decorator to standardize API responses"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            result = f(*args, **kwargs)
            if isinstance(result, tuple):
                return result
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function
