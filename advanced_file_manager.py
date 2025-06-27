#!/usr/bin/env python3
"""
Advanced File Management System - Complete Solution
Handles all file synchronization issues and edge cases
"""

import os
import sys
import hashlib
import shutil
from datetime import datetime
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from app.models import db, File, Project, Tag
from app.services.file_indexer import FileIndexer

class AdvancedFileManager:
    """
    Advanced file management system that handles:
    - Database-filesystem synchronization
    - Orphaned file cleanup
    - Ghost file resurrection
    - Smart re-indexing
    - File integrity verification
    """
    
    def __init__(self):
        self.app = create_app()
        self.issues_found = []
        self.actions_taken = []
        
    def analyze_system(self):
        """Comprehensive system analysis"""
        print("🔍 Starting Comprehensive File System Analysis...")
        print("=" * 60)
        
        with self.app.app_context():
            # 1. Check for orphaned database records
            self._check_orphaned_db_records()
            
            # 2. Check for orphaned files on disk
            self._check_orphaned_files()
            
            # 3. Check for ghost files (inactive but exist on disk)
            self._check_ghost_files()
            
            # 4. Check for duplicate records
            self._check_duplicate_records()
            
            # 5. Check for hash mismatches
            self._check_hash_mismatches()
            
        self._generate_report()
        
    def fix_all_issues(self, auto_fix=False):
        """Fix all detected issues"""
        print("\n🔧 Starting Automated Fixes...")
        print("-" * 60)
        
        if not auto_fix:
            print("Issues found:")
            for i, issue in enumerate(self.issues_found, 1):
                print(f"  {i}. {issue}")
            
            if not self.issues_found:
                print("✅ No issues found!")
                return
                
            confirm = input("\nDo you want to fix all issues? (yes/no): ").lower()
            if confirm != 'yes':
                print("❌ Fixes cancelled.")
                return
        
        with self.app.app_context():
            try:
                # Fix ghost files first
                self._fix_ghost_files()
                
                # Fix orphaned database records
                self._fix_orphaned_db_records()
                
                # Fix duplicate records
                self._fix_duplicate_records()
                
                # Fix hash mismatches
                self._fix_hash_mismatches()
                
                db.session.commit()
                print("✅ All fixes applied successfully!")
                
            except Exception as e:
                db.session.rollback()
                print(f"❌ Error during fixes: {e}")
    
    def smart_reindex(self, directory_path=None, project_id=None):
        """Smart re-indexing that handles all edge cases"""
        print("\n🚀 Starting Smart Re-indexing...")
        print("-" * 60)
        
        if not directory_path:
            directory_path = os.getenv('CODE_REPOSITORY_PATH', os.path.join(os.path.dirname(__file__), 'sample-data'))
        
        with self.app.app_context():
            indexer = AdvancedFileIndexer()
            result = indexer.smart_index_directory(directory_path, project_id)
            
            print(f"\n📊 Smart Re-indexing Results:")
            print(f"   📄 Files indexed: {result['files_indexed']}")
            print(f"   🔄 Files updated: {result['files_updated']}")
            print(f"   👻 Ghost files reactivated: {result['ghost_files_reactivated']}")
            print(f"   ⏭️  Files skipped: {result['files_skipped']}")
            print(f"   ❌ Errors: {len(result['errors'])}")
            
            if result['errors']:
                print("\n⚠️  Errors encountered:")
                for error in result['errors'][:5]:  # Show first 5 errors
                    print(f"   • {error}")
    
    def _check_orphaned_db_records(self):
        """Check for database records where files don't exist on disk"""
        print("🔍 Checking for orphaned database records...")
        
        orphaned = []
        files = File.query.filter_by(is_active=True).all()
        
        for file in files:
            if not os.path.exists(file.filepath):
                orphaned.append(file)
                self.issues_found.append(f"Orphaned DB record: {file.filename} (ID: {file.id})")
        
        if orphaned:
            print(f"   ⚠️  Found {len(orphaned)} orphaned database records")
        else:
            print("   ✅ No orphaned database records found")
        
        self.orphaned_db_records = orphaned
    
    def _check_orphaned_files(self):
        """Check for files on disk that aren't in database"""
        print("🔍 Checking for orphaned files on disk...")
        
        repo_path = os.getenv('CODE_REPOSITORY_PATH', os.path.join(os.path.dirname(__file__), 'sample-data'))
        if not os.path.exists(repo_path):
            print(f"   ⚠️  Repository path not found: {repo_path}")
            return
        
        orphaned_files = []
        for root, dirs, files in os.walk(repo_path):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for filename in files:
                if filename.startswith('.'):
                    continue
                    
                filepath = os.path.join(root, filename)
                
                # Check if file exists in database
                if not File.query.filter_by(filepath=filepath).first():
                    orphaned_files.append(filepath)
                    self.issues_found.append(f"Orphaned file on disk: {filepath}")
        
        if orphaned_files:
            print(f"   ⚠️  Found {len(orphaned_files)} orphaned files on disk")
        else:
            print("   ✅ No orphaned files found on disk")
        
        self.orphaned_files = orphaned_files
    
    def _check_ghost_files(self):
        """Check for files that exist on disk but are marked inactive in DB"""
        print("🔍 Checking for ghost files (inactive but exist on disk)...")
        
        ghost_files = []
        inactive_files = File.query.filter_by(is_active=False).all()
        
        for file in inactive_files:
            if os.path.exists(file.filepath):
                ghost_files.append(file)
                self.issues_found.append(f"Ghost file: {file.filename} (exists on disk but marked inactive)")
        
        if ghost_files:
            print(f"   👻 Found {len(ghost_files)} ghost files")
        else:
            print("   ✅ No ghost files found")
        
        self.ghost_files = ghost_files
    
    def _check_duplicate_records(self):
        """Check for duplicate database records"""
        print("🔍 Checking for duplicate database records...")
        
        duplicates = []
        filepaths = {}
        files = File.query.all()
        
        for file in files:
            if file.filepath in filepaths:
                duplicates.append((filepaths[file.filepath], file))
                self.issues_found.append(f"Duplicate record: {file.filepath}")
            else:
                filepaths[file.filepath] = file
        
        if duplicates:
            print(f"   ⚠️  Found {len(duplicates)} duplicate records")
        else:
            print("   ✅ No duplicate records found")
        
        self.duplicate_records = duplicates
    
    def _check_hash_mismatches(self):
        """Check for files where stored hash doesn't match actual file"""
        print("🔍 Checking for hash mismatches...")
        
        mismatches = []
        files = File.query.filter_by(is_active=True).all()
        
        for file in files:
            if os.path.exists(file.filepath):
                actual_hash = self._calculate_hash(file.filepath)
                if actual_hash and file.content_hash and actual_hash != file.content_hash:
                    mismatches.append(file)
                    self.issues_found.append(f"Hash mismatch: {file.filename}")
        
        if mismatches:
            print(f"   ⚠️  Found {len(mismatches)} hash mismatches")
        else:
            print("   ✅ No hash mismatches found")
        
        self.hash_mismatches = mismatches
    
    def _fix_ghost_files(self):
        """Reactivate ghost files"""
        if hasattr(self, 'ghost_files') and self.ghost_files:
            print(f"👻 Reactivating {len(self.ghost_files)} ghost files...")
            for file in self.ghost_files:
                file.is_active = True
                file.indexed_date = datetime.utcnow()
                self.actions_taken.append(f"Reactivated ghost file: {file.filename}")
    
    def _fix_orphaned_db_records(self):
        """Remove orphaned database records"""
        if hasattr(self, 'orphaned_db_records') and self.orphaned_db_records:
            print(f"🗑️  Removing {len(self.orphaned_db_records)} orphaned database records...")
            for file in self.orphaned_db_records:
                db.session.delete(file)
                self.actions_taken.append(f"Removed orphaned DB record: {file.filename}")
    
    def _fix_duplicate_records(self):
        """Fix duplicate records by keeping the most recent one"""
        if hasattr(self, 'duplicate_records') and self.duplicate_records:
            print(f"🔄 Fixing {len(self.duplicate_records)} duplicate records...")
            for original, duplicate in self.duplicate_records:
                # Keep the more recent one
                if duplicate.indexed_date > original.indexed_date:
                    db.session.delete(original)
                    self.actions_taken.append(f"Removed older duplicate: {original.filename}")
                else:
                    db.session.delete(duplicate)
                    self.actions_taken.append(f"Removed newer duplicate: {duplicate.filename}")
    
    def _fix_hash_mismatches(self):
        """Fix hash mismatches by updating stored hashes"""
        if hasattr(self, 'hash_mismatches') and self.hash_mismatches:
            print(f"🔧 Fixing {len(self.hash_mismatches)} hash mismatches...")
            for file in self.hash_mismatches:
                new_hash = self._calculate_hash(file.filepath)
                if new_hash:
                    file.content_hash = new_hash
                    self.actions_taken.append(f"Updated hash for: {file.filename}")
    
    def _calculate_hash(self, filepath):
        """Calculate MD5 hash of a file"""
        try:
            hash_md5 = hashlib.md5()
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return None
    
    def _generate_report(self):
        """Generate analysis report"""
        print("\n📊 Analysis Report")
        print("=" * 60)
        
        if not self.issues_found:
            print("✅ System is healthy! No issues found.")
        else:
            print(f"⚠️  Found {len(self.issues_found)} issues:")
            for i, issue in enumerate(self.issues_found, 1):
                print(f"  {i}. {issue}")


class AdvancedFileIndexer(FileIndexer):
    """Enhanced file indexer that handles ghost files and edge cases"""
    
    def __init__(self):
        super().__init__()
        self.ghost_files_reactivated = 0
    
    def smart_index_directory(self, directory_path, project_id=None):
        """Smart indexing that handles ghost files"""
        self.indexed_count = 0
        self.updated_count = 0
        self.skipped_count = 0
        self.ghost_files_reactivated = 0
        self.errors = []
        
        if not os.path.exists(directory_path):
            self.errors.append(f"Directory not found: {directory_path}")
            return self._get_results()
        
        try:
            for root, dirs, files in os.walk(directory_path):
                # Skip hidden directories
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'dist', 'build', 'out']]
                
                for file in files:
                    if file.startswith('.'):
                        continue
                    
                    filepath = os.path.join(root, file)
                    try:
                        self.smart_index_file(filepath, directory_path, project_id)
                    except Exception as e:
                        self.errors.append(f"Error indexing {filepath}: {str(e)}")
                
                # Commit batch
                if (self.indexed_count + self.updated_count + self.ghost_files_reactivated) % 100 == 0:
                    db.session.commit()
            
            # Final commit
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            self.errors.append(f"Indexing error: {str(e)}")
        
        return self._get_results()
    
    def smart_index_file(self, filepath, base_path, project_id=None):
        """Smart file indexing that handles ghost files"""
        
        # Check if we should index this file
        if not self._should_index_file(filepath):
            self.skipped_count += 1
            return False
        
        # Get file info
        file_info = self._get_file_info(filepath)
        if not file_info:
            self.skipped_count += 1
            return False
        
        # Handle project
        if project_id:
            project = Project.query.get(project_id)
            if not project:
                self.errors.append(f"Project with ID {project_id} not found")
                return False
        else:
            project_name = self._extract_project_name(filepath, base_path)
            project = Project.query.filter_by(name=project_name).first()
            if not project:
                project = Project(
                    name=project_name,
                    description=f"Auto-created project for {project_name}"
                )
                db.session.add(project)
                db.session.flush()
        
        # Check for ANY existing record (active or inactive)
        existing = File.query.filter_by(filepath=filepath).first()
        
        if existing:
            if not existing.is_active:
                # This is a ghost file - reactivate it!
                existing.is_active = True
                existing.size = file_info['size']
                existing.line_count = file_info['line_count']
                existing.modified_date = file_info['modified_date']
                existing.content_hash = file_info['content_hash']
                existing.indexed_date = datetime.utcnow()
                existing.project_id = project.id
                self.ghost_files_reactivated += 1
                print(f"👻 Reactivated ghost file: {filepath}")
                return True
            else:
                # File is active, check if it needs updating
                if existing.content_hash != file_info['content_hash']:
                    existing.size = file_info['size']
                    existing.line_count = file_info['line_count']
                    existing.modified_date = file_info['modified_date']
                    existing.content_hash = file_info['content_hash']
                    existing.indexed_date = datetime.utcnow()
                    self.updated_count += 1
                    print(f"🔄 Updated: {filepath}")
                else:
                    print(f"✅ Already indexed (no changes): {filepath}")
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
            description=f"Auto-indexed from {project.name}"
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
        print(f"➕ Indexed new: {filepath}")
        return True
    
    def _get_results(self):
        """Get indexing results"""
        return {
            'files_indexed': self.indexed_count,
            'files_updated': self.updated_count,
            'ghost_files_reactivated': self.ghost_files_reactivated,
            'files_skipped': self.skipped_count,
            'errors': self.errors
        }


def main():
    print("🛠️  Advanced File Management System")
    print("=" * 60)
    print("This tool will:")
    print("- Analyze your file system for issues")
    print("- Fix database-filesystem synchronization problems")
    print("- Handle ghost files (inactive but exist on disk)")
    print("- Perform smart re-indexing")
    print()
    
    manager = AdvancedFileManager()
    
    # Analyze system
    manager.analyze_system()
    
    # Fix issues if found
    if manager.issues_found:
        manager.fix_all_issues()
    
    # Perform smart re-indexing
    manager.smart_reindex()
    
    print(f"\n🎉 Advanced File Management Complete!")
    print(f"⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == '__main__':
    main()
