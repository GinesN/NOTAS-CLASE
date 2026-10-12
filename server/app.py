"""Aula's single-user server. Python standard library; SQLite stays outside source files."""
import argparse
import datetime as dt
import getpass
import hashlib
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import secrets
import sqlite3
import threading
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
import uuid
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parents[1]
COLORS = {"sage", "peach", "lavender", "blue", "yellow"}
KINDS = {"course", "folder", "note", "exam"}
PASSWORD_ITERATIONS = 600_000


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


class Problem(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PASSWORD_ITERATIONS).hex()


def validate_password(password):
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        raise Problem("Usa una contraseña de entre 12 y 256 caracteres.")


def valid_date(value):
    if not isinstance(value, str):
        raise Problem("La fecha no es válida.")
    if value:
        try:
            dt.date.fromisoformat(value)
        except ValueError:
            raise Problem("La fecha no es válida.")
    return value


def clean_node(data, existing=None):
    if not isinstance(data, dict):
        raise Problem("El documento no es válido.")
    n = dict(existing or {})
    n.update({k: v for k, v in data.items() if k in {"title", "content", "kind", "parent_id", "color", "due_date", "done", "pinned"}})
    n.setdefault("content", "")
    n.setdefault("color", "sage")
    n.setdefault("due_date", "")
    n.setdefault("done", False)
    n.setdefault("pinned", False)
    n.setdefault("parent_id", None)
    if not isinstance(n.get("title"), str) or not 1 <= len(n["title"].strip()) <= 160:
        raise Problem("El título debe tener entre 1 y 160 caracteres.")
    n["title"] = n["title"].strip()
    if n.get("kind") not in KINDS or n["color"] not in COLORS:
        raise Problem("El tipo o el color no es válido.")
    if not isinstance(n["content"], str) or len(n["content"]) > 1_000_000:
        raise Problem("El contenido supera el tamaño permitido.")
    if n["parent_id"] is not None and not isinstance(n["parent_id"], str):
        raise Problem("El apartado no es válido.")
    if n["kind"] == "course" and n["parent_id"] is not None:
        raise Problem("Las asignaturas van en el primer nivel.")
    for key in ("done", "pinned"):
        if not isinstance(n[key], (bool, int)) or n[key] not in (0, 1):
            raise Problem("El estado no es válido.")
        n[key] = bool(n[key])
    n["due_date"] = valid_date(n["due_date"])
    return n


class Store:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.directory / "aula.sqlite3"
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY, parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
                    color TEXT NOT NULL DEFAULT 'sage', due_date TEXT NOT NULL DEFAULT '',
                    done INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS activity (
                    id TEXT PRIMARY KEY, action TEXT NOT NULL, title TEXT NOT NULL,
                    node_id TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, node_id TEXT NOT NULL);
            """)
        os.chmod(self.path, 0o600)
        self.failures = {}
        self.failures_lock = threading.Lock()
        self.setup_lock = threading.Lock()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def setting(self, key, db=None):
        if db is None:
            with self.connect() as connection:
                return self.setting(key, connection)
        row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def set_password(self, password, name="Mi espacio"):
        validate_password(password)
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise Problem("Escribe un nombre de hasta 80 caracteres.")
        salt = secrets.token_hex(16)
        with self.connect() as db:
            for key, value in {"password_salt": salt, "password_hash": password_hash(password, salt), "name": name.strip()}.items():
                db.execute("INSERT OR REPLACE INTO settings VALUES (?, ?)", (key, value))
            db.execute("DELETE FROM sessions")

    def authenticate(self, password, client):
        with self.failures_lock:
            failures, until = self.failures.get(client, (0, 0))
            if until > time.time():
                raise Problem("Demasiados intentos. Espera un minuto y vuelve a probar.", 429)
        salt = self.setting("password_salt")
        if not isinstance(password, str) or len(password) > 256 or not salt or not secrets.compare_digest(password_hash(password, salt), self.setting("password_hash")):
            with self.failures_lock:
                failures += 1
                self.failures[client] = (failures, time.time() + 60 if failures >= 5 else 0)
            raise Problem("La contraseña no es correcta.", 401)
        with self.failures_lock:
            self.failures.pop(client, None)
        return self.session()

    def session(self):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
            db.execute("INSERT INTO sessions VALUES (?, ?)", (hashlib.sha256(token.encode()).hexdigest(), time.time() + 7 * 86400))
        return token

    def authorized(self, token, api=False):
        if not token:
            return False
        digest = hashlib.sha256(token.encode()).hexdigest()
        if api:
            expected = self.setting("api_key_hash")
            return bool(expected and secrets.compare_digest(expected, digest))
        with self.connect() as db:
            return bool(db.execute("SELECT 1 FROM sessions WHERE hash = ? AND expires > ?", (digest, time.time())).fetchone())

    def log(self, db, action, title, node_id=None, actor="Tú"):
        db.execute("INSERT INTO activity VALUES (?, ?, ?, ?, ?, ?)", (str(uuid.uuid4()), action, title, node_id, actor, now()))

    def nodes(self, db=None):
        if db is None:
            with self.connect() as connection:
                return self.nodes(connection)
        return [dict(r) for r in db.execute("SELECT * FROM nodes ORDER BY created_at, id")]

    def parent_valid(self, db, n, node_id=None):
        seen = {node_id} if node_id else set()
        parent = n["parent_id"]
        depth = 0
        while parent:
            if parent in seen or depth >= 100:
                raise Problem("No puedes mover un apartado dentro de sí mismo ni superar 100 niveles.")
            seen.add(parent)
            row = db.execute("SELECT kind, parent_id FROM nodes WHERE id = ?", (parent,)).fetchone()
            if not row or row["kind"] not in {"course", "folder"}:
                raise Problem("El apartado de destino no existe o no es una carpeta.")
            parent = row["parent_id"]
            depth += 1

    def create(self, data, actor="Tú", db=None):
        if db is None:
            with self.connect() as connection:
                return self.create(data, actor, connection)
        n = clean_node(data)
        self.parent_valid(db, n)
        n.update(id=str(uuid.uuid4()), created_at=now(), updated_at=now())
        columns = ["id", "parent_id", "kind", "title", "content", "color", "due_date", "done", "pinned", "created_at", "updated_at"]
        db.execute(f"INSERT INTO nodes ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", [n[k] for k in columns])
        self.log(db, "created", n["title"], n["id"], actor)
        return n

    def update(self, node_id, data):
        with self.connect() as db:
            row = db.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
            if not row:
                raise Problem("Este documento ya no existe.", 404)
            old = dict(row)
            if "kind" in data and data["kind"] != old["kind"]:
                raise Problem("El tipo del documento no puede cambiarse.")
            if data.get("expected_updated_at") and data["expected_updated_at"] != old["updated_at"]:
                raise Problem("Este documento cambió desde que lo abriste. Copia tus cambios y vuelve a abrirlo.", 409)
            n = clean_node(data, old)
            self.parent_valid(db, n, node_id)
            fields = ["parent_id", "title", "content", "color", "due_date", "done", "pinned", "updated_at"]
            n["updated_at"] = now()
            db.execute(f"UPDATE nodes SET {','.join(k+' = ?' for k in fields)} WHERE id = ?", [n[k] for k in fields] + [node_id])
            action = "completed" if n["done"] and not old["done"] else "updated"
            self.log(db, action, n["title"], node_id)
            return n

    def delete(self, node_id):
        with self.connect() as db:
            row = db.execute("SELECT title FROM nodes WHERE id = ?", (node_id,)).fetchone()
            if not row:
                raise Problem("Este apartado ya no existe.", 404)
            db.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
            self.log(db, "deleted", row["title"])

    def activity(self):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT * FROM activity ORDER BY created_at DESC LIMIT 200")]

    def state(self):
        return {"nodes": self.nodes(), "activity": self.activity(), "name": self.setting("name"), "api_enabled": bool(self.setting("api_key_hash"))}

    def seed(self):
        with self.connect() as db:
            for item in json.loads((ROOT / "server" / "courses.json").read_text()):
                color = item["color"]
                course = self.create({"kind": "course", "title": item["title"], "content": item["official"], "color": color}, db=db)
                topics = self.create({"kind": "folder", "title": "Temas", "parent_id": course["id"], "color": color}, db=db)
                topic = self.create({"kind": "folder", "title": "Tema 1", "parent_id": topics["id"], "color": color}, db=db)
                self.create({"kind": "folder", "title": "Apuntes", "parent_id": topic["id"], "color": color}, db=db)
                for title in ("Exámenes", "Recursos"):
                    self.create({"kind": "folder", "title": title, "parent_id": course["id"], "color": color}, db=db)
            self.create({"kind": "note", "title": "Bienvenido a tu espacio", "pinned": True, "content": "# Todo tiene su lugar\n\nAula es tu espacio privado para organizar el curso a tu manera.\n\n## Empieza por tus asignaturas\n\nCrea una asignatura y añade carpetas para cada tema. Dentro puedes guardar apuntes, resúmenes o exámenes. Puedes crear tantos niveles como necesites.\n\n## Tus apuntes viajan contigo\n\nEn Ajustes puedes descargar una copia de tus datos e importarla en otro ordenador. Si alojas Aula en un servidor con HTTPS, podrás entrar desde cualquier dispositivo.\n\n## Trabaja con ChatGPT\n\nEn la sección ChatGPT puedes copiar el contexto de tus apuntes y preparar una conexión mediante un GPT personalizado. La conexión automática necesita que tu servidor esté accesible por HTTPS."}, db=db)
            db.execute("DELETE FROM activity")
            self.log(db, "created", "Tus nueve asignaturas y tu espacio de estudio")

    def backup(self):
        with self.connect() as db:
            return {"app": "Aula", "version": 1, "exported_at": now(), "name": self.setting("name", db), "nodes": self.nodes(db), "activity": [dict(r) for r in db.execute("SELECT * FROM activity ORDER BY created_at")]}

    def restore(self, data):
        if not isinstance(data, dict) or data.get("app") != "Aula" or data.get("version") != 1 or not isinstance(data.get("nodes"), list) or len(data["nodes"]) > 10000:
            raise Problem("No es una copia de Aula compatible (versión 1).")
        nodes = {}
        for raw in data["nodes"]:
            n = clean_node(raw)
            node_id = raw.get("id")
            if not isinstance(node_id, str) or not 1 <= len(node_id) <= 100 or node_id in nodes:
                raise Problem("La copia contiene identificadores inválidos o repetidos.")
            n["id"] = node_id
            for field in ("created_at", "updated_at"):
                value = raw.get(field)
                try:
                    if not isinstance(value, str) or len(value) > 40:
                        raise ValueError()
                    dt.datetime.fromisoformat(value)
                except ValueError:
                    raise Problem("La copia contiene fechas inválidas.")
                n[field] = value
            nodes[node_id] = n
        ordered = []
        ordered_ids = set()
        for n in nodes.values():
            chain = []
            cursor = n
            seen = set()
            while cursor and cursor["id"] not in ordered_ids:
                if cursor["id"] in seen or len(chain) > 100:
                    raise Problem("La copia contiene una estructura circular o demasiado profunda.")
                seen.add(cursor["id"])
                chain.append(cursor)
                parent = cursor["parent_id"]
                if parent and (parent not in nodes or nodes[parent]["kind"] not in {"course", "folder"}):
                    raise Problem("La copia contiene carpetas de destino inválidas.")
                cursor = nodes.get(parent)
            ordered.extend(reversed(chain))
            ordered_ids.update(seen)
        history = data.get("activity", [])
        if not isinstance(history, list) or len(history) > 100000:
            raise Problem("El historial de la copia no es válido.")
        validated_history = []
        ids = set()
        for a in history:
            if not isinstance(a, dict) or a.get("action") not in {"created", "updated", "deleted", "completed", "restored", "key_created", "key_revoked"}:
                raise Problem("El historial contiene una acción inválida.")
            for key, limit in (("id", 100), ("title", 160), ("actor", 80), ("created_at", 40)):
                if not isinstance(a.get(key), str) or not 1 <= len(a[key]) <= limit:
                    raise Problem("El historial contiene datos inválidos.")
            try:
                dt.datetime.fromisoformat(a["created_at"])
            except ValueError:
                raise Problem("El historial contiene una fecha inválida.")
            if a["id"] in ids or (a.get("node_id") is not None and not isinstance(a["node_id"], str)):
                raise Problem("El historial contiene identificadores inválidos.")
            ids.add(a["id"])
            validated_history.append(a)
        with self.connect() as db:
            db.execute("DELETE FROM nodes")
            db.execute("DELETE FROM activity")
            db.execute("DELETE FROM requests")
            columns = ["id", "parent_id", "kind", "title", "content", "color", "due_date", "done", "pinned", "created_at", "updated_at"]
            for n in ordered:
                db.execute(f"INSERT INTO nodes VALUES ({','.join('?' for _ in columns)})", [n[k] for k in columns])
            for a in validated_history:
                db.execute("INSERT INTO activity VALUES (?, ?, ?, ?, ?, ?)", [a.get(k) for k in ("id", "action", "title", "node_id", "actor", "created_at")])
            self.log(db, "restored", "Copia de seguridad importada")

    def chatgpt_document(self, data, actor="ChatGPT"):
        path = data.get("path")
        if not isinstance(path, list) or not 1 <= len(path) <= 30 or any(not isinstance(p, str) or not 1 <= len(p.strip()) <= 160 for p in path):
            raise Problem("Indica una ruta como [\"Matemáticas\", \"Tema 1\", \"Apuntes\"].")
        if data.get("kind", "note") not in {"note", "exam"}:
            raise Problem("ChatGPT puede crear apuntes o exámenes.")
        request_id = data.get("request_id")
        if request_id is not None and (not isinstance(request_id, str) or not 1 <= len(request_id) <= 100):
            raise Problem("El identificador de petición no es válido.")
        payload_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if request_id:
                previous = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
                if previous:
                    if previous["payload_hash"] != payload_hash:
                        raise Problem("Esta petición ya se usó con otro contenido.", 409)
                    row = db.execute("SELECT * FROM nodes WHERE id = ?", (previous["node_id"],)).fetchone()
                    if not row:
                        raise Problem("El documento de esta petición se eliminó. Usa una petición nueva.", 409)
                    return dict(row)
            parent = None
            color = "sage"
            for i, part in enumerate(path):
                matches = [r for r in db.execute("SELECT * FROM nodes WHERE parent_id IS ?", (parent,)) if r["title"].casefold() == part.strip().casefold()]
                if len(matches) > 1:
                    raise Problem("Hay varios apartados con el mismo nombre; renómbralos para elegir el destino.", 409)
                match = matches[0] if matches else None
                if match and match["kind"] not in {"course", "folder"}:
                    raise Problem("Una parte de la ruta es un documento, no una carpeta.", 409)
                if match:
                    parent, color = match["id"], match["color"]
                else:
                    n = self.create({"title": part, "kind": "course" if i == 0 else "folder", "parent_id": parent, "color": color}, actor, db)
                    parent = n["id"]
            n = self.create({"kind": data.get("kind", "note"), "title": data.get("title"), "content": data.get("content", ""), "due_date": data.get("due_date", ""), "parent_id": parent, "color": color}, actor, db)
            if request_id:
                db.execute("INSERT INTO requests VALUES (?, ?, ?)", (request_id, payload_hash, n["id"]))
            return n


def openapi(base):
    return {
        "openapi": "3.1.0", "info": {"title": "Aula privada", "version": "1.0.0", "description": "Organiza apuntes y exámenes en el espacio privado del usuario."},
        "servers": [{"url": base}], "security": [{"bearerAuth": []}],
        "components": {"securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer"}}},
        "paths": {
            "/api/chatgpt/tree": {"get": {"operationId": "readStudySpace", "summary": "Leer asignaturas, carpetas y documentos para encontrar el destino adecuado", "responses": {"200": {"description": "Árbol de documentos y registro reciente", "content": {"application/json": {"schema": {"type": "object", "properties": {"nodes": {"type": "array", "items": {"type": "object", "additionalProperties": True}}, "activity": {"type": "array", "items": {"type": "object", "additionalProperties": True}}}}}}}}}},
            "/api/chatgpt/documents": {"post": {"operationId": "saveStudyDocument", "summary": "Crear un apunte o examen en una ruta concreta; crear los apartados que falten", "x-openai-isConsequential": True, "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["path", "title", "content"], "properties": {"path": {"type": "array", "items": {"type": "string"}, "description": "Ruta de carpetas, empezando por la asignatura. Ejemplo: Matemáticas, Tema 1, Apuntes."}, "title": {"type": "string"}, "content": {"type": "string", "description": "Contenido en Markdown"}, "kind": {"type": "string", "enum": ["note", "exam"], "default": "note"}, "due_date": {"type": "string", "description": "Fecha opcional YYYY-MM-DD"}, "request_id": {"type": "string", "description": "Identificador único que se reutiliza si se reintenta la misma petición para evitar duplicados"}}}}}}, "responses": {"201": {"description": "Documento guardado", "content": {"application/json": {"schema": {"type": "object", "properties": {"id": {"type": "string"}, "title": {"type": "string"}, "parent_id": {"type": "string"}}}}}}}}}
        }
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "Aula"

    def log_message(self, format, *args):
        # Do not log headers, credentials, query strings, or note contents.
        print(f"{self.command} {urlsplit(self.path).path} {args[1] if len(args) > 1 else ''}", flush=True)

    @property
    def store(self):
        return self.server.store

    def common_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

    def json_response(self, data, status=200, cookie=None, attachment=None):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.common_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        if attachment:
            self.send_header("Content-Disposition", f'attachment; filename="{attachment}"')
        self.end_headers()
        self.wfile.write(body)

    def session_token(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        return cookies["aula_session"].value if "aula_session" in cookies else None

    def cookie(self, token, expire=False):
        secure = "; Secure" if self.server.public_url.startswith("https://") else ""
        return f"aula_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={0 if expire else 604800}{secure}"

    def require_auth(self, api=False):
        if self.server.local_mode and not api:
            return
        token = self.headers.get("Authorization", "").removeprefix("Bearer ") if api else self.session_token()
        if not self.store.authorized(token, api):
            raise Problem("Inicia sesión para abrir tu espacio." if not api else "La clave de conexión no es válida.", 401)

    def body(self):
        if "application/json" not in self.headers.get("Content-Type", ""):
            raise Problem("Envía los datos como JSON.", 415)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > 16_000_000 or size < 1:
                raise Problem("El archivo está vacío o supera los 16 MB.", 413)
            data = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError):
            raise Problem("No se pudo leer el JSON.")
        if not isinstance(data, dict):
            raise Problem("Se esperaba un objeto JSON.")
        return data

    def check_request(self, mutation=False):
        host = self.headers.get("Host", "")
        allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        if self.server.public_url:
            allowed.add(urlsplit(self.server.public_url).netloc)
        if host not in allowed:
            raise Problem("Este dominio no está configurado en AULA_PUBLIC_URL.", 403)
        if mutation:
            origin = self.headers.get("Origin")
            if origin and origin != (self.server.public_url or f"http://{host}"):
                raise Problem("La petición debe venir de tu propia web.", 403)
            # Browsers cannot submit cross-site JSON without a preflight. No CORS is enabled.
            if self.headers.get("Sec-Fetch-Site") == "cross-site":
                raise Problem("La petición debe venir de tu propia web.", 403)

    def do_GET(self):
        try:
            self.check_request()
            path = urlsplit(self.path).path
            if path == "/api/auth/status":
                return self.json_response({"setup_required": not self.server.local_mode and not bool(self.store.setting("password_hash")), "authenticated": self.server.local_mode or self.store.authorized(self.session_token()), "name": self.store.setting("name") or "Mi espacio", "local_mode": self.server.local_mode})
            if path == "/api/health":
                with self.store.connect() as db:
                    db.execute("SELECT 1").fetchone()
                return self.json_response({"status": "ok", "app": "Aula"})
            if path == "/api/openapi.json":
                return self.json_response(openapi(self.server.public_url or f"http://{self.headers['Host']}"))
            if path == "/api/chatgpt/tree":
                self.require_auth(api=True)
                return self.json_response({"nodes": self.store.nodes(), "activity": self.store.activity()})
            if path.startswith("/api/"):
                self.require_auth()
                if path == "/api/state":
                    return self.json_response(self.store.state())
                if path == "/api/backup":
                    return self.json_response(self.store.backup(), attachment=f"aula-{dt.date.today().isoformat()}.json")
                raise Problem("Esta operación no existe.", 404)
            if path == "/privacy":
                body = "<!doctype html><html lang='es'><meta charset='utf-8'><title>Privacidad · Aula</title><body><main><h1>Privacidad de Aula</h1><p>Aula es una aplicación de uso personal. Los apuntes, el historial y la contraseña cifrada se guardan en la base de datos del servidor que tú administras. La contraseña se almacena mediante una función de derivación con sal; no se conserva en texto.</p><p>No hay publicidad, analítica ni envío automático a servicios de inteligencia artificial. Al conectar un GPT personalizado, las acciones autorizadas pueden leer tus documentos y guardar contenido en Aula. Esos datos también quedan sujetos a la política de privacidad del proveedor de ChatGPT.</p><p>Puedes exportar o eliminar tus documentos en cualquier momento. Protege las copias de seguridad: contienen tus apuntes en texto. Elimina la base de datos para borrar todo el espacio y sus credenciales.</p></main></body></html>".encode()
            else:
                dist = ROOT / "dist"
                file = (dist / unquote(path).lstrip("/")).resolve()
                if not file.is_relative_to(dist.resolve()) or ".data" in file.parts:
                    raise Problem("No encontrado.", 404)
                if not file.is_file():
                    if Path(path).suffix:
                        raise Problem("No encontrado.", 404)
                    file = dist / "index.html"
                if not file.exists():
                    raise Problem("Primero ejecuta npm run build.", 503)
                body = file.read_bytes()
            self.send_response(200)
            self.common_headers()
            mime = "text/html" if path == "/privacy" else mimetypes.guess_type(str(file))[0] or "application/octet-stream"
            self.send_header("Content-Type", mime + ("; charset=utf-8" if mime.startswith("text/") else ""))
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Problem as e:
            self.json_response({"error": str(e)}, e.status)

    def do_POST(self):
        self.mutate("POST")

    def do_PATCH(self):
        self.mutate("PATCH")

    def do_DELETE(self):
        self.mutate("DELETE")

    def mutate(self, method):
        try:
            self.check_request(mutation=True)
            path = urlsplit(self.path).path
            if method == "POST" and path == "/api/auth/setup":
                # The initial account may only be created locally, before public deployment.
                if self.server.public_url or not ipaddress.ip_address(self.client_address[0]).is_loopback:
                    raise Problem("Crea la contraseña desde el servidor con --set-password.", 403)
                data = self.body()
                with self.store.setup_lock:
                    if self.store.setting("password_hash"):
                        raise Problem("El espacio ya tiene contraseña.", 409)
                    self.store.set_password(data.get("password"), data.get("name", "Mi espacio"))
                    if data.get("template") is True:
                        self.store.seed()
                return self.json_response({"ok": True}, 201, cookie=self.cookie(self.store.session()))
            if method == "POST" and path == "/api/auth/login":
                token = self.store.authenticate(self.body().get("password"), self.client_address[0])
                return self.json_response({"ok": True}, cookie=self.cookie(token))
            if path.startswith("/api/chatgpt/"):
                self.require_auth(api=True)
                if method == "POST" and path == "/api/chatgpt/documents":
                    return self.json_response(self.store.chatgpt_document(self.body()), 201)
                raise Problem("Esta operación no existe.", 404)
            self.require_auth()
            if method == "POST" and path == "/api/auth/logout":
                token = self.session_token()
                with self.store.connect() as db:
                    db.execute("DELETE FROM sessions WHERE hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))
                return self.json_response({"ok": True}, cookie=self.cookie("", True))
            if method == "POST" and path == "/api/auth/password":
                data = self.body()
                self.store.authenticate(data.get("current_password"), self.client_address[0])
                self.store.set_password(data.get("password"), self.store.setting("name"))
                return self.json_response({"ok": True}, cookie=self.cookie(self.store.session()))
            if method == "POST" and path == "/api/nodes":
                return self.json_response(self.store.create(self.body()), 201)
            if path.startswith("/api/nodes/"):
                node_id = path.removeprefix("/api/nodes/")
                if method == "PATCH":
                    return self.json_response(self.store.update(node_id, self.body()))
                if method == "DELETE":
                    self.store.delete(node_id)
                    return self.json_response({"ok": True})
            if method == "POST" and path == "/api/restore":
                self.store.restore(self.body())
                return self.json_response(self.store.state())
            if method == "POST" and path == "/api/key":
                token = "aula_" + secrets.token_urlsafe(36)
                with self.store.connect() as db:
                    db.execute("INSERT OR REPLACE INTO settings VALUES ('api_key_hash', ?)", (hashlib.sha256(token.encode()).hexdigest(),))
                    self.store.log(db, "key_created", "Conexión de ChatGPT preparada")
                return self.json_response({"key": token})
            if method == "DELETE" and path == "/api/key":
                with self.store.connect() as db:
                    db.execute("DELETE FROM settings WHERE key = 'api_key_hash'")
                    self.store.log(db, "key_revoked", "Conexión de ChatGPT revocada")
                return self.json_response({"ok": True})
            raise Problem("Esta operación no existe.", 404)
        except Problem as e:
            self.json_response({"error": str(e)}, e.status)
        except (sqlite3.Error, OSError):
            self.json_response({"error": "No se pudo guardar. Revisa el espacio y los permisos del servidor."}, 500)


def make_server(host="127.0.0.1", port=4173, directory=None, public_url="", local_mode=False):
    if local_mode and (host not in {"127.0.0.1", "localhost"} or public_url):
        raise ValueError("El modo sin contraseña solo puede escuchar en 127.0.0.1 sin dominio público.")
    server = ThreadingHTTPServer((host, port), Handler)
    server.store = Store(directory or os.environ.get("AULA_DATA_DIR", ROOT / ".data"))
    server.public_url = public_url.rstrip("/")
    server.local_mode = local_mode
    if local_mode and not server.store.setting("name"):
        with server.store.connect() as db:
            db.execute("INSERT INTO settings VALUES ('name', 'Ginés')")
        if not server.store.nodes():
            server.store.seed()
    return server


def main():
    parser = argparse.ArgumentParser(description="Aula: tu espacio privado de estudio")
    parser.add_argument("--set-password", action="store_true", help="Crear o cambiar la contraseña en un terminal seguro")
    parser.add_argument("--local", action="store_true", help="Uso en un entorno de confianza, sin contraseña y solo en loopback")
    args = parser.parse_args()
    directory = os.environ.get("AULA_DATA_DIR", ROOT / ".data")
    if args.set_password:
        store = Store(directory)
        name = store.setting("name") or input("Nombre de tu espacio: ").strip() or "Mi espacio"
        password = getpass.getpass("Contraseña (mínimo 12 caracteres): ")
        if password != getpass.getpass("Repite la contraseña: "):
            raise SystemExit("Las contraseñas no coinciden.")
        store.set_password(password, name)
        print("Contraseña guardada. Las sesiones anteriores se han cerrado.")
        return
    public_url = os.environ.get("AULA_PUBLIC_URL", "")
    if public_url and (urlsplit(public_url).scheme != "https" or not urlsplit(public_url).netloc or urlsplit(public_url).path not in {"", "/"}):
        raise SystemExit("AULA_PUBLIC_URL debe ser un dominio HTTPS sin ruta.")
    server = make_server(os.environ.get("AULA_HOST", "127.0.0.1"), int(os.environ.get("AULA_PORT", "4173")), directory, public_url, args.local or os.environ.get("AULA_LOCAL_MODE") == "1")
    print(f"Aula escuchando en el puerto {server.server_port}. Datos: {server.store.directory}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
