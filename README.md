# Luma Motos UI

Frontend administrativo de Luma Motos construido con React, TypeScript y Vite.

## Desarrollo

1. Copiar `.env.example` a `.env.local`.
2. Configurar el backend con `FRONTEND_URL=http://localhost:5173`.
3. Ejecutar `npm install` y `npm run dev`.

La autenticación usa un token Bearer emitido por la API. El token se conserva en
`sessionStorage`, por lo que la sesión se restaura al recargar la pestaña y se
descarta al cerrarla.

## Scripts

- `npm run dev`: servidor local.
- `npm run typecheck`: validación estricta de TypeScript.
- `npm run lint`: análisis estático.
- `npm test`: pruebas focalizadas.
- `npm run build`: build de producción.

## API

`VITE_API_URL` debe apuntar al prefijo completo de la API, por ejemplo
`http://localhost:3000/api`. No debe contener credenciales ni secretos.
