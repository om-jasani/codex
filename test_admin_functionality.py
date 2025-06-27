#!/usr/bin/env python3
"""
Codex Admin Functionality Test Script
Tests all admin features to ensure they work properly
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = f"http://{os.getenv('APP_HOST', 'localhost')}:{os.getenv('APP_PORT', 5000)}"
API_BASE = f"{BASE_URL}/api"

class CodexTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_user = None
    
    def login_admin(self):
        """Login as admin user"""
        login_data = {
            'username': 'admin',
            'password': 'changeme123'  # Default admin password
        }
        
        response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
        if response.status_code == 200:
            self.admin_user = response.json()['user']
            print("✓ Admin login successful")
            return True
        else:
            print(f"✗ Admin login failed: {response.text}")
            return False
    
    def test_project_management(self):
        """Test project CRUD operations"""
        print("\n=== Testing Project Management ===")
        
        # Create project
        project_data = {
            'name': 'Test Project',
            'description': 'A test project for validation'
        }
        
        response = self.session.post(f"{API_BASE}/admin/projects", json=project_data)
        if response.status_code == 201:
            print("✓ Project creation successful")
            project_id = response.json().get('project_id')
        else:
            print(f"✗ Project creation failed: {response.text}")
            return False
        
        # Get projects
        response = self.session.get(f"{API_BASE}/admin/projects")
        if response.status_code == 200:
            projects = response.json()
            print(f"✓ Retrieved {len(projects)} projects")
        else:
            print(f"✗ Project retrieval failed: {response.text}")
            return False
        
        # Update project
        update_data = {
            'name': 'Updated Test Project',
            'description': 'Updated description'
        }
        
        response = self.session.put(f"{API_BASE}/admin/projects/{project_id}", json=update_data)
        if response.status_code == 200:
            print("✓ Project update successful")
        else:
            print(f"✗ Project update failed: {response.text}")
        
        # Delete project (we'll keep it for file tests)
        # response = self.session.delete(f"{API_BASE}/admin/projects/{project_id}")
        # if response.status_code == 200:
        #     print("✓ Project deletion successful")
        # else:
        #     print(f"✗ Project deletion failed: {response.text}")
        
        return project_id
    
    def test_tag_management(self):
        """Test tag CRUD operations"""
        print("\n=== Testing Tag Management ===")
        
        # Create tag
        tag_data = {
            'name': 'test-tag',
            'description': 'A test tag for validation'
        }
        
        response = self.session.post(f"{API_BASE}/admin/tags", json=tag_data)
        if response.status_code == 201:
            print("✓ Tag creation successful")
            tag_id = response.json().get('tag_id')
        else:
            print(f"✗ Tag creation failed: {response.text}")
            return False
        
        # Get tags
        response = self.session.get(f"{API_BASE}/admin/tags")
        if response.status_code == 200:
            tags = response.json()
            print(f"✓ Retrieved {len(tags)} tags")
        else:
            print(f"✗ Tag retrieval failed: {response.text}")
            return False
        
        # Update tag
        update_data = {
            'name': 'updated-test-tag',
            'description': 'Updated description'
        }
        
        response = self.session.put(f"{API_BASE}/admin/tags/{tag_id}", json=update_data)
        if response.status_code == 200:
            print("✓ Tag update successful")
        else:
            print(f"✗ Tag update failed: {response.text}")
        
        return tag_id
    
    def test_file_management(self, project_id):
        """Test file management operations"""
        print("\n=== Testing File Management ===")
        
        # Add file
        file_data = {
            'filename': 'test_file.py',
            'filepath': 'C:\\temp\\test_file.py',
            'project_id': project_id,
            'description': 'A test Python file',
            'tags': ['python', 'test'],
            'size': 1024,
            'line_count': 50
        }
        
        response = self.session.post(f"{API_BASE}/admin/files", json=file_data)
        if response.status_code == 201:
            print("✓ File creation successful")
            file_id = response.json().get('file_id')
        else:
            print(f"✗ File creation failed: {response.text}")
            return False
        
        # Get files
        response = self.session.get(f"{API_BASE}/admin/files")
        if response.status_code == 200:
            files_data = response.json()
            print(f"✓ Retrieved {len(files_data['results'])} files")
        else:
            print(f"✗ File retrieval failed: {response.text}")
            return False
        
        # Update file
        update_data = {
            'description': 'Updated test file description',
            'tags': ['python', 'test', 'updated']
        }
        
        response = self.session.put(f"{API_BASE}/admin/files/{file_id}", json=update_data)
        if response.status_code == 200:
            print("✓ File update successful")
        else:
            print(f"✗ File update failed: {response.text}")
        
        return file_id
    
    def test_indexing(self):
        """Test indexing functionality"""
        print("\n=== Testing Indexing ===")
        
        # Test main indexing
        response = self.session.post(f"{API_BASE}/admin/index")
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Main indexing successful: {result.get('files_indexed', 0)} files indexed")
        else:
            print(f"✗ Main indexing failed: {response.text}")
        
        # Test custom path indexing
        custom_data = {
            'path': 'C:\\temp',  # Test path - should be safe
            'project_id': None
        }
        
        response = self.session.post(f"{API_BASE}/admin/index/custom", json=custom_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Custom indexing completed: {result.get('files_indexed', 0)} files indexed")
        else:
            print(f"✗ Custom indexing failed: {response.text}")
    
    def test_user_management(self):
        """Test user management operations"""
        print("\n=== Testing User Management ===")
        
        # Create user
        user_data = {
            'username': 'testuser',
            'password': 'testpass123',
            'full_name': 'Test User',
            'email': 'test@example.com',
            'role': 'user'
        }
        
        response = self.session.post(f"{API_BASE}/admin/users", json=user_data)
        if response.status_code == 201:
            print("✓ User creation successful")
            user_id = response.json().get('user_id')
        else:
            print(f"✗ User creation failed: {response.text}")
            return False
        
        # Get users
        response = self.session.get(f"{API_BASE}/admin/users")
        if response.status_code == 200:
            users = response.json()
            print(f"✓ Retrieved {len(users)} users")
        else:
            print(f"✗ User retrieval failed: {response.text}")
            return False
        
        # Update user
        update_data = {
            'full_name': 'Updated Test User',
            'email': 'updated@example.com'
        }
        
        response = self.session.put(f"{API_BASE}/admin/users/{user_id}", json=update_data)
        if response.status_code == 200:
            print("✓ User update successful")
        else:
            print(f"✗ User update failed: {response.text}")
        
        return user_id
    
    def test_search_functionality(self):
        """Test search functionality"""
        print("\n=== Testing Search Functionality ===")
        
        # Basic search
        response = self.session.get(f"{API_BASE}/search/?q=test")
        if response.status_code == 200:
            results = response.json()
            print(f"✓ Basic search successful: {results.get('total', 0)} results")
        else:
            print(f"✗ Basic search failed: {response.text}")
        
        # Search with filters
        response = self.session.get(f"{API_BASE}/search/?q=python&filetype=.py")
        if response.status_code == 200:
            results = response.json()
            print(f"✓ Filtered search successful: {results.get('total', 0)} results")
        else:
            print(f"✗ Filtered search failed: {response.text}")
        
        # Search suggestions
        response = self.session.get(f"{API_BASE}/search/suggestions?q=te")
        if response.status_code == 200:
            suggestions = response.json()
            print(f"✓ Search suggestions successful: {len(suggestions.get('suggestions', []))} suggestions")
        else:
            print(f"✗ Search suggestions failed: {response.text}")
    
    def test_statistics(self):
        """Test dashboard statistics"""
        print("\n=== Testing Statistics ===")
        
        # File stats
        response = self.session.get(f"{API_BASE}/admin/stats/files")
        if response.status_code == 200:
            stats = response.json()
            print(f"✓ File statistics: {stats.get('total', 0)} total files")
        else:
            print(f"✗ File statistics failed: {response.text}")
        
        # Search stats
        response = self.session.get(f"{API_BASE}/admin/stats/searches")
        if response.status_code == 200:
            stats = response.json()
            print(f"✓ Search statistics: {stats.get('searches_today', 0)} searches today")
        else:
            print(f"✗ Search statistics failed: {response.text}")
        
        # Recent activity
        response = self.session.get(f"{API_BASE}/admin/activity/recent")
        if response.status_code == 200:
            activities = response.json()
            print(f"✓ Recent activity: {len(activities)} activities")
        else:
            print(f"✗ Recent activity failed: {response.text}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Codex Admin Functionality Tests")
        print("=" * 50)
        
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        try:
            project_id = self.test_project_management()
            tag_id = self.test_tag_management()
            
            if project_id:
                file_id = self.test_file_management(project_id)
            
            self.test_indexing()
            user_id = self.test_user_management()
            self.test_search_functionality()
            self.test_statistics()
            
            print("\n" + "=" * 50)
            print("✅ All tests completed! Check individual results above.")
            print("🎉 Codex admin functionality testing finished.")
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {str(e)}")
            return False
        
        return True

if __name__ == "__main__":
    tester = CodexTester()
    tester.run_all_tests()
