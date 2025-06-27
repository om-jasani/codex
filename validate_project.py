#!/usr/bin/env python3
"""
Codex Project Validation Script
Validates that all key components are properly implemented
"""

import os
import json

def check_file_exists(filepath, name):
    """Check if a file exists and report status"""
    if os.path.exists(filepath):
        print(f"✅ {name}: Found")
        return True
    else:
        print(f"❌ {name}: Missing")
        return False

def check_file_content(filepath, search_strings, name):
    """Check if a file contains required content"""
    if not os.path.exists(filepath):
        print(f"❌ {name}: File missing")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        missing = []
        for search_string in search_strings:
            if search_string not in content:
                missing.append(search_string)
        
        if not missing:
            print(f"✅ {name}: All required content found")
            return True
        else:
            print(f"❌ {name}: Missing content: {', '.join(missing)}")
            return False
    except Exception as e:
        print(f"❌ {name}: Error reading file - {e}")
        return False

def main():
    print("🔍 Codex Project Validation")
    print("=" * 50)
    
    base_path = "f:\\Codex"
    issues = []
    
    # Check backend structure
    print("\n📁 Backend Structure")
    print("-" * 30)
    backend_files = [
        ("backend/app.py", "Main Flask app"),
        ("backend/app/__init__.py", "App initialization"),
        ("backend/app/api/auth.py", "Authentication API"),
        ("backend/app/api/admin.py", "Admin API"),
        ("backend/app/api/files.py", "Files API"),
        ("backend/app/api/search.py", "Search API"),
        ("backend/app/models/__init__.py", "Database models"),
        ("backend/app/services/file_indexer.py", "File indexing service"),
        ("backend/app/utils/decorators.py", "Utility decorators"),
        ("backend/app/utils/search.py", "Search utilities"),
    ]
    
    for file_path, name in backend_files:
        full_path = os.path.join(base_path, file_path)
        if not check_file_exists(full_path, name):
            issues.append(f"Missing: {name}")
    
    # Check frontend structure
    print("\n🌐 Frontend Structure")
    print("-" * 30)
    frontend_files = [
        ("frontend/index.html", "Main search page"),
        ("frontend/admin.html", "Admin panel"),
        ("frontend/login.html", "Login page"),
        ("frontend/public/js/app.js", "Main JavaScript"),        ("frontend/public/js/admin.js", "Admin JavaScript"),
        ("frontend/public/css/style.css", "Main CSS"),
        ("frontend/public/css/admin.css", "Admin CSS"),
    ]
    
    for file_path, name in frontend_files:
        full_path = os.path.join(base_path, file_path)
        if not check_file_exists(full_path, name):
            issues.append(f"Missing: {name}")
    
    # Check key functionality in admin.html
    print("\n🛠 Admin Panel Features")
    print("-" * 30)
    admin_html_path = os.path.join(base_path, "frontend/admin.html")
    admin_features = [
        "drag-drop-area",  # File upload drag & drop
        "editProjectModal",  # Project editing
        "editTagModal",  # Tag editing
        "editUserModal",  # User editing
        "uploadModal",  # File upload modal
        "custom-index-form",  # Custom path indexing form
        "backup-section",  # Backup and restore section
        "createBackupModal",  # Backup creation modal
        "restoreBackupModal",  # Backup restore modal
    ]
    
    if not check_file_content(admin_html_path, admin_features, "Admin panel features"):
        issues.append("Admin panel missing key features")
    
    # Check key functionality in admin.js
    print("\n⚙️ Admin JavaScript Functions")
    print("-" * 30)
    admin_js_path = os.path.join(base_path, "frontend/public/js/admin.js")
    admin_functions = [
        "handleFiles",  # File upload handling
        "editProject",  # Project editing
        "editTag",  # Tag editing
        "editUser",  # User editing
        "startCustomIndexing",  # Custom path indexing
        "dragover",  # Drag & drop functionality
        "drop",  # Drop functionality
        "loadBackups",  # Backup management
        "createBackup",  # Backup creation
        "restoreBackup",  # Backup restoration
    ]
    
    if not check_file_content(admin_js_path, admin_functions, "Admin JavaScript functions"):
        issues.append("Admin JavaScript missing key functions")
    
    # Check database setup
    print("\n🗄️ Database Configuration")
    print("-" * 30)
    db_files = [
        ("database/schema.sql", "Database schema"),
        ("setup_database.py", "Database setup script"),
    ]
    
    for file_path, name in db_files:
        full_path = os.path.join(base_path, file_path)
        if not check_file_exists(full_path, name):
            issues.append(f"Missing: {name}")
    
    # Check utility scripts
    print("\n🛠 Utility Scripts")
    print("-" * 30)
    utility_files = [
        ("cleanup_database.py", "Database cleanup utility"),
        ("backup_restore.py", "Backup and restore utility"),
        ("maintenance.py", "General maintenance utility"),
        ("validate_project.py", "Project validation script"),
    ]
    
    for file_path, name in utility_files:
        full_path = os.path.join(base_path, file_path)
        if not check_file_exists(full_path, name):
            issues.append(f"Missing: {name}")
    
    # Check deployment files
    print("\n🚀 Deployment Files")
    print("-" * 30)
    deployment_files = [
        ("run.ps1", "Run script"),
        ("deploy.bat", "Deployment script"),
        ("requirements.txt", "Python dependencies"),
        ("README.md", "Documentation"),
    ]
    
    for file_path, name in deployment_files:
        full_path = os.path.join(base_path, file_path)
        if not check_file_exists(full_path, name):
            issues.append(f"Missing: {name}")
    
    # Summary
    print("\n📊 Validation Summary")
    print("-" * 30)
    if not issues:
        print("✅ All key components are present!")
        print("🎉 Project appears to be complete and ready for demo")
    else:
        print(f"❌ Found {len(issues)} issues:")
        for issue in issues:
            print(f"   • {issue}")
    
    print(f"\n📁 Project located at: {base_path}")
    print("🌐 Access at: http://localhost:5000 (when running)")

if __name__ == "__main__":
    main()
