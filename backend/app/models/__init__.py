"""
Database Models for DC Codex
"""

from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db

class User(UserMixin, db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    full_name = db.Column(db.String(255))
    role = db.Column(db.String(50), default='user')
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    search_logs = db.relationship('SearchLog', backref='user', lazy='dynamic')
    downloads = db.relationship('FileDownload', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password matches"""
        return check_password_hash(self.password_hash, password)

class Project(db.Model):
    """Project model"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    files = db.relationship('File', backref='project', lazy='dynamic')

# Association table for many-to-many relationship
file_tags = db.Table('file_tags',
    db.Column('file_id', db.Integer, db.ForeignKey('files.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id'), primary_key=True)
)

class File(db.Model):
    """File model"""
    __tablename__ = 'files'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.Text, unique=True, nullable=False)
    filetype = db.Column(db.String(50))
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'))
    description = db.Column(db.Text)
    size = db.Column(db.BigInteger)
    line_count = db.Column(db.Integer)
    modified_date = db.Column(db.DateTime)
    indexed_date = db.Column(db.DateTime, default=datetime.utcnow)
    content_hash = db.Column(db.String(64))
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    tags = db.relationship('Tag', secondary=file_tags, lazy='subquery',
                          backref=db.backref('files', lazy=True))
    downloads = db.relationship('FileDownload', backref='file', lazy='dynamic')

class Tag(db.Model):
    """Tag model"""
    __tablename__ = 'tags'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

class SearchLog(db.Model):
    """Search log model"""
    __tablename__ = 'search_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    search_term = db.Column(db.Text, nullable=False)
    results_count = db.Column(db.Integer)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    user_ip = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class FileDownload(db.Model):
    """File download tracking model"""
    __tablename__ = 'file_downloads'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    download_timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_ip = db.Column(db.String(45))
