# 🦈 SharkyBot v2

Bot de WhatsApp (Baileys) con ~600 comandos y personalidad de Miku 💙 (menú paginado con botón Siguiente). Owner: Sharky.

## Arrancar (panel o Termux)

1. Sube la carpeta y haz `npm install --legacy-peer-deps` (ya hay un `.npmrc` que lo activa).
2. Edita `config.js`:
   - `owner.number`: tu número con código de país (ej. `58412XXXXXXX`).
   - `pairingNumber`: el número del bot (o usa la variable de entorno `PAIRING_NUMBER`).
3. Comando de inicio: `node index.js` (o `bash start.sh` para que reinicie solo).
4. Sale un código de 8 letras en la consola: WhatsApp → Dispositivos vinculados → Vincular con número de teléfono.

El número que vincules queda como owner automáticamente.

## Importante
- **Sin servidor web por defecto.** La API interna está APAGADA (no ocupa ningún puerto). Si la quieres: `API_ENABLED=1` y `API_PORT=3010`.
- **Si vienes de la v1 (o te sale "Bad MAC")**: borra la carpeta `session` y vincula de nuevo. Asegúrate de tener UNA sola instancia corriendo (el bot usa un archivo `.bot.lock`; `NO_LOCK=1` lo desactiva).
- Si el panel no tiene TTY, el número de vinculación tiene que ir en `config.js` o en `PAIRING_NUMBER`.

## Menú
`.menu` / `.help` / `.menú`: banner arriba y la lista en mensajes de texto normales (así lo ven todos los usuarios).
`.menu <categoría>` (ej. `.menu ia`), `.menu <comando>` para ver el uso, o atajos `.menuia`, `.menudescargas`...
En `config.js`, `menuStyle: 'foto'` (recomendado) o `'ad'`.

## IA
Funciona sin clave usando Pollinations (gratis, puede fallar a veces). Para que sea estable pon una clave gratis de Groq o Gemini en `config.ai.key` (con su `baseUrl` y `model`).

## Descargas y multimedia
Necesitan `ffmpeg` y `yt-dlp` en el panel/Termux (`pkg install ffmpeg python && pip install yt-dlp`). Si faltan, el comando avisa claramente.

## Personalizar
- Cada archivo de `plugins/` es una categoría; añade un objeto `{name, aliases, desc, category, run(ctx)}` y listo. `.reload` recarga sin reiniciar.
- `config.local.js` (opcional) se mezcla sobre `config.js`.
- Datos de usuarios: `database.json`.

## Novedades
- **IA**: solo `.ia`, `.chatgpt`, `.gemini`, `.miku` (habla con la personalidad de Miku), `.resetia` e `.imagen`. ChatGPT y Gemini usan los modelos gratuitos de Pollinations; si pones tu clave en `config.ai.key` todas usan tu proveedor.
- **Descargas sin enlace**: `.play nombre`, `.tiktok texto`, `.soundcloud nombre`, `.pinterest gatos 5` (7 por defecto, máx. 10). Con enlace también funciona. Siempre manda primero una tarjeta decorada con la portada.
- **Menú**: un solo mensaje (foto + menú). Botón *Siguiente*/*Anterior*; si algún teléfono no lo ve, el owner usa `.botones off` y queda `.sig`.
- `config.js`: `menuButtons`, `menuMaxChars`, `menuDesc` (true = muestra la descripción de cada comando), `imagesMax`, `imagesDefault`.

- **Menú oculto**: `.menu2` (HD/4K): fondos `.wall4k .wallhd .wallcel`, imágenes IA `.imagen4k`, `.captura <url>`, `.peli`, `.animehd`, `.qrhd`. Las imágenes llegan dos veces: vista rápida y archivo original sin comprimir.

- **Spotify**: `.spotify <canción o enlace>` (portada HD + datos + audio completo), `.spotifysearch`. Para buscar en Spotify de verdad pon `spotify.clientId/clientSecret` en `config.js` (gratis en developer.spotify.com); sin claves usa iTunes.
- **Menú con significado** de cada comando, en orden alfabético, con índice de páginas (`.menu 5`).
- **Owner**: `.setbanner` (responde a una imagen o pon un enlace) y `.setprefix #` (solo servirá ese; `.setprefix multi` vuelve a todos; si lo olvidas escribe solo `prefijo`).
- **Miku libre**: `.autoresponder on|off|all`. Miku contesta sola y puede ejecutar comandos (música, imágenes, clima...) pero nunca los de owner/admin.

- **Menú sin emojis** y con banner incrustado (`menuStyle: 'ad'`: se ve sin descargar nada). `.menustyle foto` vuelve a la foto normal. Salto de página: `.menu 5`, `.sig`.
- **Velocidad**: reacciones en segundo plano, IA con servicios en paralelo, `yt-dlp -N 4`. Con una clave gratis de Groq en `config.ai.key` la IA responde en 1-2 s.
- **Miku**: pedidos comunes (música, fotos, imagen IA, tiktok, clima) se ejecutan al instante sin esperar a la IA; el resto lo resuelve la IA viendo los comandos más parecidos a lo que pidió.

- **Si otros usuarios ven "Esperando mensaje"**: reacciones, botones y banner incrustado quedan APAGADOS por defecto (`reactions`, `menuButtons`, `menuStyle: 'foto'`) porque algunos teléfonos no los descifran. El menú sale como foto + texto; páginas con `.sig` o `.menu 5`. Si la sesión sigue fallando: borra la carpeta `session`, vincula de nuevo y deja UNA sola instancia del bot.

## Owner con acceso total
- `config.js` → `owner.number` es el owner principal. El número que vincula el bot también lo es.
- WhatsApp en grupos a veces manda un ID interno (LID) en vez del número; el bot lo une solo con la lista del grupo y lo recuerda.
- Más owners: `.addowner <número>` (o responde/menciona), `.delowner`, `.owners`. Si el bot no te reconoce, escribe `.miid` y desde el número vinculado usa `.addowner <tu id>`.
- `.reacciones on|off` activa o apaga las reacciones a cada comando (todas las respuestas ya citan tu mensaje).

## Miku
Sabe quién es su dueño (con su número), el estado del bot y los miembros del grupo (con nombre, admins y los más activos). Pregúntale: "Miku, quién es tu dueño", "Miku, estado del bot", "Miku, quiénes son los usuarios del grupo".

## Anime
Las reacciones (`.hug`, `.kiss`...) mandan el GIF animado (necesita `pkg install ffmpeg`); nunca mandan el enlace.

## Sub bots (`.code`)
Cualquier miembro escribe `.code` (o `.code 584121234567`) **en el grupo** y el bot responde ahí mismo con el código de 8 letras, los pasos y el código suelto para copiarlo fácil. Nunca escribe al privado de nadie.
- WhatsApp → Dispositivos vinculados → Vincular con el número de teléfono → pega el código (3 minutos).
- Cada sub bot tiene su propia sesión (`sessions/sub-<número>`), su propio reintento y su propia caché: si uno falla, los demás y el principal no se enteran. Al reiniciar se restauran solos.
- Su dueño usa todos los comandos normales; los comandos de owner del bot principal (`.restart`, `.broadcast`...) siguen siendo solo tuyos. Tú sigues siendo owner en todos los sub bots.
- Si el bot principal y un sub bot están en el mismo grupo, responde el que llegue primero.
- Owner: `.subbots` (lista), `.delsubbot <número>`, `.subbotmode on|off`. Cada quien puede quitar el suyo con `.delsubbot`. Máximo en `config.subbots.max` (10).

## Miku (grupos y personalidad)
- Estados de ánimo: tierna, coqueta, traviesa, fría y un poquito mala; entiende referencias (anime, memes, vocaloid, jerga latina).
- En grupos, si un **admin** (o tú) se lo pide, Miku saca miembros, da o quita admin, cierra/abre el grupo y menciona a todos: "Miku saca a @fulano", "Miku quítale admin a @fulano". Necesita ser admin del grupo. Nunca actúa contra su dueño ni contra ella misma, y si quien pide no es admin, se niega.

## Decoración
Todas las respuestas de comandos (texto y pies de foto/video) salen con el marco de Miku del menú.

## GIF de anime
Se convierten a MP4 en alta calidad (1080p por defecto, `config.gifHeight`). Owner: `.gifhd 720|1080|2160` (2160 = "4K": pesa y tarda más; los GIF originales son pequeños, así que se escalan con lanczos). Al iniciar, el bot instala solo ffmpeg y yt-dlp en Termux si faltan (`AUTO_INSTALL=0` lo apaga).

## Novedades v5
- **`.bots`** (cualquiera): lista el bot principal y los sub bots con su estado, tiempo activo, mensajes y comandos. El owner además ve el último error de cada sub bot.
- **Sub bots**: arrancan solos al iniciar (sin esperar al principal), aceptan también los mensajes propios que algunos teléfonos mandan como `append`, y el bot principal ya no les roba los mensajes de su dueño en grupos. Como corren en el mismo programa, **se actualizan junto con el principal**: cambias los archivos, haces `.restart` y todos arrancan con el código nuevo (`.reload` actualiza los comandos de todos al instante).
- **Economía**: `.banco`, `.impuestos`, `.pagarimpuestos`, `.prestamo`, `.pagarprestamo`, `.deuda`. El banco cobra solo: impuesto diario de 1.5% sobre lo que pase de 1000, intereses de 0.5% diario por tu ahorro (máx 5000), préstamos con 5% diario y plazo de 7 días (si vence: recargo 10% y embargo), 1% de comisión al retirar. Los avisos salen una vez al día cuando usas cualquier comando. `.top` y `.balance` descuentan las deudas. (La calculadora que se llamaba `.prestamo` ahora es `.cuotaprestamo`.)
- **GIF de anime**: el bot busca un ffmpeg que funcione (variable `FFMPEG_PATH`, el del sistema, `bin/ffmpeg` o el paquete npm `@ffmpeg-installer/ffmpeg`, que trae el binario y sirve en paneles). Si no hay ninguno, manda el GIF como imagen y avisa qué instalar. En paneles también descarga yt-dlp a `bin/` si falta.
- **APIs**: reintentos automáticos (red, timeouts, 429, 5xx) y mensajes de error claros en español.
- **Miku**: nuevos ánimos (más coqueta, tsundere), acceso a todo el catálogo de comandos (reacciones anime, economía, menú, "usa el comando X"...).
# Sharknexx
# Sharknexx
# Sharknexx
# SHARKNEX
# -
# -
