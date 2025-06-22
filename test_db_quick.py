"""
Quick fix to run database test
"""
import os
import sys
os.chdir('F:\\Codex\\backend')
sys.path.insert(0, 'F:\\Codex\\backend')

# Now import from app.py directly
from app import create_app, db
from app.models import User, Project, File, Tag

# Create the Flask app
app = create_app()

with app.app_context():
    try:
        # Test user query
        admin_user = User.query.filter_by(username='admin').first()
        if admin_user:
            print(f"[OK] Admin user found: {admin_user.username}")
        else:
            print("[X] Admin user not found")
        
        # Test project count
        project_count = Project.query.count()
        print(f"[OK] Projects in database: {project_count}")
        
        # Test file count
        file_count = File.query.count()
        print(f"[OK] Files in database: {file_count}")
        
        # Test tag count
        tag_count = Tag.query.count()
        print(f"[OK] Tags in database: {tag_count}")
        
        # Create a test project if none exist
        if project_count == 0:
            test_project = Project(
                name="Sample Project",
                description="This is a sample project for testing"
            )
            db.session.add(test_project)
            db.session.commit()
            print("[OK] Created sample project")
        
        print("\nDatabase connection successful!")
        
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        import traceback
        traceback.print_exc()
