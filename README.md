# Master Hands — Acoustic Project OS (v2)

Estación de trabajo para proyectos de insonorización: gestión de clientes, visita técnica, física acústica, cotizador paramétrico (BOM), simulador 3D, generador de tonos/barridos de frecuencia, propuestas/contratos con firma electrónica auditada, envío por email y exportación a PDF — con **base de datos real en disco**, **usuarios y roles**, **sincronización en vivo entre dispositivos**, **respaldos automáticos**, y **registro de errores auditable**.

Este proyecto es la versión 2 de tu sistema original de un solo archivo HTML. Ver la sección [Qué cambió](#8-qué-cambió-respecto-a-la-v1) para el detalle punto por punto.

---

## 1. Instalación local (Windows, Mac o Linux)

Requisitos: [Node.js](https://nodejs.org) versión 18 o superior (probado con Node 22).

```bash
cd master-hands-os
npm install
cp .env.example .env
npm start
```

Abre **http://localhost:4000** en tu navegador. Eso es todo — no necesitas Google Drive, Excel ni instalar nada más. `npm install` no requiere compilar nada (no hay dependencias nativas, ni siquiera para las miniaturas de fotos), así que funciona igual en Windows, Mac o Linux sin instalar compiladores. La base de datos (`data/masterhands.json`), tus archivos subidos (`data/uploads/`), los logs (`data/logs/`) y los respaldos (`data/backups/`) quedan en la carpeta del proyecto.

Para desarrollo con recarga automática: `npm run dev`.
Para correr las pruebas automatizadas: `npm test` (21 pruebas sobre las fórmulas acústicas, el motor de costos y la seguridad de contraseñas).

### Respaldo de tu información
Todo lo que importa vive en la carpeta `data/`. Además del respaldo automático interno (ver sección 5), copia esa carpeta de vez en cuando a un disco externo, Google Drive o Dropbox. Para restaurar en otro computador: instala el proyecto ahí y reemplaza su carpeta `data/` por la respaldada.

### Nota técnica: por qué JSON y no SQLite
Se evaluó SQLite real (better-sqlite3) durante el desarrollo, pero requiere compilar un módulo nativo al hacer `npm install`, lo cual puede fallar de forma críptica según el sistema operativo, la red o el antivirus del usuario. Se optó por un almacén JSON con escritura atómica: sigue siendo una base de datos real en disco, pero con instalación 100% garantizada en cualquier máquina. Si el negocio crece a necesitar consultas complejas o concurrencia multiusuario muy alta, la migración natural es a Postgres (ver sección 7).

---

## 2. Primer arranque: crear tu cuenta y tu equipo

La primera vez que abras `http://localhost:4000`, el sistema te pedirá crear la cuenta de **administrador** (usuario, contraseña, nombre). Desde el panel "Usuarios" (visible solo para administradores) puedes crear cuentas para tu equipo con tres roles:

| Rol | Puede hacer |
|---|---|
| **Administrador** | Todo: proyectos, usuarios, Estado del Sistema, respaldos. |
| **Comercial / Ventas** | Crear/editar/eliminar proyectos, propuestas, contratos, envío de email. No ve usuarios ni logs del sistema. |
| **Técnico de campo** | Editar visita técnica, dimensiones, BOM, subir fotos/archivos, usar el simulador 3D y el generador de tonos. No puede eliminar proyectos ni ver Propuesta/Contrato/Sistema/Usuarios. |

Las contraseñas se guardan con hash (scrypt, con sal aleatoria por usuario) — nunca en texto plano. Después de 5 intentos fallidos seguidos, ese usuario queda bloqueado 15 minutos (protección básica contra fuerza bruta).

### Si el administrador pierde su contraseña
Como las contraseñas están hasheadas, nadie —ni siquiera tú revisando el archivo de datos— puede "leer" la contraseña original. Para restablecerla:
1. Detén el servidor (Ctrl+C en la terminal donde corre `npm start`). Es importante detenerlo para que no haya dos procesos escribiendo el archivo de datos a la vez.
2. Corre: `npm run reset-password` (te pedirá el usuario y la nueva contraseña sin mostrarla en pantalla), o directo: `npm run reset-password -- admin miClaveNueva123`.
3. Vuelve a iniciar el servidor con `npm start`.

### Cada usuario puede gestionar su propia cuenta
Desde el menú "Mi Cuenta" (visible para todos los roles) cualquier usuario puede cambiar su propia contraseña y ver/cerrar sus sesiones activas en otros dispositivos — útil si olvidaste cerrar sesión en una tablet compartida.

## 3. Acceso desde otros dispositivos en tu misma red (tablets en obra)

Al iniciar el servidor verás en la terminal algo como:
```
➜  Local:   http://localhost:4000
➜  Red LAN: http://192.168.1.50:4000
```
Esa segunda URL funciona desde cualquier tablet, celular o computador conectado al **mismo wifi** que la máquina donde corre el servidor. Los cambios que haga cualquier dispositivo se reflejan **en vivo** en los demás gracias a una conexión en tiempo real (WebSocket). Ojo: si dos personas editan el mismo campo al mismo tiempo, gana el último que guarda.

Para acceso fuera de tu red local, necesitas desplegarlo online — ver la sección 7.

## 4. Buscar y organizar proyectos

La lista de proyectos tiene un buscador (por nombre, cliente, código o ciudad) y un filtro por estado, para cuando ya tengas decenas de proyectos guardados y no quieras revisarlos uno por uno.

Las fotos que subas a la Bóveda de Archivos generan automáticamente una miniatura liviana (360px de ancho) para que la vista cargue rápido incluso con fotos pesadas de cámara o celular; al descargar siempre obtienes el archivo original a resolución completa.

## 5. Respaldos automáticos

El servidor genera un respaldo de la base de datos al arrancar y luego cada 6 horas mientras esté corriendo (ajustable con `BACKUP_INTERVAL_HOURS` en `.env`). Se guardan en `data/backups/` y se conservan los últimos 30. Desde el panel "Estado del Sistema" (solo administradores) puedes ver la lista, descargar cualquiera o generar uno manual con el botón "Respaldar ahora". Esto respalda la base de datos (proyectos, usuarios, historial); las fotos y archivos de `data/uploads/` no se incluyen por tamaño — para esos, sigue copiando la carpeta `data/` completa de vez en cuando (sección 1).

## 6. Integraciones opcionales

### Gemini AI (Copiloto de diagnóstico)
1. Ve a https://aistudio.google.com/app/apikey y genera una clave gratuita.
2. Ábrela en el archivo `.env` (nunca en el navegador):
   ```
   GEMINI_API_KEY=tu_clave_aqui
   ```
3. Reinicia el servidor.

Sin esta clave, el Copiloto funciona en "modo local" con diagnósticos basados en reglas.

### Envío de correo
Con Gmail (gratis): activa verificación en 2 pasos, genera una "contraseña de aplicación" en https://myaccount.google.com/apppasswords, y en `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tuempresa@gmail.com
SMTP_PASS=la_contraseña_de_aplicación_de_16_caracteres
SMTP_FROM=tuempresa@gmail.com
```
Sin esto configurado, el botón "Enviar por email" te avisa claramente y puedes exportar el PDF y enviarlo manualmente.

---

## 7. Correcciones de la ronda de pruebas reales

Después de que se probó la v2 en un navegador real (Chrome), se corrigieron estos hallazgos:

- **Chrome ofrecía "guardar contraseña" al escribir en campos que no son contraseñas** (ítems del BOM, entre otros): la pantalla de login quedaba oculta pero sus campos seguían en el HTML, confundiendo el autocompletado de Chrome en toda la página. Ahora se elimina del DOM por completo al iniciar sesión, y se agregó `autocomplete="off"` a los campos de texto/número del sistema.
- **Catálogo de materiales en el Estimador BOM**: más de 25 ítems típicos de insonorización organizados por categoría (muros, membranas, cielo raso, piso, puertas, ventanas, HVAC, acondicionamiento, ingeniería), con un botón "+" para agregarlos directo a la cotización sin escribir todo a mano.
- **El PDF exportado no incluía la firma, el nombre del firmante ni el aviso legal**: ahora se genera una versión completa del documento (texto + firma + nombre + cédula + fecha + aviso legal) antes de exportar o enviar por email.
- **Simulador 3D con fondo negro fijo**: se agregó un botón de tema claro/oscuro en la barra del visor 3D.
- **Menú en móvil obligaba a hacer scroll**: se reemplazó por un menú hamburguesa real (deslizable, con fondo oscuro detrás) que se cierra solo al elegir una opción.

## 8. Qué cambió respecto a la v1

- **Base de datos real:** `data/masterhands.json` con escritura atómica, en vez de `localStorage` del navegador.
- **Usuarios y roles:** login obligatorio, tres roles con permisos verificados en el servidor, bloqueo por fuerza bruta, cambio de contraseña propia, recuperación por CLI, y gestión de sesiones activas por dispositivo.
- **Sincronización en vivo:** WebSocket entre todos los dispositivos conectados al mismo servidor.
- **Respaldos automáticos** de la base de datos, con descarga manual desde la interfaz.
- **Búsqueda y miniaturas:** filtro de proyectos por texto/estado, y miniaturas livianas para fotos subidas.
- **Firma electrónica con rastro de auditoría:** nombre, cédula, IP, hora del servidor y hash SHA-256 del documento firmado. **No es una firma digital certificada** bajo la Ley 527 de 1999 — para eso se necesita un proveedor autorizado como DocuSign o SignWell.
- **Generador de tonos y barridos de frecuencia:** tono puro, barrido logarítmico y ruido rosa (Web Audio API).
- **Seguridad:** la clave de Gemini vive solo en `.env` del servidor; toda la API requiere sesión.
- **Registro de errores auditable** en `data/logs/` y en el panel "Estado del Sistema".
- **Validación de datos** en navegador y servidor.
- **Envío de email real** con adjunto PDF, y **exportación a PDF con marca**.
- **3D actualizado** (Three.js r169) con corrección de fuga de memoria y visualización de modos de presión.
- **Diseño propio** (grafito + cobre) con accesibilidad básica.
- **Aprendizaje del negocio:** panel con gráficas (tendencia mensual, tipologías, estados) basado en tus cotizaciones reales — no es un modelo de IA, es agregación de tus propios datos.
- **21 pruebas automatizadas** (`npm test`).
- **Multi-proyecto** con lista, búsqueda y filtro.

## 9. Dónde correrlo online gratis (y que sea auditable)

### Para que el código sea auditable: GitHub
Sube este proyecto a un repositorio de GitHub (puede ser privado). Te da historial completo de cambios. GitHub no hospeda el backend, solo el código.

### Para hospedarlo online gratis: Render, Railway o Fly.io

| Opción | Costo | Advertencia clave |
|---|---|---|
| **Render.com** (Free Web Service) | Gratis | Disco *efímero*: si el servicio se reinicia, `data/masterhands.json` se borra. Sirve para demo. |
| **Railway.app** | Capa gratuita limitada | Mismo problema de disco efímero. |
| **Fly.io** | Capa gratuita pequeña | Soporta *volúmenes persistentes* reales — mejor opción gratuita para datos que deben sobrevivir un redeploy. |

**Recomendación:** GitHub para auditoría, Fly.io si quieres persistencia real gratis online, o Render aceptando respaldos manuales frecuentes. Si necesitas concurrencia multiusuario a gran escala, migra `server/db.js` a Postgres gestionado (Supabase o Neon).

Mientras el equipo sea pequeño y trabaje en la misma red (sección 3), correrlo local con los respaldos automáticos activados (sección 5) es lo más simple y seguro.

## 10. Qué NO incluye todavía (para ser transparente)

- Firma digital **certificada** con validez legal plena (requiere proveedor externo como DocuSign).
- Fusión automática de cambios en conflicto — es "último en guardar gana".
- Exportador a CAD/DXF mencionado en el manual original como función futura.
- Sincronización en la nube entre redes distintas sin desplegar una instancia online compartida.
- Compresión/reintento automático de envío de fotos muy pesadas antes de subir (hoy el límite es 25MB por archivo).

Estas son buenas candidatas para una siguiente iteración, priorizadas según lo que más impacte el negocio.
