"""
File Indexer Service - Complete Implementation
Scans and indexes files from the code repository
"""

import os
import hashlib
import mimetypes
from datetime import datetime
from pathlib import Path
from app.models import File, Project, Tag, db
import chardet
from flask import current_app

class FileIndexer:
    def __init__(self):
        self.allowed_extensions = os.getenv('ALLOWED_EXTENSIONS', '').split(',')
        self.max_file_size = self._parse_size(os.getenv('MAX_FILE_SIZE', '50MB'))
        self.indexed_count = 0
        self.updated_count = 0
        self.errors = []
        self.skipped_count = 0
    
    def _parse_size(self, size_str):
        """Parse size string to bytes"""
        size_str = size_str.upper().strip()
        if size_str.endswith('KB'):
            return int(size_str[:-2]) * 1024
        elif size_str.endswith('MB'):
            return int(size_str[:-2]) * 1024 * 1024
        elif size_str.endswith('GB'):
            return int(size_str[:-2]) * 1024 * 1024 * 1024
        return int(size_str)
    
    def _get_file_info(self, filepath):
        """Get file information"""
        try:
            stat = os.stat(filepath)
            size = stat.st_size
            modified_date = datetime.fromtimestamp(stat.st_mtime)
            
            # Skip files that are too large
            if size > self.max_file_size:
                return None
            
            # Count lines for text files
            line_count = 0
            try:
                # Detect encoding
                with open(filepath, 'rb') as f:
                    raw_data = f.read(min(10000, size))  # Read first 10KB
                    detected = chardet.detect(raw_data)
                    encoding = detected['encoding'] or 'utf-8'
                
                # Count lines
                with open(filepath, 'r', encoding=encoding, errors='replace') as f:
                    line_count = sum(1 for _ in f)
            except:
                line_count = 0
            
            # Calculate file hash
            hasher = hashlib.sha256()
            with open(filepath, 'rb') as f:
                while chunk := f.read(8192):
                    hasher.update(chunk)
            
            return {
                'size': size,
                'line_count': line_count,
                'modified_date': modified_date,
                'content_hash': hasher.hexdigest()
            }
        except Exception as e:
            self.errors.append(f"Error reading {filepath}: {str(e)}")
            return None
    
    def _should_index_file(self, filepath):
        """Check if file should be indexed"""
        # Skip hidden files
        if os.path.basename(filepath).startswith('.'):
            return False
        
        # Skip binary files
        mime_type = mimetypes.guess_type(filepath)[0]
        if mime_type and not mime_type.startswith('text/'):
            return False
        
        # Check allowed extensions
        if self.allowed_extensions:
            ext = Path(filepath).suffix.lower()
            return ext in self.allowed_extensions
        
        return True
    
    def _extract_project_name(self, filepath, base_path):
        """Extract project name from file path"""
        try:
            rel_path = os.path.relpath(filepath, base_path)
            parts = rel_path.split(os.sep)
            
            # Use first directory as project name
            if len(parts) > 1:
                return parts[0]
            else:
                return "Default"
        except:
            return "Default"
    
    def _auto_generate_tags(self, filepath, content=None):
        """Automatically generate tags based on file content and name"""
        tags = []
        filename = os.path.basename(filepath).lower()
        ext = Path(filepath).suffix.lower()
        
        # File type based tags
        file_type_tags = {
            '.ino': ['arduino'],
            '.py': ['python'],
            '.js': ['javascript'],
            '.c': ['c'],
            '.cpp': ['cpp', 'c++'],
            '.h': ['c', 'header'],
            '.hpp': ['cpp', 'c++', 'header'],
            '.java': ['java'],
            '.cs': ['csharp', 'c#'],
            '.php': ['php'],
            '.rb': ['ruby'],
            '.go': ['go', 'golang'],
            '.rs': ['rust'],
            '.swift': ['swift', 'ios'],
            '.kt': ['kotlin', 'android'],
            '.m': ['objective-c', 'ios'],
            '.mm': ['objective-c++', 'ios'],
            '.sql': ['sql', 'database'],
            '.html': ['html', 'web'],
            '.css': ['css', 'web'],
            '.scss': ['scss', 'sass', 'web'],
            '.xml': ['xml'],
            '.json': ['json'],
            '.yaml': ['yaml', 'config'],
            '.yml': ['yaml', 'config'],
            '.md': ['markdown', 'documentation'],
            '.txt': ['text']
        }
        
        if ext in file_type_tags:
            tags.extend(file_type_tags[ext])
        
        # Content-based tags
        keywords = {
            'motor': ['motor', 'hardware'],
            'sensor': ['sensor', 'hardware'],
            'servo': ['servo', 'motor', 'hardware'],
            'bluetooth': ['bluetooth', 'wireless'],
            'wifi': ['wifi', 'wireless', 'network'],
            'esp32': ['esp32', 'microcontroller'],
            'esp8266': ['esp8266', 'microcontroller'],
            'arduino': ['arduino', 'microcontroller'],
            'raspberry': ['raspberry-pi', 'sbc'],
            'serial': ['serial', 'communication'],
            'i2c': ['i2c', 'communication'],
            'spi': ['spi', 'communication'],
            'mqtt': ['mqtt', 'iot'],
            'http': ['http', 'web', 'api'],
            'database': ['database'],
            'api': ['api'],
            'test': ['testing'],
            'config': ['configuration'],
            'setup': ['setup', 'configuration'],
            'main': ['main', 'entry-point'],
            'lib': ['library'],
            'util': ['utility'],
            'helper': ['helper', 'utility']
        }
        
        # Check filename for keywords
        for keyword, keyword_tags in keywords.items():
            if keyword in filename:
                tags.extend(keyword_tags)
        
        # Remove duplicates
        return list(set(tags))
    
    def index_file(self, filepath, base_path):
        """Index a single file"""
        if not self._should_index_file(filepath):
            self.skipped_count += 1
            return False
        
        # Get file info
        file_info = self._get_file_info(filepath)
        if not file_info:
            self.skipped_count += 1
            return False
        
        # Extract project name
        project_name = self._extract_project_name(filepath, base_path)
        
        # Get or create project
        project = Project.query.filter_by(name=project_name).first()
        if not project:
            project = Project(
                name=project_name,
                description=f"Auto-created project for {project_name}"
            )
            db.session.add(project)
            db.session.flush()
        
        # Check if file already exists
        existing = File.query.filter_by(filepath=filepath).first()
        
        if existing:
            # Update existing file if it has changed
            if existing.content_hash != file_info['content_hash']:
                existing.size = file_info['size']
                existing.line_count = file_info['line_count']
                existing.modified_date = file_info['modified_date']
                existing.content_hash = file_info['content_hash']
                existing.indexed_date = datetime.utcnow()
                self.updated_count += 1
            return True
        
        # Create new file record
        filename = os.path.basename(filepath)
        filetype = Path(filepath).suffix.lower()
        
        new_file = File(
            filename=filename,
            filepath=filepath,
            filetype=filetype,
            project_id=project.id,
            size=file_info['size'],
            line_count=file_info['line_count'],
            modified_date=file_info['modified_date'],
            content_hash=file_info['content_hash'],
            description=f"Auto-indexed from {project_name}"
        )
        
        # Auto-generate and add tags
        auto_tags = self._auto_generate_tags(filepath)
        for tag_name in auto_tags:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(
                    name=tag_name,
                    description=f"Auto-generated tag"
                )
                db.session.add(tag)
                db.session.flush()
            new_file.tags.append(tag)
        
        db.session.add(new_file)
        self.indexed_count += 1
        return True
    
    def index_directory(self, directory_path):
        """Recursively index all files in a directory"""
        self.indexed_count = 0
        self.updated_count = 0
        self.skipped_count = 0
        self.errors = []
        
        if not os.path.exists(directory_path):
            self.errors.append(f"Directory not found: {directory_path}")
            return {
                'files_indexed': 0,
                'files_updated': 0,
                'files_skipped': 0,
                'errors': self.errors
            }
        
        try:
            # Walk through directory
            for root, dirs, files in os.walk(directory_path):
                # Skip hidden directories
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                # Skip common non-code directories
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'dist', 'build', 'out']]
                
                for file in files:
                    if file.startswith('.'):
                        continue
                    
                    filepath = os.path.join(root, file)
                    try:
                        self.index_file(filepath, directory_path)
                    except Exception as e:
                        self.errors.append(f"Error indexing {filepath}: {str(e)}")
                
                # Commit batch
                if (self.indexed_count + self.updated_count) % 100 == 0:
                    db.session.commit()
            
            # Final commit
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            self.errors.append(f"Indexing error: {str(e)}")
        
        return {
            'files_indexed': self.indexed_count,
            'files_updated': self.updated_count,
            'files_skipped': self.skipped_count,
            'errors': self.errors
        }
