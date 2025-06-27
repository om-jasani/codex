# Internal Code Search System - Complete Project Requirements

## 🎯 Project Overview
Build a comprehensive internal code search and discovery system for a company. The system enables employees to quickly find and reuse existing code from previous projects, significantly accelerating development and promoting code reuse across the organization.

## 🏢 Client Context
- **Company Type:** Medical Instruments manufacturer
- **Current Setup:** Existing server with all project files and code repositories
- **Challenge:** Developers waste time recreating code that already exists in other projects
- **Goal:** Instant search and discovery of code files and simple interface where user can see code and download files from server via friendly interface
- **Network:** Company local network(wifi) environment must be used
- **Users:** 20-50 engineers and developers

## 📋 Core Requirements
- This project is simple just like company will set tags and keywords to files and projects and employees will search for files using those tags and keywords and they can see the code in browser and download the file with one click.
- Interfaces needs to be 'attractive', 'modern' and 'easy to use' for both employees and administrators.

### 🔍 Employee Search Interface (Primary Users)
**Must be EXTREMELY simple and intuitive:**
- Single search box
- Type any keyword (e.g., "motor", "ESP32", "sensor", "bluetooth", etc..many other things) and instantly find ALL related files
- Real-time search suggestions as users type
- Clear, visual results showing:
  - File names with syntax highlighting
  - Brief descriptions of what each file does if admin has given description
  - Relevant tags/keywords
- One-click access to:
  - Download individual files
- Filter options: by project, hardware type, file extension
- Result list with file preview simple ide theme

### 🛠️ Admin Management Interface (IT/Project Managers)
**Must be incredibly easy for non-technical staff:**
- **File Management:**
  - Simple form to add new files to the system
  - Edit existing file information
  - Delete or archive outdated files
- **Tagging System:**
  - Easy keyword/tag assignment for each file and project and editable in future
  - Tag management (create, edit, delete, merge tags)
- **Project Organization:**
  - Create and manage project categories
  - Assign files to multiple projects and categories
- **System Configuration:**
  - Backup and data import/export tools that is most efficient and reliable so that admin can easily backup and export files and projects in case of any issues and can restore(import) them easily

## 🖥️ Technical Architecture Requirements

### Backend System
- **Framework:** Python with Flask/FastAPI
- **Database:** SQLite
- **Search Engine:** Tag-based and keyword search system where administrators(company) will give specific tags and keywords for files and projects for their comfort
- **File Handling:** -
  - Connect to existing company server file system
  - Index files automatically
  - Support multiple file types (.c, .cpp, .h, .ino, .py, .js, etc. 'all')
- **API Design:**
  - RESTful Endpoints for search, file access, and admin tasks
  - Real-time Search with pagination and filters (project, language)
  - File Viewing & Downloading: View code in-browser or download files directly
  - Admin Endpoints for indexing, monitoring, and management
  - Error Handling & Logging for reliability and traceability

### Database Schema
```sql
Tables needed:
- files (id, filename, filepath, filetype, project, description, size, modified_date)
- file_tags (file_id, tag_name)
- projects (id, name, description, created_date)
- search_logs (search_term, results_count, timestamp, user_ip)
- file_downloads (file_id, download_count, last_downloaded)
```

### Frontend Requirements
- **Employee Interface:**
  - Modern, clean UI with excellent UX
  - Fast, responsive search with live results
  - filtering and sorting
  - employees should easily see the files and code in browser in IDE like basic normal theme, and easily one click download of the file
- **Admin Interface:**
  - Login page security customizable user id password
  - Form-based file management
  - Efficient adding new code files and projects and adding tags, keywords at the same time and everything well thought
  - Easily and efficient files tag, keywords, add/edit/manage
  - Visual tag management
  - Configuration panels

### Server Integration
- **Local Network Deployment:**
  - Deploy on company's existing server infrastructure which is windows server and accessible by local network
  - Configure for local network access via company local network and accessible by browser local network address
  - SSL/HTTPS setup for security
  - Integration with company's file server
- **File System Integration:**
  - Automatic file discovery and indexing
  - Real-time file system monitoring
  - Backup and Export well thought planned and completely functional

## 🎨 User Experience Priorities

### For Employees (Search Users)
1. **Speed:** Search results in seconds
2. **Simplicity:** Simple search like experience
3. **Relevance:** Accurate search results
4. **Accessibility:** Works very well on notebooks browsers
5. **Visual Appeal:** Modern, professional and efficient and well thought interface

### For Administrators
1. **Ease of Use:** No technical knowledge required
2. **Control:** Full control over content and organization
3. **Reliability:** Robust system with error handling and make sure to have no errors at all

## 📱 Advanced Features to Include

### Smart Search Features
- **Auto-complete:** Suggest search terms as user types/tags/keywords that are given by admin to files can be shown as suggestions
- **Fuzzy Matching:** Find results even with typos

## 🚀 Deployment Requirements

### Local Network Setup
- **Server Requirements:**
  - Windows server compatible
  - Network accessible to all company devices via browser local network address
- **Installation Process:**
  - One-click deployment
  - Automatic database setup
  - Automatic continious Files and Project and keywords, tags all things check and updation whenever admin gives new files/tags/keywords added
  - Env setup very well thought to set code files and projects directory

### Security & Access
- **Network Security:**
  - Internal network only (no external access)
  - Role-based access (admin vs. regular employee users)

### Performance Requirements
- **Scalability:**
  - Support 1000+ files
  - Handle 40+ concurrent users

## 📝 Deliverables Expected

### Code Components
1. **Complete Backend API** with all endpoints
2. **Employee Search Interface**
3. **Admin Management Panel**
4. **Database Schema** and setup scripts
5. **Configuration Files** for easy deployment

---

**Note:** This system should feel like "Google for internal code" - simple to use but powerful in functionality. The admin interface should be so easy that any project manager can add files without IT help. Focus on user experience above all technical complexity.