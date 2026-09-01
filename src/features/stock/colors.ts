// Colors for physical inventory units used to be a hardcoded list here too,
// duplicated by hand against src/inventory/inventory.dto.ts on the backend.
// They now live in the colores_unidad table and are fetched through
// listUnitColors() (see api.ts) instead - see the
// 20260831000000_unit_colors_catalog migration on the backend.
//
// Finishes stay a small fixed list: the business only asked for colors to
// be editable without a deploy.
export const UNIT_FINISHES = [
  'Brillante',
  'Mate',
  'Metalizado',
  'Perlado',
  'Flúor',
] as const

export type UnitFinish = (typeof UNIT_FINISHES)[number]
