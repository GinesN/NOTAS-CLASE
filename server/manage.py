"""Local administration and a reliable way for Codex to save study material."""
import argparse
import json
import os
from pathlib import Path
import sys

from app import ROOT, Store, Problem


def main():
    parser = argparse.ArgumentParser(description="Gestionar tus datos de Aula sin exponerlos en Git")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Mostrar el índice de carpetas y documentos, sin sus contenidos")
    save = commands.add_parser("save", help="Guardar un apunte a partir de un JSON por stdin")
    save.add_argument("--actor", default="Codex", choices=["Codex", "Tú"])
    export = commands.add_parser("export", help="Crear una copia de seguridad sin credenciales")
    export.add_argument("--out", required=True)
    restore = commands.add_parser("import", help="Reemplazar los datos por una copia compatible")
    restore.add_argument("--file", required=True)
    restore.add_argument("--replace", action="store_true", help="Confirmar que se reemplazarán los datos actuales")
    schedule = commands.add_parser('import-schedule', help='Incorporar un horario sin reemplazar apuntes')
    schedule.add_argument('--file', required=True)
    args = parser.parse_args()
    store = Store(os.environ.get("AULA_DATA_DIR", ROOT / ".data"))
    if args.command == "list":
        nodes = store.nodes()
        lookup = {n["id"]: n for n in nodes}
        result = []
        for n in nodes:
            path = [n["title"]]
            parent = n["parent_id"]
            while parent:
                node = lookup[parent]
                path.insert(0, node["title"])
                parent = node["parent_id"]
            result.append({"id": n["id"], "kind": n["kind"], "path": path})
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif args.command == "save":
        raw = sys.stdin.read(2_000_001)
        if len(raw) > 2_000_000:
            raise Problem("El documento supera 2 MB.")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise Problem("Se esperaba un objeto JSON.")
        note = store.chatgpt_document(data, args.actor)
        print(json.dumps({"id": note["id"], "title": note["title"], "path": data["path"], "saved": True}, ensure_ascii=False))
    elif args.command == "export":
        with open(args.out, "x", encoding="utf-8") as file:
            os.chmod(args.out, 0o600)
            json.dump(store.backup(), file, ensure_ascii=False, indent=2)
        print("Copia guardada.")
    elif args.command == "import":
        if not args.replace:
            raise Problem("Añade --replace para confirmar que se reemplazarán los datos actuales.")
        file = Path(args.file)
        if file.stat().st_size > 16_000_000:
            raise Problem("La copia supera 16 MB.")
        store.restore(json.loads(file.read_text(encoding="utf-8")))
        print("Copia restaurada. La contraseña y la clave de conexión actuales se conservan.")
    elif args.command == 'import-schedule':
        file = Path(args.file)
        if file.stat().st_size > 100000:
            raise Problem('El archivo de horario supera 100 KB.')
        value = store.import_schedule(json.loads(file.read_text(encoding='utf-8')))
        print(f'Horario guardado: {len(value)} asignaturas.')


if __name__ == "__main__":
    try:
        main()
    except (Problem, ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
