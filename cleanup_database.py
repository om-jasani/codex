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
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

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
            print("🗑️  Cleaning files data...")
            
            from app.models import File, file_tags
            
            db.engine.execute(file_tags.delete())
            File.query.delete()
            db.session.commit()
            
            print("✅ Files data cleaned successfully!")
            
        except Exception as e:
            print(f"❌ Error cleaning files: {e}")
            db.session.rollback()

def clean_projects():
    """Remove projects (and associated files)"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning projects and associated files...")
            
            from app.models import Project, File, file_tags
            
            # Get files associated with projects
            files_to_delete = File.query.filter(File.project_id.isnot(None)).all()
            file_ids = [f.id for f in files_to_delete]
            
            if file_ids:
                # Delete file-tag associations
                db.engine.execute(file_tags.delete().where(file_tags.c.file_id.in_(file_ids)))
                # Delete files
                File.query.filter(File.id.in_(file_ids)).delete(synchronize_session=False)
            
            # Delete projects
            Project.query.delete()
            db.session.commit()
            
            print("✅ Projects and associated files cleaned successfully!")
            
        except Exception as e:
            print(f"❌ Error cleaning projects: {e}")
            db.session.rollback()

def clean_tags():
    """Remove tags (and associations)"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning tags...")
            
            from app.models import Tag, file_tags
            
            db.engine.execute(file_tags.delete())
            Tag.query.delete()
            db.session.commit()
            
            print("✅ Tags cleaned successfully!")
            
        except Exception as e:
            print(f"❌ Error cleaning tags: {e}")
            db.session.rollback()

def clean_users():
    """Remove users (except admin)"""
    app, db = setup_app()
    with app.app_context():
        try:
            print("🗑️  Cleaning users (except admin)...")
            
            from app.models import User
            
            deleted_count = User.query.filter(User.username != 'admin').delete()
            db.session.commit()
            
            print(f"✅ {deleted_count} users cleaned successfully!")
            print("ℹ️  Admin user preserved")
            
        except Exception as e:
            print(f"❌ Error cleaning users: {e}")
            db.session.rollback()

def show_stats():
    """Show current database statistics"""
    app, db = setup_app()
    with app.app_context():
        try:
            from app.models import User, Project, File, Tag
            
            user_count = User.query.count()
            project_count = Project.query.count()
            file_count = File.query.count()
            tag_count = Tag.query.count()
            
            print("\n📊 Current Database Statistics")
            print("=" * 40)
            print(f"👥 Users: {user_count}")
            print(f"📁 Projects: {project_count}")
            print(f"📄 Files: {file_count}")
            print(f"🏷️  Tags: {tag_count}")
            
        except Exception as e:
            print(f"❌ Error getting stats: {e}")

def clean_file_storage():
    """Clean physical file storage directory"""
    try:
        file_storage_path = os.path.join(os.path.dirname(__file__), 'file_storage')
        if os.path.exists(file_storage_path):
            import shutil
            
            print(f"🗑️  Cleaning file storage: {file_storage_path}")
            
            # Remove all contents but keep the directory
            for item in os.listdir(file_storage_path):
                item_path = os.path.join(file_storage_path, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            
            print("✅ File storage cleaned successfully!")
        else:
            print("ℹ️  File storage directory doesn't exist")
            
    except Exception as e:
        print(f"❌ Error cleaning file storage: {e}")

def main():
    parser = argparse.ArgumentParser(description='Codex Database Cleanup Utility')
    parser.add_argument('action', choices=['all', 'files', 'projects', 'tags', 'users', 'storage', 'stats'], 
                       help='Cleanup action to perform')
    parser.add_argument('--confirm', action='store_true', 
                       help='Skip confirmation prompt')
    
    args = parser.parse_args()
    
    print("🧹 Codex Database Cleanup Utility")
    print("=" * 50)
    
    if args.action == 'stats':
        show_stats()
        return
    
    # Show current stats before cleanup
    show_stats()
    
    if not args.confirm:
        print(f"\n⚠️  WARNING: This will permanently delete {args.action} data!")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Operation cancelled")
            return
    
    print(f"\n🚀 Starting {args.action} cleanup...")
    
    if args.action == 'all':
        clean_all_data()
        if input("Also clean file storage? (y/n): ").lower() in ['y', 'yes']:
            clean_file_storage()
    elif args.action == 'files':
        clean_files_only()
    elif args.action == 'projects':
        clean_projects()
    elif args.action == 'tags':
        clean_tags()
    elif args.action == 'users':
        clean_users()
    elif args.action == 'storage':
        clean_file_storage()
    
    print("\n📊 Updated Statistics:")
    show_stats()
    print(f"\n✨ Cleanup completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
