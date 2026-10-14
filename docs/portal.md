# Portal privado: Outlook y tu GPT

El código está preparado; conectar una cuenta requiere un servidor activo con HTTPS, una aplicación de Microsoft registrada y autorizar tu cuenta. GitHub Pages sigue siendo la versión local en el navegador. El entorno de Codex sirve para desarrollar y no es alojamiento permanente.

## 1. Desplegar el portal

Necesitas un servidor con Docker Compose, disco persistente y un dominio o subdominio. No hace falta contratar un proveedor concreto. Apunta el registro DNS del dominio a ese servidor y permite los puertos 80/443. Caddy obtiene y renueva HTTPS. Conserva el volumen `aula-data`: incluye apuntes, horario, correos y credenciales privadas.

En el servidor, clona la rama `main` y prepara la configuración:

```sh
git clone --branch main https://github.com/GinesN/NOTAS-CLASE.git
cd NOTAS-CLASE
cp deploy/portal.env.example .portal.env
chmod 600 .portal.env
```

Edita `.portal.env` en una terminal segura. Cambia `AULA_DOMAIN` y `AULA_PUBLIC_URL` por tu dominio real. Puedes dejar los campos de Outlook e IA vacíos para arrancar primero los apuntes. Las claves nunca se escriben en GitHub, ChatGPT ni variables Vite.

```sh
docker compose --env-file .portal.env build
docker compose --env-file .portal.env run --rm aula python server/app.py --set-password
docker compose --env-file .portal.env up -d
docker compose --env-file .portal.env ps
```

La contraseña protege el portal cuando sea accesible por Internet. La creación inicial prepara las doce asignaturas si la base está vacía. Después entra en tu dominio. Crea un apunte de prueba, reinicia con `docker compose --env-file .portal.env restart aula` y comprueba que sigue ahí. El backend no publica un puerto; solo es accesible mediante el proxy HTTPS. El modo sin contraseña continúa disponible únicamente para desarrollo en loopback.

En este entorno cloud, las descargas dentro de Docker necesitan el almacén de certificados que el entorno ya confía. La opción de build `--secret id=build_ca,src=/etc/ssl/certs/ca-certificates.crt` aporta ese almacén solo a npm/pip durante la instalación, conserva la verificación TLS y no lo copia a la imagen final ni cambia la confianza del equipo. En un servidor con certificados habituales no necesitas esa opción.

Para llevar tus apuntes de Pages, descarga una copia en Ajustes del navegador actual e impórtala en Ajustes del portal. La importación reemplaza los apuntes y horario del destino: exporta una copia del destino primero si ya tiene datos. SQLite y el navegador no se sincronizan solos. Importa también el archivo privado del horario si todavía no estaba en esa copia.

## 2. Registrar Outlook personal

En [Microsoft Entra](https://entra.microsoft.com/), App registrations → New registration, elige **Personal Microsoft accounts only**, o una opción que incluya cuentas personales. Si tu cuenta no permite registrar aplicaciones, necesitarás acceso a un directorio de Entra habilitado para ello; ese permiso no se puede conceder desde este repositorio.

Configura la plataforma **Web** con la URI exacta `https://TU-DOMINIO/api/mail/callback`. No es una SPA ni la URL de GitHub Pages. Copia Application (client) ID a `AULA_MS_CLIENT_ID`. En Certificates & secrets crea un secreto y guarda **su valor**, no su identificador, en `AULA_MS_CLIENT_SECRET`. Anota su caducidad y renueva antes de que expire. `AULA_MS_TENANT_ID=consumers` permite iniciar sesión con Outlook personal.

En API permissions añade Microsoft Graph **Delegated permissions**: `Mail.Read`, `User.Read` y `offline_access`. No uses permisos de aplicación, `Mail.ReadWrite` ni `Mail.Send`. `User.Read` identifica qué cuenta has conectado; `Mail.Read` lee la bandeja; `offline_access` permite renovar la autorización sin volver a iniciar sesión cada hora.

```sh
docker compose --env-file .portal.env up -d --force-recreate aula
```

Abre **Emails → Conectar con Microsoft**, inicia sesión en la cuenta correcta y acepta los permisos. La aplicación usa estado de un solo uso y PKCE para proteger la autorización. Los tokens se cifran con `.data/outlook.key` (o `/data/outlook.key` en Docker); nunca aparecen en copias de apuntes ni en Git. No borres esa clave mientras conserves los tokens.

Se importan los últimos 30 días de la **bandeja de entrada**, después se revisan cambios cada cinco minutos mientras el servidor esté activo. La sincronización sigue los enlaces delta de Microsoft, guarda lotes y su cursor juntos y evita duplicados. Los mensajes movidos fuera de la bandeja o eliminados se retiran del portal. No se inspeccionan otras carpetas, archivos ni adjuntos. Si utilizas reglas de Outlook que mueven correo a otras carpetas, ese correo no aparecerá en esta primera versión. La lista muestra los 300 importados más recientes; filtra dentro de esa lista.

**Refresh** solicita una actualización y reintenta traducciones pendientes. **Disconnect** elimina los correos y credenciales locales sin modificar Outlook. Para retirar también el consentimiento, elimina la aplicación en [los permisos de tu cuenta Microsoft](https://account.live.com/consent/Manage).

## 3. Activar inglés y resúmenes

La integración utiliza la [API de OpenAI](https://platform.openai.com/api-keys). Guarda una clave de tu proyecto en `AULA_AI_API_KEY` y configura facturación/límites del proyecto. `AULA_AI_MODEL` propone `gpt-4.1-mini`; puedes elegir otro modelo que admita Responses y JSON Schema estricto. Reinicia el contenedor como arriba.

El uso de esa API tiene coste según consumo y se factura por separado de la suscripción de ChatGPT. Al activarla, el remitente, asunto y texto de los correos importados se envían al proveedor para traducir y resumir con `store=false`. No se envían adjuntos ni credenciales. La política del proveedor sigue aplicándose. Sin clave, la app muestra el original y «Translation pending», sin inventar traducciones.

Cada correo muestra asunto y texto en inglés, resumen de hasta tres frases, prioridad sugerida, categoría y asignatura cuando puede identificarse. Puedes leer el original y abrirlo en Outlook. La prioridad y la clasificación son sugerencias de IA: comprueba fechas y acciones importantes. Los cuerpos extensos se limitan a 40.000 caracteres para traducir, con aviso. El worker procesa hasta diez traducciones por ciclo; los errores se muestran y las peticiones limitadas se reintentan más tarde. Los mensajes de correo son datos sin permisos para ejecutar acciones; no se siguen sus enlaces ni se interpretan como instrucciones.

## 4. Conectar el GPT personalizado

Desde tu dominio privado, abre **ChatGPT**, crea la clave de conexión e importa `https://TU-DOMINIO/api/openapi.json` en las acciones de tu GPT. Autenticación: **API key → Bearer**. Introduce la clave solo en ese campo seguro. Usa `https://TU-DOMINIO/privacy` como URL de privacidad.

Copia [las instrucciones del GPT](gpt-instructions.md) al editor. El GPT consulta tu estructura y guarda pregunta y respuesta en la asignatura y carpeta correspondientes; por defecto utiliza `Registro de estudio` si no indicas tema o destino. Prueba con «En International Trade, explica qué es la ventaja comparativa y guarda la pregunta y la respuesta». Comprueba que el documento aparece en el portal y la actividad muestra autor ChatGPT. Puede solicitar confirmación para ejecutar una acción.

Esta conexión funciona en **ese GPT personalizado**. Otras conversaciones de ChatGPT no se guardan automáticamente. La memoria futura procede de los documentos guardados; no de todo el historial de tu cuenta. La clave del GPT permite leer apuntes, horario y actividad y crear documentos, sin borrar ni editar ni acceder a Outlook. Se puede revocar o renovar desde el portal. La API de correo y la clave del GPT son independientes; conectar el GPT no necesita una clave API de OpenAI, pero traducir los correos desde el servidor sí.

## Copias y mantenimiento

Las copias JSON de Ajustes incluyen los datos de estudio y excluyen correo y credenciales. Para trasladar todo el servidor, detén Aula y respalda privadamente el volumen `aula-data`, incluida `outlook.key`, junto a `.portal.env`. Las copias del volumen contienen mensajes y claves: conserva permisos restrictivos y cifrado en su destino. No hagas una copia de SQLite mientras escribe. Evita ejecutar varias réplicas con el mismo volumen; esta versión usa un único proceso con un worker.

Comprobaciones realizadas sin cuentas reales: tests de OAuth/PKCE, cifrado, renovación, sincronización incremental, errores del proveedor, límites de enlaces, separación de permisos y UI en escritorio/móvil. El inicio de sesión real, el consentimiento, la traducción con facturación y las acciones dentro de ChatGPT se validan al configurar tus cuentas; los tests simulados no confirman esa conexión.
