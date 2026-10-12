"""Build a gh-pages commit with a separate index, without changing the checkout or user data."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args, env=None):
    result = subprocess.run(['git', *args], cwd=ROOT, env=env, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit(result.stderr.strip())
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description='Publicar la versión estática de Aula en la rama gh-pages')
    parser.add_argument('--push', action='store_true', help='Subir la rama gh-pages al remoto origin')
    args = parser.parse_args()
    dist = ROOT / 'dist-pages'
    if not (dist / 'index.html').is_file():
        raise SystemExit('Primero ejecuta npm run build:pages.')
    for path in dist.rglob('*'):
        if path.is_symlink() or any(part in {'.data', '.env', '.git', 'node_modules'} for part in path.relative_to(dist).parts):
            raise SystemExit('El directorio de publicación contiene un archivo inesperado.')
    git_dir = Path(git('rev-parse', '--absolute-git-dir'))
    previous = subprocess.run(['git', 'rev-parse', '--verify', 'refs/heads/gh-pages'], cwd=ROOT, capture_output=True, text=True)
    with tempfile.TemporaryDirectory(prefix='aula-pages-index-') as temp:
        variables = {**os.environ, 'GIT_INDEX_FILE': str(Path(temp) / 'index'), 'GIT_WORK_TREE': str(dist), 'GIT_DIR': str(git_dir)}
        git('add', '--all', env=variables)
        tree = git('write-tree', env=variables)
        if previous.returncode == 0 and git('rev-parse', 'refs/heads/gh-pages^{tree}') == tree:
            commit = previous.stdout.strip()
        else:
            command = ['commit-tree', tree, '-m', 'Deploy Aula to GitHub Pages']
            if previous.returncode == 0:
                command.extend(['-p', previous.stdout.strip()])
            commit = git(*command)
            git('update-ref', 'refs/heads/gh-pages', commit)
    print('Rama gh-pages preparada:', commit)
    if args.push:
        git('push', 'origin', 'gh-pages:gh-pages')
        print('Rama gh-pages subida.')


if __name__ == '__main__':
    main()
