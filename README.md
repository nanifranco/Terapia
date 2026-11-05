# Terapia

Una app web sencilla para apuntar lo que quiero hablar en mi próxima sesión de terapia.

- Se entra solo con Face ID y se bloquea sola al salir de la app.
- Los temas se reordenan manteniendo presionado y arrastrando.
- Palomita: el tema pasa a "Ya hablados". Basurita: se remueve (con confirmación).
- Respaldo: menú `···` → exportar o importar un archivo `.json`.

## Privacidad

Las notas se guardan **solo en el teléfono** (almacenamiento local del navegador). Este repositorio contiene únicamente el código; nada de lo que se escribe en la app se sube a GitHub ni a ningún servidor.

Face ID funciona como puerta de entrada mediante una passkey (WebAuthn). Las notas no están cifradas en el dispositivo.

## Instalar en el iPhone

1. Abrir la página de GitHub Pages en **Safari**.
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrir Terapia desde el ícono y tocar **Activar Face ID** (solo la primera vez).

## Archivos

- `index.html`, `styles.css`, `app.js`: la app.
- `sw.js`: permite que funcione sin internet.
- `manifest.webmanifest`, `icons/`: instalación como app.
