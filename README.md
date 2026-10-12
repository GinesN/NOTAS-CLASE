# Aula

Tu espacio personal para organizar clases, apuntes, exámenes y lo que quieres recordar. Preparado con las doce asignaturas seleccionadas de HES-SO.

## Versión GitHub Pages

Repositorio: https://github.com/GinesN/NOTAS-CLASE. Dirección prevista de la web: https://ginesn.github.io/NOTAS-CLASE/ (solo estará disponible cuando Pages esté activado y el despliegue haya terminado).

GitHub Pages sirve una versión que guarda tus datos en **IndexedDB, dentro de tu navegador**. Puedes crear y editar apuntes, carpetas y exámenes, buscar, marcar favoritos y exportar/importar copias completas. No necesita contraseña ni un servidor. El enlace público comparte la aplicación, no tus apuntes. Quien use el mismo perfil de navegador de tu dispositivo podrá ver tus datos.

Los datos **no se sincronizan** entre navegadores u ordenadores. Para cambiar de ordenador, descarga una copia en Ajustes e impórtala en el nuevo navegador. Borrar el almacenamiento del navegador borra esa copia de tus datos. La base SQLite del entorno y la base del navegador son instalaciones separadas; puedes trasladar documentos entre ellas usando la misma copia JSON.

Pages no puede ejecutar el servidor Python ni recibir escrituras desde ChatGPT o Codex. La sección ChatGPT permite copiar el contexto; el guardado automático necesita la versión con servidor que se documenta más abajo.

Construir y publicar los archivos estáticos:

```sh
npm ci --cache /workspace/.cache/npm
npm run build:pages
npm run test:pages
python3 scripts/publish-pages.py --push
```

El script prepara/sube únicamente `dist-pages` a la rama `gh-pages`, con un índice temporal, sin cambiar el checkout ni incluir la base de datos, los apuntes o las credenciales. Repetirlo con el mismo build no crea un nuevo commit. No usa `--force`.

En **Settings → Pages**, selecciona **Deploy from a branch**, rama **gh-pages**, carpeta **/ (root)** y guarda. Mantén la visibilidad del repositorio; Pages desde un repositorio privado depende del plan de GitHub. No cambies el repositorio a público automáticamente.

`npm run build` conserva la versión con servidor en `dist`. `npm run build:pages` genera la versión independiente en `dist-pages` y configura el subdirectorio `/NOTAS-CLASE/`; no se debe publicar el build de servidor en Pages.

- Carpetas dentro de carpetas: `Asignatura → Temas → Tema 1 → Apuntes`.
- Editor de apuntes en Markdown, buscador y favoritos.
- Exámenes con fecha y estado pendiente/completado.
- Memoria de las acciones realizadas en Aula.
- Copias exportables e importables, con todos los documentos y el historial.
- API para guardar contenido desde un GPT personalizado; herramienta local para guardar desde Codex.

## Empezar dentro del entorno

Necesitas Node.js 22.12+ (probado con 24.19), npm y Python 3.12+. El servidor no requiere paquetes de Python ni una base de datos externa.

```sh
cd /workspace/NOTAS-CLASE
npm ci --cache /workspace/.cache/npm
npm run build
npm run dev
```

`dev` escucha en el puerto 4173 y usa **modo local sin contraseña**, como has pedido. Solo acepta conexiones loopback y peticiones del mismo origen. Es adecuado dentro de un entorno de confianza; quien tenga acceso al entorno tiene acceso a los apuntes. No publiques este modo mediante un túnel o proxy.

La primera ejecución prepara las doce asignaturas seleccionadas y sus carpetas. Los siguientes arranques conservan los datos. La pantalla principal muestra la lista completa; al importar un horario con `add_courses: true`, se incorporan las asignaturas nuevas del archivo.

Para desarrollar, ejecuta `npm run watch` en otra terminal. Reconstruye el frontend al editar; recarga el navegador. Reinicia el servidor si cambias Python.

## Tus asignaturas

1. International Relations
2. International Trade
3. Financing and Valuation
4. International Channel Management
5. Market Research Fundamentals
6. International Supply Chain Management
7. Management in the Age of AI
8. International Organizational Behaviour
9. International Organizations
10. Global HR Management
11. Design Thinking for AI and Digital Innovation
12. English Communication 3

Los nombres oficiales se conservan en la descripción de cada asignatura y en `server/courses.json`. No se han inventado apuntes ni fechas de examen.

## Horario y memoria de estudio

La sección **Horario** guarda una única franja semanal por asignatura: día, inicio, fin y aula opcional. Puedes editar cada fila o importar un JSON con `app: "AulaSchedule"`, `version: 1` y `courses`, una lista con `title`, `weekday` (lunes=1, domingo=0), `start`, `end` y `room`. `add_courses: true` permite incorporar las asignaturas del archivo que falten. La importación actualiza el horario y conserva los apuntes; se valida completa antes de guardar. Los horarios personales se entregan y almacenan fuera del código público.

Al crear un examen dentro de una asignatura se propone la hora de inicio de esa clase. Puedes modificarla o dejarla vacía para una excepción. Si la fecha cae en otro día de la semana, la aplicación lo indica. La hora de fin de la clase no fija automáticamente la duración del examen.

**Memoria → Exportar contexto** genera un Markdown con asignaturas, horario, documentos y registro completo. Puedes compartir ese archivo con ChatGPT al empezar una conversación futura. El registro de actividad no guarda por sí solo el texto de tus preguntas y respuestas: crea un apunte para conservarlas. Aula y ChatGPT no leen ni sincronizan automáticamente sus historiales. Un archivo extenso puede requerir seleccionar los documentos relevantes según el tamaño de contexto de la conversación.

Para incorporar un horario en la versión con servidor:

```sh
python3 server/manage.py import-schedule --file /ruta/privada/horario.json
```

## Cambiar de ordenador

El repositorio guarda el código. Tus apuntes se guardan en **`.data/aula.sqlite3`**, que está excluido de Git junto con contraseñas, claves y ficheros locales.

Tienes dos posibilidades:

1. **Usar una web alojada:** despliega Aula en un servidor con almacenamiento persistente y HTTPS. Entras desde cualquier ordenador en el mismo servidor y tus datos siguen allí.
2. **Mover una instalación:** en Ajustes descarga una copia JSON. Instala Aula en el nuevo equipo e importa la copia. La importación reemplaza los documentos actuales; conserva una copia antes. No incluye contraseñas, claves API ni sesiones.

Puedes crear una copia sin navegador:

```sh
python3 server/manage.py export --out /ruta/privada/aula-copia.json
python3 server/manage.py import --file /ruta/privada/aula-copia.json --replace
```

Protege ese fichero: contiene los apuntes en texto. `export` no sobrescribe un fichero existente. También puedes detener el servidor y copiar íntegramente `.data` para trasladar la instalación con sus credenciales. No copies una SQLite que se está escribiendo; usa la exportación o detén antes el servidor.

El entorno cloud guarda herramientas y archivos cuando publicas su configuración. Los procesos se deben arrancar de nuevo. **Publicar el entorno de desarrollo no despliega una web pública**, y no equivale a subir el código a GitHub. Conserva además una copia de tus apuntes fuera del entorno. Las restauraciones del entorno no son una estrategia de sincronización entre varias instalaciones.

## Web privada desde cualquier dispositivo

Elige un servidor o servicio que admita Python, proceso persistente, HTTPS y un volumen persistente. No se ha contratado ni publicado ningún alojamiento. No uses almacenamiento efímero para `.data`.

1. Instala las dependencias y construye el frontend con los comandos anteriores.
2. Elige `AULA_DATA_DIR` en el volumen persistente y crea la contraseña **desde una terminal segura**:

   ```sh
   export AULA_DATA_DIR=/ruta/persistente/aula
   python3 server/app.py --set-password
   ```

3. Arranca detrás de un proxy HTTPS, sin `--local` ni `AULA_LOCAL_MODE=1`:

   ```sh
   export AULA_HOST=127.0.0.1
   export AULA_PORT=4173
   export AULA_PUBLIC_URL=https://tu-dominio.example
   python3 server/app.py
   ```

   Si el proxy se ejecuta en otro contenedor, configura `AULA_HOST=0.0.0.0` y permite llegar al servidor únicamente desde el proxy. Conserva el encabezado Host del dominio configurado. El backend utiliza cookies HttpOnly, SameSite=Strict y Secure con un dominio HTTPS; valida el origen de las escrituras. La contraseña se deriva con PBKDF2 y sal; los tokens de sesión y de API se guardan como hashes.

4. Registra el proceso en el supervisor de tu alojamiento, configura copias periódicas y verifica crear/leer un apunte tras reiniciar. En `/api/health` debe responder `{"status":"ok","app":"Aula"}`.

Las variables se leen del proceso. `.env.example` es documentación: el servidor no carga `.env` automáticamente. Los comandos están escritos para Bash; en Windows puedes usar WSL o establecer las variables equivalentes en PowerShell y ejecutar `python`.

## Guardar desde este chat de Codex

Mientras Codex trabaja en este entorno, puede leer el índice y guardar un documento directamente, sin una cuenta de ChatGPT conectada ni una clave API. La acción aparece con autor **Codex** en Memoria.

```sh
python3 server/manage.py list
python3 server/manage.py save < /ruta/temporal/documento.json
```

Formato de entrada:

```json
{
  "path": ["International Trade", "Temas", "Tema 1", "Apuntes"],
  "title": "Resumen de ventaja comparativa",
  "content": "## Idea central\n\nContenido que has pedido guardar.",
  "kind": "note",
  "request_id": "un-identificador-unico"
}
```

Se reutilizan las carpetas existentes y se crean las que falten. `request_id` evita duplicados al reintentar el mismo documento. Una ruta ambigua se rechaza, sin guardar parcialmente. Esto funciona cuando el agente tiene acceso al entorno; una conversación ordinaria de ChatGPT no tiene acceso automático a esta máquina.

## Conectar un GPT personalizado

La sección **ChatGPT** explica los pasos y permite copiar el índice de asignaturas. La conexión automática todavía requiere un dominio HTTPS y la configuración de las acciones del GPT en tu cuenta; la disponibilidad del editor depende de tu cuenta.

1. Despliega Aula con HTTPS y contraseña.
2. En la aplicación crea una clave de conexión. Solo se muestra una vez; se conserva únicamente su hash. No la pegues en conversaciones, archivos del repositorio ni variables públicas.
3. En las acciones de un GPT personalizado importa `/api/openapi.json` desde el dominio definitivo. Configura autenticación **API key → Bearer** e introduce la clave en el campo seguro del editor.
4. Copia desde Aula las instrucciones preparadas para el GPT. La URL de privacidad es `/privacy`.
5. Prueba «Guarda este resumen en International Trade → Temas → Tema 1 → Apuntes» y confirma que aparece en Aula y en Memoria.

La API permite leer documentos y crear apuntes/exámenes. No puede eliminar ni modificar documentos existentes. No se llama a OpenAI desde Aula y no necesitas una API key de OpenAI. Puedes revocar la clave desde Aula. Renovarla invalida la anterior.

El historial registra operaciones, no conversaciones completas ni una memoria automática de toda tu cuenta de ChatGPT.

## Comprobaciones

```sh
npm run build
npm test
npm run test:ui
```

Las pruebas de Python verifican almacenamiento tras recrear la conexión, restauración completa, errores sin escrituras parciales, permisos, sesiones y la API del GPT. Las pruebas de navegador ejecutan los flujos de creación/edición/búsqueda, exámenes, copia y conexión en escritorio y móvil.

Playwright utiliza Chromium del entorno (`/usr/bin/chromium`). En otra máquina configura `AULA_CHROMIUM` con la ruta del ejecutable de Chromium. Las pruebas usan una base de datos temporal y otro puerto; no tocan tus apuntes.
