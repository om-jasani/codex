#!/usr/bin/env python3
"""
Simple Database Reset Script
Completely resets the database and creates a fresh admin user
"""

import os
import sys
import shutil
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from app.models import db, User, Project, File, Tag
from werkzeug.security import generate_password_hash

def reset_database():
    """Reset the entire database"""
    print("🔄 Resetting Codex Database...")
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
                role='admin'
            )
            db.session.add(admin_user)
              # Create a default project
            print("📁 Creating default project...")
            default_project = Project(
                name='Default',
                description='Default project for file uploads'
            )
            db.session.add(default_project)
            
            # Commit changes
            db.session.commit()
            
            print("✅ Database reset successfully!")
            print("👤 Admin user created:")
            print("   - Username: admin")
            print("   - Password: admin123")
            print("   - Email: admin@codex.local")
            
        except Exception as e:
            print(f"❌ Error resetting database: {str(e)}")
            db.session.rollback()
            return False
    
    return True

def clean_file_storage():
    """Clean the file storage directory"""
    file_storage_path = os.path.join(os.path.dirname(__file__), 'file_storage')
    
    if os.path.exists(file_storage_path):
        print("🗑️  Cleaning file storage...")
        try:
            # Remove all files and subdirectories
            for filename in os.listdir(file_storage_path):
                file_path = os.path.join(file_storage_path, filename)
                if os.path.isfile(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            
            print("✅ File storage cleaned successfully!")
        except Exception as e:
            print(f"❌ Error cleaning file storage: {str(e)}")
    else:
        print("📂 File storage directory doesn't exist, creating...")
        os.makedirs(file_storage_path, exist_ok=True)

def main():
    print("🔄 Codex Complete Reset")
    print("=" * 50)
    print("This will:")
    print("- Delete ALL data from the database")
    print("- Remove ALL uploaded files")
    print("- Create a fresh admin user")
    print("- Create a default project")
    print()
    
    # Always confirm for safety
    if '--confirm' not in sys.argv:
        confirm = input("Are you sure you want to proceed? (yes/no): ").lower()
        if confirm != 'yes':
            print("❌ Reset cancelled.")
            return
    
    # Reset database
    if reset_database():
        # Clean file storage
        clean_file_storage()
        
        print("\n🎉 Complete reset finished!")
        print("The system is now in a pristine state and ready to use.")
        print(f"⏰ Reset completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print("❌ Reset failed. Please check the error messages above.")

if __name__ == '__main__':
    main()
