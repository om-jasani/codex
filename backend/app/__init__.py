"""
DC Codex - Internal Code Search System
Complete Backend Application with All Features
"""

import os
import sys
from flask import Flask, send_from_directory, send_file, jsonify, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
from werkzeug.security import check_password_hash
import mimetypes

# Load environment variables
load_dotenv()

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

def create_app(config_name='production'):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('DATABASE_USER')}:{os.getenv('DATABASE_PASSWORD')}@{os.getenv('DATABASE_HOST')}:{os.getenv('DATABASE_PORT')}/{os.getenv('DATABASE_NAME')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
    
    # CORS configuration
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = None
    login_manager.session_protection = 'strong'
    
    # Configure logging
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    log_file = os.getenv('LOG_FILE_PATH', 'logs/codex.log')
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10485760,  # 10MB
        backupCount=int(os.getenv('LOG_BACKUP_COUNT', 5))
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Codex startup')
    
    # Import models here to avoid circular imports
    from app.models import User
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Authentication required'}), 401
        return redirect('/login.html')
    
    # Register blueprints
    from app.api import search_bp, admin_bp, auth_bp, file_bp
    app.register_blueprint(search_bp, url_prefix='/api/search')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(file_bp, url_prefix='/api/files')
    
    # Frontend routes
    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend'))
    
    @app.route('/')
    def index():
        """Main search page"""
        return send_from_directory(frontend_path, 'index.html')
    
    @app.route('/login.html')
    @app.route('/login')
    def login():
        """Login page"""
        if current_user.is_authenticated:
            return redirect('/')
        return send_from_directory(frontend_path, 'login.html')
    
    @app.route('/admin.html')
    @app.route('/admin')
    @login_required
    def admin():
        """Admin panel - requires authentication"""
        if current_user.role != 'admin':
            return redirect('/')
        return send_from_directory(frontend_path, 'admin.html')
    
    @app.route('/logout')
    @login_required
    def logout():
        """Logout and redirect to login"""
        logout_user()
        return redirect('/login.html')
    
    # Static files
    @app.route('/css/<path:filename>')
    def css_files(filename):
        return send_from_directory(os.path.join(frontend_path, 'public', 'css'), filename)
    
    @app.route('/js/<path:filename>')
    def js_files(filename):
        return send_from_directory(os.path.join(frontend_path, 'public', 'js'), filename)
    
    # Favicon
    @app.route('/favicon.ico')
    def favicon():
        return send_from_directory(frontend_path, 'favicon.ico', mimetype='image/x-icon')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Resource not found'}), 404
        return redirect('/')
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        app.logger.error(f'Internal error: {error}')
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Internal server error'}), 500
        return redirect('/')
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({'error': 'File too large. Maximum size is 100MB'}), 413
    
    return app
