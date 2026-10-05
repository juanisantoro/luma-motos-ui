// Funciones que ya están en el código pero todavía no se muestran al usuario.
//
// CASH_OPERATIONS: Transferencias entre cajas y Retiros de socios. Apagada,
// no aparecen en el menú y sus rutas no existen. Para prenderla:
// 1. Definir VITE_CASH_OPERATIONS=true en el entorno (en Render, en las
//    variables del servicio) y volver a desplegar.
// 2. En los manuales (src/features/manual/content/*.html), quitar `hidden` de
//    los elementos con data-flag="caja-operaciones" y borrar los que tienen
//    data-flag-off="caja-operaciones". Después regenerar los manuales de Lumi
//    con scripts/sync-assistant-manuals.mjs del backend.
export const CASH_OPERATIONS_ENABLED =
  import.meta.env.VITE_CASH_OPERATIONS === 'true'
