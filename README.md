# Codex - Internal Code Search System

A powerful, Google-like search system for your company's internal code repositories. Codex helps developers quickly find and reuse existing code from previous projects, significantly accelerating development.

## 🚀 Features

### For Developers
- **Instant Search**: Lightning-fast search across all company code
- **Smart Suggestions**: Auto-complete search suggestions as you type
- **Syntax Highlighting**: View code with proper syntax highlighting
- **Advanced Filters**: Filter by project, file type, or tags
- **Download Files**: One-click download of any file
- **Real-time Results**: See results instantly as you search

### For Administrators
- **Easy File Management**: Add, edit, and organize files through a simple interface
- **Project Organization**: Group files into projects
- **Tag System**: Create and manage tags for better categorization
- **Automatic Indexing**: Scan and index entire directories with one click
- **User Management**: Control access with role-based permissions
- **Search Analytics**: Track what developers are searching for

## 📋 Requirements

- **Python 3.8+**
- **PostgreSQL 12+**
- **Windows Server** (for deployment)
- **4GB RAM minimum**
- **10GB disk space** (depending on code repository size)

## 🛠 Installation

### 1. Prerequisites

Install the following software:
- [Python 3.8+](https://www.python.org/downloads/)
- [PostgreSQL](https://www.postgresql.org/download/windows/)
- [Git](https://git-scm.com/download/win) (optional)

### 2. Quick Setup

1. **Extract/Clone the project** to `F:\Codex`

2. **Configure environment**:
   - Copy `.env.example` to `.env`
   - Edit `.env` with your database credentials and settings

3. **Run deployment script**:
   ```batch
   cd F:\Codex
   deploy.bat
   ```

   This will:
   - Create a Python virtual environment
   - Install all dependencies
   - Set up the PostgreSQL database
   - Create an admin user

4. **Start the application**:
   ```powershell
   .\run.ps1
   ```

## ⚙️ Configuration

### Environment Variables (.env)

Key settings to configure:

```env
# Database
DATABASE_HOST=localhost
DATABASE_NAME=codex_db
DATABASE_USER=codex_user
DATABASE_PASSWORD=your_secure_password

# File Storage
CODE_REPOSITORY_PATH=\\company-server\projects
FILE_STORAGE_PATH=F:\Codex\file_storage

# Network
LOCAL_DOMAIN=codex.local
APP_PORT=5000

# Security
ENABLE_AUTHENTICATION=True
SECRET_KEY=generate_a_random_key_here
```

### Network Configuration

To make Codex accessible as `http://codex.local`:

1. **On the server**, add to `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1    codex.local
   ```

2. **On client machines**, add:
   ```
   SERVER_IP    codex.local
   ```

3. **Configure Windows Firewall** to allow port 5000:
   ```powershell
   New-NetFirewallRule -DisplayName "Codex" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
   ```

## 📖 Usage

### For Developers

1. **Access Codex** at `http://codex.local` or `http://localhost:5000`
2. **Login** with your credentials
3. **Search** for code using keywords like:
   - Function names: `calculateSpeed`
   - Hardware: `ESP32`, `Arduino`
   - Features: `bluetooth`, `sensor`
   - File types: `.ino`, `.cpp`

### For Administrators

1. **Access Admin Panel** via the user menu
2. **Add Files**:
   - Click "Add New File"
   - Enter file details and tags
   - Save
3. **Index Repository**:
   - Go to "File Indexing"
   - Click "Start Indexing"
   - Wait for completion

## 🗂 Project Structure

```
F:\Codex\
├── backend/              # Flask backend application
│   ├── app.py           # Main application entry
│   └── app/             # Application modules
│       ├── api/         # API endpoints
│       ├── models/      # Database models
│       ├── services/    # Business logic
│       └── utils/       # Utility functions
├── frontend/            # Web interface
│   ├── index.html       # Main search page
│   ├── admin.html       # Admin panel
│   └── public/          # Static assets
├── database/            # Database scripts
├── config/              # Configuration files
├── deployment/          # Deployment scripts
└── logs/               # Application logs
```

## 🔌 API Endpoints

### Search API
- `GET /api/search?q=keyword` - Search for files
- `GET /api/search/suggestions?q=key` - Get search suggestions

### File API
- `GET /api/files/{id}` - Get file details
- `GET /api/files/{id}/content` - View file content
- `GET /api/files/{id}/download` - Download file

### Admin API (requires admin role)
- `POST /api/admin/files` - Add new file
- `PUT /api/admin/files/{id}` - Update file
- `DELETE /api/admin/files/{id}` - Delete file
- `POST /api/admin/projects` - Create project
- `POST /api/admin/tags` - Create tag
- `POST /api/admin/index` - Start indexing

## 🔧 Troubleshooting

### Common Issues

**PostgreSQL Connection Error**
- Ensure PostgreSQL service is running
- Check database credentials in `.env`
- Verify PostgreSQL is accepting connections

**"Module not found" Error**
- Activate virtual environment: `venv\Scripts\activate`
- Reinstall dependencies: `pip install -r requirements.txt`

**Cannot access http://codex.local**
- Check hosts file configuration
- Verify firewall settings
- Try accessing via `http://localhost:5000`

**Indexing fails**
- Verify `CODE_REPOSITORY_PATH` in `.env`
- Check file permissions
- Review logs in `logs/codex.log`

## 🔐 Security

- Always use HTTPS in production
- Change default admin password immediately
- Regularly update dependencies
- Enable authentication for all users
- Restrict file access to company network only

## 📊 Performance Optimization

- **Database**: Create indexes on frequently searched fields
- **Caching**: Enable Redis for better performance
- **File Indexing**: Schedule during off-hours
- **Search**: Limit results per page

## 🚨 Maintenance

### Daily
- Monitor disk space
- Check application logs for errors

### Weekly
- Run file indexing to catch new files
- Review search logs for insights
- Backup database

### Monthly
- Update dependencies
- Clean old logs
- Review and optimize slow queries

## 📝 License

This is proprietary software for internal company use only.

## 🤝 Support

For issues or questions:
- Check logs at `F:\Codex\logs\`
- Contact IT department
- Review this documentation

---

**Version**: 1.0.0  
**Last Updated**: June 2025  
**Developed for**: Medical Instruments Company
