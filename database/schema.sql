-- Codex Database Schema
-- PostgreSQL Database Schema for Internal Code Search System

-- Create database if not exists
-- CREATE DATABASE codex_db;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL UNIQUE,
    filetype VARCHAR(50),
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    size BIGINT,
    line_count INTEGER,
    modified_date TIMESTAMP,
    indexed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content_hash VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File tags junction table
CREATE TABLE IF NOT EXISTS file_tags (
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Search logs table
CREATE TABLE IF NOT EXISTS search_logs (
    id SERIAL PRIMARY KEY,
    search_term TEXT NOT NULL,
    results_count INTEGER,
    user_id INTEGER REFERENCES users(id),
    user_ip VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File downloads table
CREATE TABLE IF NOT EXISTS file_downloads (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    download_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_ip VARCHAR(45)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_filetype ON files(filetype);
CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_date);
CREATE INDEX IF NOT EXISTS idx_search_logs_term ON search_logs(search_term);
CREATE INDEX IF NOT EXISTS idx_search_logs_timestamp ON search_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);

-- Create full-text search index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_files_filename_trgm ON files USING gin(filename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_description_trgm ON files USING gin(description gin_trgm_ops);

-- Create views for common queries
CREATE OR REPLACE VIEW file_details AS
SELECT 
    f.id,
    f.filename,
    f.filepath,
    f.filetype,
    f.description,
    f.size,
    f.line_count,
    f.modified_date,
    p.name as project_name,
    STRING_AGG(t.name, ', ' ORDER BY t.name) as tags
FROM files f
LEFT JOIN projects p ON f.project_id = p.id
LEFT JOIN file_tags ft ON f.id = ft.file_id
LEFT JOIN tags t ON ft.tag_id = t.id
WHERE f.is_active = TRUE
GROUP BY f.id, f.filename, f.filepath, f.filetype, f.description, 
         f.size, f.line_count, f.modified_date, p.name;

-- Insert default admin user (password: changeme123)
INSERT INTO users (username, password_hash, email, full_name, role)
VALUES ('admin', '$2b$12$YourHashedPasswordHere', 'admin@company.local', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;
