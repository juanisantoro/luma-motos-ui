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

## Manual de uso por perfil

La pantalla `/manual` ("Manual de uso", al final del menú) muestra el manual
del rol del usuario. Cada manual es un HTML autónomo en
`src/features/manual/content/<rol>.html`, registrado por código de rol en
`src/features/manual/manuals.ts`; se carga bajo demanda y sólo con sesión
iniciada. Un rol sin manual ve un aviso. Al cambiar una pantalla, actualizá el
manual de los perfiles que la usan en el mismo cambio.

## API

`VITE_API_URL` debe apuntar al prefijo completo de la API, por ejemplo
`http://localhost:3000/api`. No debe contener credenciales ni secretos.
