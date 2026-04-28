import os

def install_skill():
    target_dir = r"C:\Users\Ashton_Yang\.gemini\skills\python-exe-packaging-pro-v2"
    file_path = os.path.join(target_dir, "SKILL.md")
    
    content = """# Python EXE Packaging Pro V2

Expert skill for packaging Python projects into executable (EXE) files. Supports SPA route fixing, smart launchers, security scanning (pip-audit), and automated pipelines (compile, test, verify, compress).

## Core Workflow
Follow this atomic pipeline when requested to package a project:
1. **Environment Check**: Confirm Python source code exists in the root directory.
2. **Security Scan**: Run `pip-audit` for supply chain security checks.
3. **Resource Detection**: Automatically identify and include `dist/` (frontend), `pages/` (Streamlit), `assets/`, and `.env.example`.
4. **Build**: Use `PyInstaller` with optimized spec configurations.
5. **Verification**: Generate a global SHA-256 checksum for the build artifacts.
6. **Archive**: Package the executable and checksum into a ZIP file.

## Technical Features
- **SPA Routing Patch**: Integrate middleware for FastAPI/Flask apps with frontend frameworks (React/Vue/Angular) to fix 404 refresh issues.
- **Smart Launcher**: Configure launchers with auto-port detection (scanning 100 ports) and crash logging to prevent silent failures.
- **Resource Path Handling**: Ensure all static resource paths correctly resolve via `_MEIPASS` or relative paths post-packaging.

## Execution Steps
1. Guide the user to place Python code in the root directory.
2. Assist in creating or modifying the `.spec` file based on templates.
3. Execute the automated pipeline script to start the packaging process.
4. Verify the output `.zip` and `.sha256` files.

## Troubleshooting
- If 'instant crash' occurs, check the launcher's crash logs first.
- If frontend routes fail, verify if the SPA Routing Patch is applied.
"""
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        
    with open(file_path, "w", encoding="utf-8", newline='\n') as f:
        f.write(content.strip() + '\n')
    
    print(f"Skill installed successfully to: {target_dir}")

if __name__ == "__main__":
    install_skill()
