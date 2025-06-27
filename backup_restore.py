#!/usr/bin/env python3
"""
Codex Backup & Restore Utility
Provides comprehensive backup and restore functionality
"""

import os
import sys
import json
import zipfile
import shutil
import argparse
from datetime import datetime

# Setup paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def setup_app():
    """Setup Flask app context"""
    from app import create_app, db
    app = create_app()
    return app, db

def create_backup(backup_name=None):
    """Create a complete backup of the system"""
    if not backup_name:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"codex_backup_{timestamp}"
    
    backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    
    backup_path = os.path.join(backup_dir, f"{backup_name}.zip")
    
    print(f"🔄 Creating backup: {backup_name}")
    print("=" * 50)
    
    try:
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as backup_zip:
            
            # 1. Export database data
            print("📊 Exporting database data...")
            db_data = export_database_data()
            backup_zip.writestr('database/data.json', json.dumps(db_data, indent=2, default=str))
            
            # 2. Backup database schema
            print("🗄️  Backing up database schema...")
            schema_path = os.path.join(os.path.dirname(__file__), 'database', 'schema.sql')
            if os.path.exists(schema_path):
                backup_zip.write(schema_path, 'database/schema.sql')
            
            # 3. Backup file storage
            print("📁 Backing up file storage...")
            file_storage_path = os.path.join(os.path.dirname(__file__), 'file_storage')
            if os.path.exists(file_storage_path):
                for root, dirs, files in os.walk(file_storage_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arc_path = os.path.relpath(file_path, os.path.dirname(__file__))
                        backup_zip.write(file_path, arc_path)
            
            # 4. Backup configuration
            print("⚙️  Backing up configuration...")
            config_files = ['.env', 'requirements.txt']
            for config_file in config_files:
                config_path = os.path.join(os.path.dirname(__file__), config_file)
                if os.path.exists(config_path):
                    backup_zip.write(config_path, f'config/{config_file}')
            
            # 5. Create backup manifest
            print("📋 Creating backup manifest...")
            manifest = {
                'backup_name': backup_name,
                'created_at': datetime.now().isoformat(),
                'version': '1.0.0',
                'contents': {
                    'database_data': True,
                    'database_schema': os.path.exists(schema_path),
                    'file_storage': os.path.exists(file_storage_path),
                    'configuration': True
                },
                'statistics': db_data.get('statistics', {})
            }
            backup_zip.writestr('manifest.json', json.dumps(manifest, indent=2))
        
        backup_size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
        print(f"✅ Backup created successfully!")
        print(f"📄 File: {backup_path}")
        print(f"📏 Size: {backup_size:.2f} MB")
        return backup_path
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        if os.path.exists(backup_path):
            os.remove(backup_path)
        return None

def export_database_data():
    """Export all database data to JSON format"""
    app, db = setup_app()
    with app.app_context():
        from app.models import User, Project, File, Tag
        
        data = {
            'users': [],
            'projects': [],
            'files': [],
            'tags': [],
            'file_tags': [],
            'statistics': {}
        }
        
        # Export users (excluding passwords for security)
        for user in User.query.all():
            data['users'].append({
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'email': user.email,
                'role': user.role,
                'is_active': user.is_active,
                'created_at': user.created_at,
                'last_login': user.last_login
            })
        
        # Export projects
        for project in Project.query.all():
            data['projects'].append({
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'created_at': project.created_at
            })
        
        # Export tags
        for tag in Tag.query.all():
            data['tags'].append({
                'id': tag.id,
                'name': tag.name,
                'description': tag.description,
                'created_at': tag.created_at
            })
        
        # Export files
        for file in File.query.all():
            file_data = {
                'id': file.id,
                'filename': file.filename,
                'filepath': file.filepath,
                'filetype': file.filetype,
                'size': file.size,
                'description': file.description,
                'content': file.content,
                'line_count': file.line_count,
                'project_id': file.project_id,
                'created_at': file.created_at,
                'updated_at': file.updated_at,
                'tags': [tag.id for tag in file.tags]
            }
            data['files'].append(file_data)
            
            # Collect file-tag relationships
            for tag in file.tags:
                data['file_tags'].append({
                    'file_id': file.id,
                    'tag_id': tag.id
                })
        
        # Add statistics
        data['statistics'] = {
            'users_count': len(data['users']),
            'projects_count': len(data['projects']),
            'files_count': len(data['files']),
            'tags_count': len(data['tags']),
            'export_time': datetime.now().isoformat()
        }
        
        return data

def restore_backup(backup_path, force=False):
    """Restore system from backup"""
    if not os.path.exists(backup_path):
        print(f"❌ Backup file not found: {backup_path}")
        return False
    
    print(f"🔄 Restoring from backup: {backup_path}")
    print("=" * 50)
    
    try:
        with zipfile.ZipFile(backup_path, 'r') as backup_zip:
            
            # 1. Read manifest
            manifest_data = backup_zip.read('manifest.json')
            manifest = json.loads(manifest_data)
            
            print(f"📋 Backup Info:")
            print(f"   Name: {manifest['backup_name']}")
            print(f"   Created: {manifest['created_at']}")
            print(f"   Statistics: {manifest['statistics']}")
            
            if not force:
                response = input("\n⚠️  This will replace all current data. Continue? (yes/no): ")
                if response.lower() not in ['yes', 'y']:
                    print("❌ Restore cancelled")
                    return False
            
            # 2. Clean current data
            print("🗑️  Cleaning current data...")
            clean_for_restore()
            
            # 3. Restore database data
            print("📊 Restoring database data...")
            db_data_json = backup_zip.read('database/data.json')
            db_data = json.loads(db_data_json)
            restore_database_data(db_data)
            
            # 4. Restore file storage
            print("📁 Restoring file storage...")
            file_storage_path = os.path.join(os.path.dirname(__file__), 'file_storage')
            os.makedirs(file_storage_path, exist_ok=True)
            
            for file_info in backup_zip.infolist():
                if file_info.filename.startswith('file_storage/'):
                    backup_zip.extract(file_info, os.path.dirname(__file__))
            
            # 5. Restore configuration (optional)
            config_response = input("Restore configuration files (.env, etc.)? (y/n): ")
            if config_response.lower() in ['y', 'yes']:
                print("⚙️  Restoring configuration...")
                for file_info in backup_zip.infolist():
                    if file_info.filename.startswith('config/'):
                        # Extract to root directory
                        config_name = os.path.basename(file_info.filename)
                        config_content = backup_zip.read(file_info)
                        with open(config_name, 'wb') as f:
                            f.write(config_content)
        
        print("✅ Restore completed successfully!")
        print("ℹ️  Please restart the application")
        return True
        
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        return False

def restore_database_data(data):
    """Restore database data from JSON"""
    app, db = setup_app()
    with app.app_context():
        from app.models import User, Project, File, Tag
        
        # Clear existing data
        db.engine.execute("DELETE FROM file_tags")
        File.query.delete()
        Tag.query.delete()
        Project.query.delete()
        User.query.delete()
        db.session.commit()
        
        # Restore users
        for user_data in data['users']:
            user = User(
                username=user_data['username'],
                full_name=user_data['full_name'],
                email=user_data['email'],
                role=user_data['role'],
                is_active=user_data['is_active']
            )
            # Set a default password - should be changed after restore
            user.set_password('admin123')
            db.session.add(user)
        
        # Restore projects
        for project_data in data['projects']:
            project = Project(
                name=project_data['name'],
                description=project_data['description']
            )
            db.session.add(project)
        
        # Restore tags
        for tag_data in data['tags']:
            tag = Tag(
                name=tag_data['name'],
                description=tag_data['description']
            )
            db.session.add(tag)
        
        db.session.commit()
        
        # Restore files (after projects and tags are committed)
        for file_data in data['files']:
            file = File(
                filename=file_data['filename'],
                filepath=file_data['filepath'],
                filetype=file_data['filetype'],
                size=file_data['size'],
                description=file_data['description'],
                content=file_data['content'],
                line_count=file_data['line_count'],
                project_id=file_data['project_id']
            )
            db.session.add(file)
            
        db.session.commit()
        
        # Restore file-tag relationships
        for file_tag in data['file_tags']:
            file = File.query.get(file_tag['file_id'])
            tag = Tag.query.get(file_tag['tag_id'])
            if file and tag:
                file.tags.append(tag)
        
        db.session.commit()

def clean_for_restore():
    """Clean system for restore"""
    app, db = setup_app()
    with app.app_context():
        from app.models import User, Project, File, Tag
        
        # Clean database
        db.engine.execute("DELETE FROM file_tags")
        File.query.delete()
        Tag.query.delete()
        Project.query.delete()
        User.query.delete()
        db.session.commit()
        
        # Clean file storage
        file_storage_path = os.path.join(os.path.dirname(__file__), 'file_storage')
        if os.path.exists(file_storage_path):
            shutil.rmtree(file_storage_path)
        os.makedirs(file_storage_path, exist_ok=True)

def list_backups():
    """List available backups"""
    backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
    if not os.path.exists(backup_dir):
        print("📁 No backups directory found")
        return
    
    backups = [f for f in os.listdir(backup_dir) if f.endswith('.zip')]
    if not backups:
        print("📁 No backups found")
        return
    
    print("📁 Available Backups:")
    print("-" * 50)
    
    for backup_file in sorted(backups, reverse=True):
        backup_path = os.path.join(backup_dir, backup_file)
        size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
        modified = datetime.fromtimestamp(os.path.getmtime(backup_path))
        
        # Try to read manifest
        try:
            with zipfile.ZipFile(backup_path, 'r') as backup_zip:
                manifest_data = backup_zip.read('manifest.json')
                manifest = json.loads(manifest_data)
                stats = manifest.get('statistics', {})
                print(f"📄 {backup_file}")
                print(f"   Size: {size:.2f} MB")
                print(f"   Date: {modified.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   Files: {stats.get('files_count', 'N/A')}")
                print(f"   Projects: {stats.get('projects_count', 'N/A')}")
                print("")
        except:
            print(f"📄 {backup_file} (corrupted or old format)")
            print(f"   Size: {size:.2f} MB")
            print(f"   Date: {modified.strftime('%Y-%m-%d %H:%M:%S')}")
            print("")

def main():
    parser = argparse.ArgumentParser(description='Codex Backup & Restore Utility')
    parser.add_argument('action', choices=['backup', 'restore', 'list'], 
                       help='Action to perform')
    parser.add_argument('--name', help='Backup name (for backup)')
    parser.add_argument('--file', help='Backup file path (for restore)')
    parser.add_argument('--force', action='store_true', help='Skip confirmations')
    
    args = parser.parse_args()
    
    print("💾 Codex Backup & Restore Utility")
    print("=" * 50)
    
    if args.action == 'backup':
        create_backup(args.name)
    elif args.action == 'restore':
        if not args.file:
            print("❌ Please specify backup file with --file")
            list_backups()
            return
        restore_backup(args.file, args.force)
    elif args.action == 'list':
        list_backups()

if __name__ == "__main__":
    main()
