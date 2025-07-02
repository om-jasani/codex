#!/usr/bin/env python3
"""
Codex Database Cleanup Utility
Provides comprehensive database cleaning options
"""

import os
import sys
import argparse
from datetime import datetime

# Setup paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, backend_path)

def setup_app():
    """Setup Flask app context"""
    from app import create_app, db
    app = create_app()
    return app, db

def clean_all_data():
    """Remove all data from database (keeps structure)"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning all data from database...")
            
            # Import models
            from app.models import User, Project, File, Tag, file_tags
            
            # Delete all data in correct order (respecting foreign keys)
            db.engine.execute(file_tags.delete())
            File.query.delete()
            Tag.query.delete()
            Project.query.delete()
            
            # Keep admin user, delete others
            User.query.filter(User.username != 'admin').delete()
            
            db.session.commit()
            print("✅ All data cleaned successfully!")
            print("ℹ️  Admin user preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning data: {e}")
            db.session.rollback()

def clean_files_only():
    """Remove only files data"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning files data from database...")
            
            # Import models
            from app.models import File, file_tags
            
            # Delete file data
            db.engine.execute(file_tags.delete())
            File.query.delete()
            
            db.session.commit()
            print("✅ Files data cleaned successfully!")
            print("ℹ️  Projects, tags, and users preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning files: {e}")
            db.session.rollback()

def clean_projects_only():
    """Remove only projects and their files"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning projects and their files from database...")
            
            # Import models
            from app.models import Project, File, file_tags
            
            # Delete project-related data
            db.engine.execute(file_tags.delete())
            File.query.delete()
            Project.query.delete()
            
            db.session.commit()
            print("✅ Projects and files cleaned successfully!")
            print("ℹ️  Tags and users preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning projects: {e}")
            db.session.rollback()

def clean_tags_only():
    """Remove only tags"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning tags from database...")
            
            # Import models
            from app.models import Tag, file_tags
            
            # Delete tag data
            db.engine.execute(file_tags.delete())
            Tag.query.delete()
            
            db.session.commit()
            print("✅ Tags cleaned successfully!")
            print("ℹ️  Files, projects, and users preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning tags: {e}")
            db.session.rollback()

def clean_users_keep_admin():
    """Remove all users except admin"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning non-admin users from database...")
            
            # Import models
            from app.models import User
            
            # Delete non-admin users
            deleted_count = User.query.filter(User.username != 'admin').delete()
            
            db.session.commit()
            print(f"✅ Cleaned {deleted_count} non-admin users successfully!")
            print("ℹ️  Admin user preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning users: {e}")
            db.session.rollback()

def clean_inactive_files():
    """Remove only inactive files"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning inactive files from database...")
            
            # Import models
            from app.models import File
            
            # Count and delete inactive files
            inactive_count = File.query.filter(File.is_active == False).count()
            File.query.filter(File.is_active == False).delete()
            
            db.session.commit()
            print(f"✅ Cleaned {inactive_count} inactive files successfully!")
            print("ℹ️  Active files preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning inactive files: {e}")
            db.session.rollback()

def show_database_stats():
    """Show current database statistics"""
    app, db = setup_app()
    with app.app_context():
        try:
            # Import models
            from app.models import User, Project, File, Tag
            
            print("📊 Current Database Statistics:")
            print("-" * 40)
            print(f"👥 Users: {User.query.count()}")
            print(f"   - Admin users: {User.query.filter(User.role == 'admin').count()}")
            print(f"   - Regular users: {User.query.filter(User.role == 'user').count()}")
            print(f"   - Active users: {User.query.filter(User.is_active == True).count()}")
            print()
            print(f"📁 Projects: {Project.query.count()}")
            print()
            print(f"📄 Files: {File.query.count()}")
            print(f"   - Active files: {File.query.filter(File.is_active == True).count()}")
            print(f"   - Inactive files: {File.query.filter(File.is_active == False).count()}")
            print()
            print(f"🏷️  Tags: {Tag.query.count()}")
            print()
            
            # File type distribution
            file_counts = db.session.query(File.filetype, db.func.count(File.id)).group_by(File.filetype).all()
            if file_counts:
                print("📈 File Type Distribution:")
                for filetype, count in file_counts[:10]:  # Top 10
                    print(f"   {filetype or 'no extension'}: {count}")
            
        except Exception as e:
            print(f"❌ Error getting database stats: {e}")

def confirm_action(action_name):
    """Confirm dangerous actions"""
    print(f"⚠️  WARNING: This will permanently delete {action_name}!")
    print("This action cannot be undone.")
    
    confirmation = input("Type 'YES' to confirm: ")
    return confirmation == 'YES'

def main():
    parser = argparse.ArgumentParser(description='Codex Database Cleanup Utility')
    parser.add_argument('action', choices=[
        'all', 'files', 'projects', 'tags', 'users', 'inactive', 'stats'
    ], help='Cleanup action to perform')
    parser.add_argument('--confirm', action='store_true', 
                       help='Skip confirmation prompt')
    
    args = parser.parse_args()
    
    print("🧹 Codex Database Cleanup Utility")
    print("=" * 50)
    
    # Show current stats first
    show_database_stats()
    print()
    
    if args.action == 'stats':
        return
    
    # Confirmation for destructive actions
    if not args.confirm:
        action_descriptions = {
            'all': 'all data (keep admin user)',
            'files': 'all files data',
            'projects': 'all projects and their files',
            'tags': 'all tags',
            'users': 'all users except admin',
            'inactive': 'all inactive files'
        }
        
        if not confirm_action(action_descriptions[args.action]):
            print("❌ Operation cancelled")
            return
    
    # Execute the cleanup action
    actions = {
        'all': clean_all_data,
        'files': clean_files_only,
        'projects': clean_projects_only,
        'tags': clean_tags_only,
        'users': clean_users_keep_admin,
        'inactive': clean_inactive_files
    }
    
    actions[args.action]()
    
    print()
    print("📊 Updated Database Statistics:")
    show_database_stats()

if __name__ == "__main__":
    main()
