# DC Codex Quick Start Guide

## 🚀 First Time Setup (5 minutes)

1. **Install Prerequisites**
   - Python 3.8+: https://www.python.org/downloads/
   - PostgreSQL: https://www.postgresql.org/download/windows/

2. **Configure Database**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_PASSWORD` in `.env`

3. **Run Setup**
   ```
   deploy.bat
   ```
   - Enter admin username and password when prompted

4. **Start DC Codex**
   ```
   run.ps1
   ```

5. **Access DC Codex**
   - Open browser: http://localhost:5000
   - Login with admin credentials

## 📁 Adding Files

### Option 1: Manual (Single Files)
1. Login as admin
2. Go to Admin Panel → Manage Files
3. Click "Add New File"
4. Fill in details and tags
5. Save

### Option 2: Automatic (Bulk Import)
1. Login as admin
2. Go to Admin Panel → File Indexing
3. Click "Start Indexing"
4. Wait for completion

## 🔍 Searching for Code

1. Type keywords in search box:
   - Function names: `calculateSpeed`
   - Hardware: `ESP32`, `sensor`
   - File types: `.ino`, `.cpp`

2. Use filters:
   - Project dropdown
   - File type dropdown

3. Click on results to:
   - View code with syntax highlighting
   - Download files

## 🏷️ Managing Tags

1. Go to Admin Panel → Tags
2. Click "Create Tag"
3. Enter tag name (e.g., "bluetooth", "motor")
4. Use tags when adding files

## 👥 User Access

- **Regular Users**: Can search and download files
- **Admins**: Can add files, create projects, manage tags

## 🆘 Troubleshooting

**Can't connect to database**
- Check PostgreSQL is running
- Verify password in `.env`

**Can't access http://codex.local**
- Use http://localhost:5000 instead
- Or configure hosts file (see README)

**Search returns no results**
- Check if files are indexed
- Run indexing from admin panel

## 📞 Need Help?

1. Check logs: `F:\Codex\logs\codex.log`
2. Run test: `python test_system.py`
3. See full documentation: `README.md`

---
**Tip**: Bookmark http://codex.local for quick access!
