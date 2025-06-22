# Create project directory structure
$basePath = "F:\Codex"
$directories = @(
    "$basePath\backend\app\api",
    "$basePath\backend\app\models", 
    "$basePath\backend\app\services",
    "$basePath\backend\app\utils",
    "$basePath\frontend\public\css",
    "$basePath\frontend\public\js",
    "$basePath\frontend\src\admin",
    "$basePath\frontend\src\employee",
    "$basePath\database\migrations",
    "$basePath\config",
    "$basePath\deployment",
    "$basePath\logs",
    "$basePath\file_storage"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir
}

Write-Host "Project structure created successfully!"
