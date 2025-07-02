#!/usr/bin/env python3
"""
Simple Database Reset Script
Completely resets the database and creates a fresh admin user
"""

import os
import sys
import shutil
from datetime import datetime

# Setup paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, backend_path)

from app import create_app
from app.models import db, User, Project, File, Tag
from werkzeug.security import generate_password_hash

def reset_database():
    """Reset the entire database"""
    print("🔄 Resetting DC Codex Database...")
    print("=" * 50)
    
    app = create_app()
    
    with app.app_context():
        try:
            # Drop all tables with CASCADE
            print("🗑️  Dropping all tables with CASCADE...")
            
            # First try to drop the view manually if it exists
            try:
                db.session.execute(db.text("DROP VIEW IF EXISTS file_details CASCADE"))
                db.session.commit()
            except Exception as e:
                print(f"Note: {str(e)}")
            
            # Now drop all tables
            db.drop_all()
            
            # Create all tables
            print("🏗️  Creating fresh tables...")
            db.create_all()
            
            # Create admin user
            print("👤 Creating admin user...")
            admin_password = generate_password_hash('admin123')
            admin_user = User(
                username='admin',
                email='admin@codex.local',
                password_hash=admin_password,
                full_name='Administrator',
                role='admin',
                is_active=True
            )
            db.session.add(admin_user)
            
            # Create sample project
            print("📁 Creating sample project...")
            sample_project = Project(
                name='Sample Project',
                description='Default sample project for testing'
            )
            db.session.add(sample_project)
            
            # Create sample tags
            print("🏷️  Creating sample tags...")
            sample_tags = [
                Tag(name='python', description='Python files'),
                Tag(name='javascript', description='JavaScript files'),
                Tag(name='css', description='CSS files'),
                Tag(name='html', description='HTML files'),
                Tag(name='documentation', description='Documentation files'),
                Tag(name='configuration', description='Configuration files')
            ]
            
            for tag in sample_tags:
                db.session.add(tag)
            
            # Commit all changes
            db.session.commit()
            
            print("✅ Database reset completed successfully!")
            print()
            print("🔑 Admin Credentials:")
            print("   Username: admin")
            print("   Password: admin123")
            print("   Email: admin@codex.local")
            print()
            print("⚠️  IMPORTANT: Change the admin password after first login!")
            
        except Exception as e:
            print(f"❌ Database reset failed: {e}")
            db.session.rollback()

def reset_file_storage():
    """Reset file storage directory"""
    print("📁 Resetting file storage...")
    
    file_storage_path = os.path.join(project_root, 'file_storage')
    
    try:
        if os.path.exists(file_storage_path):
            shutil.rmtree(file_storage_path)
        
        os.makedirs(file_storage_path, exist_ok=True)
        
        # Create basic directory structure
        subdirs = ['uploads', 'temp', 'processed']
        for subdir in subdirs:
            os.makedirs(os.path.join(file_storage_path, subdir), exist_ok=True)
        
        print("✅ File storage reset completed!")
        
    except Exception as e:
        print(f"❌ File storage reset failed: {e}")

def reset_logs():
    """Reset log files"""
    print("📝 Resetting log files...")
    
    logs_path = os.path.join(project_root, 'logs')
    
    try:
        if os.path.exists(logs_path):
            for log_file in os.listdir(logs_path):
                if log_file.endswith('.log'):
                    log_path = os.path.join(logs_path, log_file)
                    with open(log_path, 'w') as f:
                        f.write(f"# Log file reset at {datetime.now().isoformat()}\n")
        else:
            os.makedirs(logs_path, exist_ok=True)
        
        print("✅ Log files reset completed!")
        
    except Exception as e:
        print(f"❌ Log reset failed: {e}")

def main():
    print("🔄 DC Codex Complete Reset Utility")
    print("=" * 50)
    print("This will completely reset:")
    print("- Database (all tables and data)")
    print("- File storage directory")
    print("- Log files")
    print()
    print("⚠️  WARNING: This action cannot be undone!")
    print()
    
    # Confirmation
    response = input("Type 'RESET' to confirm complete reset: ")
    if response != 'RESET':
        print("❌ Reset cancelled")
        return
    
    print()
    print("🚀 Starting complete reset...")
    print()
    
    # Perform reset operations
    reset_database()
    print()
    reset_file_storage()
    print()
    reset_logs()
    
    print()
    print("🎉 Complete reset finished!")
    print(f"⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("🔄 You can now start the application with fresh data.")

if __name__ == '__main__':
    main()
