import os
import zipfile
from pathlib import Path

# Root directory of workforce-app
PROJECT_ROOT = Path(__file__).parent.resolve()
PARENT_DIR = PROJECT_ROOT.parent
OUTPUT_ZIP = PARENT_DIR / "workforce-app.zip"

# Directories to exclude from the zip archive
EXCLUDE_DIRS = {
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

# Files to exclude
EXCLUDE_EXTENSIONS = {".zip", ".pyc", ".pyo"}
EXCLUDE_FILES = {".env", ".env.local", ".env.production", ".env.development", "secrets.json"}

def create_zip():
    print("==================================================")
    print("       Workforce App Zip Export Tool")
    print("==================================================")
    print(f"Source Folder: {PROJECT_ROOT}")
    print(f"Target Zip:    {OUTPUT_ZIP}")
    print(f"Excluding:     {', '.join(sorted(EXCLUDE_DIRS))}\n")

    file_count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.name in EXCLUDE_FILES or file_path.suffix in EXCLUDE_EXTENSIONS or file == "workforce-app.zip":
                    continue
                
                # Maintain relative path inside zip
                arcname = file_path.relative_to(PARENT_DIR)
                zipf.write(file_path, arcname)
                file_count += 1

    zip_size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    print(f"SUCCESS! Compressed {file_count} files into zip archive.")
    print(f"File Location: {OUTPUT_ZIP} ({zip_size_mb:.2f} MB)")
    print("==================================================")

if __name__ == "__main__":
    create_zip()
