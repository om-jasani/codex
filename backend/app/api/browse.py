"""
Browse API Endpoints - Folder Structure Browsing
"""

from flask import Blueprint, request, jsonify, current_app, send_file
import os
import json
from datetime import datetime
import mimetypes
import base64

browse_bp = Blueprint('browse', __name__)

def get_file_icon(filename):
    """Get appropriate icon for file type"""
    ext = os.path.splitext(filename)[1].lower()
    icon_map = {
        '.c': 'fab fa-copyright',
        '.cpp': 'fab fa-cuttlefish',
        '.h': 'fas fa-file-code',
        '.py': 'fab fa-python',
        '.js': 'fab fa-js-square',
        '.html': 'fab fa-html5',
        '.css': 'fab fa-css3-alt',
        '.java': 'fab fa-java',
        '.cs': 'fas fa-code',
        '.php': 'fab fa-php',
        '.go': 'fas fa-code',
        '.rs': 'fas fa-code',
        '.swift': 'fab fa-swift',
        '.kt': 'fas fa-code',
        '.rb': 'fas fa-gem',
        '.sh': 'fas fa-terminal',
        '.bat': 'fas fa-terminal',
        '.ps1': 'fas fa-terminal',
        '.sql': 'fas fa-database',
        '.json': 'fas fa-file-code',
        '.xml': 'fas fa-file-code',
        '.yaml': 'fas fa-file-code',
        '.yml': 'fas fa-file-code',
        '.md': 'fab fa-markdown',
        '.txt': 'fas fa-file-alt',
        '.ino': 'fas fa-microchip',
        '.doc': 'fas fa-file-word',
        '.docx': 'fas fa-file-word',
        '.pdf': 'fas fa-file-pdf',
        '.img': 'fas fa-file-image',
        '.png': 'fas fa-file-image',
        '.jpg': 'fas fa-file-image',
        '.jpeg': 'fas fa-file-image',
        '.gif': 'fas fa-file-image',
        '.svg': 'fas fa-file-image',
        '.bmp': 'fas fa-file-image',
        '.webp': 'fas fa-file-image',
        '.ico': 'fas fa-file-image',
        '.cmd': 'fas fa-terminal',
        '.asm': 'fas fa-file-code',
    }
    return icon_map.get(ext, 'fas fa-file')

def get_mime_type(filepath):
    """Get MIME type for file"""
    mime_type, _ = mimetypes.guess_type(filepath)
    return mime_type or 'application/octet-stream'

def is_text_file(filepath):
    """Check if file is a text file"""
    ext = os.path.splitext(filepath)[1].lower()
    text_extensions = {
        '.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties',
        '.c', '.cpp', '.cxx', '.cc', '.h', '.hpp', '.hxx', '.java', '.cs', '.php', '.rb', '.go', '.rs',
        '.swift', '.kt', '.scala', '.r', '.m', '.pl', '.lua', '.dart', '.vue', '.svelte',
        '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.sql', '.asm', '.nasm', '.ino',
        '.log', '.csv', '.tsv', '.gitignore', '.dockerfile', '.makefile', '.license',
        '.readme', '.changelog', '.todo', '.vim', '.vimrc', '.bashrc', '.zshrc',
        '.env', '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc', '.gitattributes',
        '.tex', '.latex', '.cls', '.sty', '.bib', '.org', '.rst', '.adoc', '.wiki',
        '.gradle', '.ant', '.maven', '.cmake', '.vcxproj', '.csproj', '.fsproj', '.vbproj',
        '.plist', '.manifest', '.config', '.settings', '.prefs', '.options'
    }
    return ext in text_extensions

def is_image_file(filepath):
    """Check if file is an image"""
    ext = os.path.splitext(filepath)[1].lower()
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp', '.ico', '.tiff', '.tif'}
    return ext in image_extensions

def is_pdf_file(filepath):
    """Check if file is a PDF"""
    return os.path.splitext(filepath)[1].lower() == '.pdf'

def is_video_file(filepath):
    """Check if file is a video"""
    ext = os.path.splitext(filepath)[1].lower()
    video_extensions = {'.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp'}
    return ext in video_extensions

def is_audio_file(filepath):
    """Check if file is an audio file"""
    ext = os.path.splitext(filepath)[1].lower()
    audio_extensions = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus'}
    return ext in audio_extensions

def is_archive_file(filepath):
    """Check if file is an archive"""
    ext = os.path.splitext(filepath)[1].lower()
    archive_extensions = {'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tar.gz', '.tar.bz2', '.tar.xz'}
    return ext in archive_extensions

def get_file_info(filepath):
    """Get file information"""
    try:
        stat = os.stat(filepath)
        return {
            'size': stat.st_size,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
        }
    except:
        return {
            'size': 0,
            'modified': None,
            'created': None
        }

def scan_directory(path, max_depth=10, current_depth=0):
    """Recursively scan directory structure"""
    if current_depth >= max_depth:
        return []
    
    try:
        items = []
        
        # Get all items in directory
        for item in sorted(os.listdir(path)):
            if item.startswith('.'):
                continue
                
            item_path = os.path.join(path, item)
            
            if os.path.isdir(item_path):
                # It's a directory
                children = scan_directory(item_path, max_depth, current_depth + 1)
                items.append({
                    'name': item,
                    'type': 'folder',
                    'path': item_path.replace('\\', '/'),
                    'children': children,
                    'icon': 'fas fa-folder',
                    'expandable': len(children) > 0
                })
            else:
                # It's a file
                file_info = get_file_info(item_path)
                items.append({
                    'name': item,
                    'type': 'file',
                    'path': item_path.replace('\\', '/'),
                    'icon': get_file_icon(item),
                    'size': file_info['size'],
                    'modified': file_info['modified'],
                    'extension': os.path.splitext(item)[1].lower()
                })
        
        return items
    except Exception as e:
        print(f"Error scanning directory {path}: {str(e)}")
        return []

@browse_bp.route('/structure', methods=['GET'])
def get_folder_structure():
    """Get the complete folder structure"""
    # Get the code repository path from environment
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not repo_path or not os.path.exists(repo_path):
        return jsonify({'error': 'Repository path not configured or not found'}), 404
    
    try:
        structure = scan_directory(repo_path, max_depth=3)
        
        return jsonify({
            'success': True,
            'root_path': repo_path,
            'structure': structure,
            'total_items': len(structure) if structure else 0
        })
    except Exception as e:
        return jsonify({'error': f'Failed to scan directory: {str(e)}'}), 500

@browse_bp.route('/folder', methods=['GET'])
def get_folder_contents():
    """Get contents of a specific folder"""
    folder_path = request.args.get('path', '').strip()
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not folder_path:
        return jsonify({'error': 'Folder path is required'}), 400
    
    # If folder_path is not absolute, join it with repo_path
    if not os.path.isabs(folder_path):
        folder_path = os.path.join(repo_path, folder_path)
    
    # Normalize paths for comparison
    folder_path = os.path.normpath(folder_path)
    repo_path = os.path.normpath(repo_path)
    
    # Security check - ensure path is within repository
    if not folder_path.startswith(repo_path):
        return jsonify({'error': 'Access denied'}), 403
    
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return jsonify({'error': 'Folder not found'}), 404
    
    try:
        contents = scan_directory(folder_path, max_depth=2)
        
        return jsonify({
            'success': True,
            'path': folder_path,
            'contents': contents,
            'total_items': len(contents) if contents else 0
        })
    except Exception as e:
        return jsonify({'error': f'Failed to scan folder: {str(e)}'}), 500

@browse_bp.route('/file', methods=['GET'])
def get_file_content():
    """Get content of a specific file"""
    file_path = request.args.get('path', '').strip()
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not file_path:
        return jsonify({'error': 'File path is required'}), 400
    
    # If file_path is not absolute, join it with repo_path
    if not os.path.isabs(file_path):
        file_path = os.path.join(repo_path, file_path)
    
    # Normalize paths for comparison
    file_path = os.path.normpath(file_path)
    repo_path = os.path.normpath(repo_path)
    
    # Security check - ensure path is within repository
    if not file_path.startswith(repo_path):
        return jsonify({'error': 'Access denied'}), 403
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Get file info
        file_info = get_file_info(file_path)
        mime_type = get_mime_type(file_path)
        
        # Check file size (limit to 10MB for preview)
        if file_info['size'] > 10 * 1024 * 1024:
            return jsonify({
                'error': 'File too large for preview',
                'size': file_info['size'],
                'mime_type': mime_type,
                'download_url': f'/api/browse/file-download?path={file_path}'
            }), 413
        
        # Handle different file types
        response_data = {
            'success': True,
            'path': file_path,
            'name': os.path.basename(file_path),
            'size': file_info['size'],
            'modified': file_info['modified'],
            'extension': os.path.splitext(file_path)[1].lower(),
            'mime_type': mime_type
        }
        
        if is_image_file(file_path):
            # For images, encode as base64
            try:
                with open(file_path, 'rb') as f:
                    image_data = f.read()
                    base64_data = base64.b64encode(image_data).decode('utf-8')
                    response_data.update({
                        'type': 'image',
                        'content': f"data:{mime_type};base64,{base64_data}"
                    })
            except Exception as e:
                return jsonify({'error': f'Failed to read image: {str(e)}'}), 500
                
        elif is_pdf_file(file_path):
            # For PDFs, provide download URL for embedded viewing
            response_data.update({
                'type': 'pdf',
                'download_url': f'/api/browse/file-download?path={file_path}'
            })
            
        elif is_video_file(file_path):
            # For videos, provide download URL for embedded viewing
            response_data.update({
                'type': 'video',
                'download_url': f'/api/browse/file-download?path={file_path}',
                'mime_type': mime_type
            })
            
        elif is_audio_file(file_path):
            # For audio files, provide download URL for embedded playing
            response_data.update({
                'type': 'audio',
                'download_url': f'/api/browse/file-download?path={file_path}',
                'mime_type': mime_type
            })
            
        elif is_archive_file(file_path):
            # For archive files, provide download only
            response_data.update({
                'type': 'archive',
                'download_url': f'/api/browse/file-download?path={file_path}'
            })
            
        elif is_text_file(file_path):
            # For text files, read content with better encoding handling
            try:
                # Try UTF-8 first
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Ensure we got the full content
                if len(content) == 0 and file_info['size'] > 0:
                    # File might not be empty, try with different encoding
                    raise UnicodeDecodeError("utf-8", b"", 0, 1, "No content read")
                
                response_data.update({
                    'type': 'text',
                    'content': content,
                    'lines': len(content.split('\n')) if content else 0,
                    'encoding': 'utf-8'
                })
                
            except UnicodeDecodeError:
                # Try with different encodings
                content = None
                for encoding in ['latin-1', 'cp1252', 'iso-8859-1', 'utf-16']:
                    try:
                        with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                            content = f.read()
                        if content:  # Only accept if we got content
                            response_data.update({
                                'type': 'text',
                                'content': content,
                                'lines': len(content.split('\n')) if content else 0,
                                'encoding': encoding
                            })
                            break
                    except (UnicodeDecodeError, Exception):
                        continue
                
                if content is None:
                    return jsonify({'error': 'Unable to decode file - unsupported encoding'}), 415
                    
            except Exception as e:
                return jsonify({'error': f'Unable to read file: {str(e)}'}), 500
        else:
            # For other files, provide download option and basic info
            response_data.update({
                'type': 'binary',
                'download_url': f'/api/browse/file-download?path={file_path}'
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': f'Failed to read file: {str(e)}'}), 500

@browse_bp.route('/file-download', methods=['GET'])
def browse_download_file():
    """Download a file"""
    file_path = request.args.get('path', '').strip()
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not file_path:
        return jsonify({'error': 'File path is required'}), 400
    
    # If file_path is not absolute, join it with repo_path
    if not os.path.isabs(file_path):
        file_path = os.path.join(repo_path, file_path)
    
    # Normalize paths for comparison
    file_path = os.path.normpath(file_path)
    repo_path = os.path.normpath(repo_path)
    
    # Security check - ensure path is within repository
    if not file_path.startswith(repo_path):
        return jsonify({'error': 'Access denied'}), 403
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    except Exception as e:
        return jsonify({'error': f'Failed to download file: {str(e)}'}), 500

@browse_bp.route('/file/download', methods=['GET'])
def download_file():
    """Download a specific file"""
    file_path = request.args.get('path', '').strip()
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not file_path:
        return jsonify({'error': 'File path is required'}), 400
    
    # If file_path is not absolute, join it with repo_path
    if not os.path.isabs(file_path):
        file_path = os.path.join(repo_path, file_path)
    
    # Normalize paths for comparison
    file_path = os.path.normpath(file_path)
    repo_path = os.path.normpath(repo_path)
    
    # Security check - ensure path is within repository
    if not file_path.startswith(repo_path):
        return jsonify({'error': 'Access denied'}), 403
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Send the file for download
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    except Exception as e:
        return jsonify({'error': f'Failed to download file: {str(e)}'}), 500

@browse_bp.route('/search', methods=['GET'])
def search_in_structure():
    """Search for files/folders in the structure"""
    query = request.args.get('q', '').strip().lower()
    repo_path = os.getenv('CODE_REPOSITORY_PATH', '')
    
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    if not repo_path or not os.path.exists(repo_path):
        return jsonify({'error': 'Repository path not configured'}), 404
    
    try:
        results = []
        
        # Walk through all files and folders
        for root, dirs, files in os.walk(repo_path):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            # Search in folder names
            for dirname in dirs:
                if query in dirname.lower():
                    dir_path = os.path.join(root, dirname)
                    results.append({
                        'name': dirname,
                        'type': 'folder',
                        'path': dir_path.replace('\\', '/'),
                        'parent': root.replace('\\', '/'),
                        'icon': 'fas fa-folder',
                        'match_type': 'folder_name'
                    })
            
            # Search in file names
            for filename in files:
                if filename.startswith('.'):
                    continue
                    
                if query in filename.lower():
                    file_path = os.path.join(root, filename)
                    file_info = get_file_info(file_path)
                    results.append({
                        'name': filename,
                        'type': 'file',
                        'path': file_path.replace('\\', '/'),
                        'parent': root.replace('\\', '/'),
                        'icon': get_file_icon(filename),
                        'size': file_info['size'],
                        'modified': file_info['modified'],
                        'extension': os.path.splitext(filename)[1].lower(),
                        'match_type': 'file_name'
                    })
        
        # Sort results by relevance (exact matches first, then partial)
        results.sort(key=lambda x: (
            0 if query == x['name'].lower() else 1,
            x['name'].lower()
        ))
        
        return jsonify({
            'success': True,
            'query': query,
            'results': results[:100],  # Limit to 100 results
            'total_found': len(results)
        })
        
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500
