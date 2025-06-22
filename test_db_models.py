#!/usr/bin/env python3
"""
Test Database Connection and Models
"""

import os
import sys

# Add backend directory to Python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_dir)

# Now we can import properly
from app import db  # from app/__init__.py
from app.models import User, Project, File, Tag  # from app/models/__init__.py

# Import create_app from the app.py file
sys.path.insert(0, os.path.dirname(backend_dir))
from backend.app import create_app

# Create the Flask app
app = create_app()

with app.app_context():
    try:
        # Test user query
        admin_user = User.query.filter_by(username='admin').first()
        if admin_user:
            print(f"✓ Admin user found: {admin_user.username}")
        else:
            print("✗ Admin user not found")
        
        # Test project count
        project_count = Project.query.count()
        print(f"✓ Projects in database: {project_count}")
        
        # Test file count
        file_count = File.query.count()
        print(f"✓ Files in database: {file_count}")
        
        # Test tag count
        tag_count = Tag.query.count()
        print(f"✓ Tags in database: {tag_count}")
        
        # Create a test project if none exist
        if project_count == 0:
            test_project = Project(
                name="Sample Project",
                description="This is a sample project for testing"
            )
            db.session.add(test_project)
            db.session.commit()
            print("✓ Created sample project")
        
        print("\nDatabase connection successful!")
        
    except Exception as e:
        print(f"✗ Database error: {e}")
        import traceback
        traceback.print_exc()
