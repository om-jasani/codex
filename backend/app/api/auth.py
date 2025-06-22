"""
Authentication API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, db
from app import login_manager
from datetime import datetime
import os

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Find user
    user = User.query.filter_by(username=username).first()
    
    if not user:
        current_app.logger.warning(f'Login attempt for non-existent user: {username}')
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Check password
    if not user.check_password(password):
        current_app.logger.warning(f'Failed login attempt for user: {username}')
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Check if user is active
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Login user
    login_user(user, remember=True)
    current_app.logger.info(f'User logged in: {username}')
    
    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'email': user.email,
            'role': user.role
        }
    })

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """User logout endpoint"""
    username = current_user.username
    logout_user()
    current_app.logger.info(f'User logged out: {username}')
    
    return jsonify({'message': 'Logout successful'})

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current user information"""
    if not current_user.is_authenticated:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'full_name': current_user.full_name,
        'email': current_user.email,
        'role': current_user.role
    })

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    
    if not old_password or not new_password:
        return jsonify({'error': 'Old and new passwords are required'}), 400
    
    # Validate new password
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters long'}), 400
    
    # Check current password
    if not current_user.check_password(old_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Update password
    current_user.set_password(new_password)
    db.session.commit()
    
    current_app.logger.info(f'Password changed for user: {current_user.username}')
    
    return jsonify({'message': 'Password changed successfully'})

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check authentication status"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'role': current_user.role
            }
        })
    else:
        return jsonify({'authenticated': False})

# Create default admin if none exists
def create_default_admin():
    """Create default admin user if no admin exists"""
    try:
        # Check if any admin exists
        admin_exists = User.query.filter_by(role='admin').first()
        
        if not admin_exists:
            # Create default admin
            admin = User(
                username='admin',
                email='admin@codex.local',
                full_name='System Administrator',
                role='admin'
            )
            admin.set_password('admin123')
            
            db.session.add(admin)
            db.session.commit()
            
            current_app.logger.info('Default admin user created')
            print("Default admin user created - Username: admin, Password: admin123")
    except Exception as e:
        current_app.logger.error(f'Error creating default admin: {str(e)}')
        db.session.rollback()

# Register this to run when app context is available
@auth_bp.before_app_first_request
def initialize_auth():
    """Initialize authentication on first request"""
    create_default_admin()
