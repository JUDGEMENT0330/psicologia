// ============================================================================
// CSV — CÓMO SE ESCRIBE UNA CELDA
// ----------------------------------------------------------------------------
// Todo lo que sale de aquí lo abre alguien en Excel, en un equipo de la S-4 con
// Windows en español. Eso decide dos cosas que estaban escritas seis veces, con
// seis criterios distintos:
//
//  1. **El entrecomillado.** Se entrecomilla SIEMPRE, no sólo cuando el valor
//     trae puntuación. Las versiones condicionales que había eran correctas,
//     pero eran seis, y cada una obligaba a razonar sobre si su lista de
//     caracteres seguía cubriendo la columna nueva. Uno incondicional no
//     obliga a razonar nada.
//  2. **La marca de orden de bytes.** Sin ella Excel no lee el archivo como
//     UTF-8 y «Acetaminofén» aparece como «AcetaminofÃ©n».
//
// ESTE ARCHIVO NO TOCA EL NAVEGADOR, y no puede hacerlo: lo importan tanto las
// pantallas como el proceso principal del escritorio, que corre en Node y cuyo
// `tsconfig` no incluye el DOM a propósito —allí no hay ventana—. La entrega
// del archivo al navegador vive en `descargas.ts`, que sí es del navegador.
//
// La LECTURA del CSV —que es otro problema, con sus sinónimos de encabezado y
// sus fechas— vive en `padron.ts`. Aquí sólo se escribe.
// ============================================================================

/** Lo que cabe en una celda. El nulo y el indefinido salen vacíos, no «null». */
export type Celda = string | number | boolean | null | undefined

/**
 * Marca de orden de bytes. Es lo único que hace que Excel acierte con las
 * tildes, y va tanto en la descarga del navegador como en el archivo que el
 * escritorio escribe en el disco.
 */
export const BOM = '﻿'

const entrecomillar = (v: Celda) => `"${String(v ?? '').replace(/"/g, '""')}"`

/**
 * Las filas ya en texto. `separador` sólo se cambia donde la pantalla lo
 * necesita —el panel del paciente sale en dos columnas con punto y coma—.
 */
export function aCsv(cabecera: readonly Celda[], filas: readonly Celda[][], separador = ','): string {
  return [cabecera, ...filas].map((f) => f.map(entrecomillar).join(separador)).join('\n')
}

/**
 * La misma tabla, pero cuando las filas son registros y las columnas se eligen
 * por nombre. Es la forma en la que salen de una consulta a la base.
 */
export function aCsvDeRegistros(
  columnas: readonly string[],
  filas: readonly Record<string, Celda>[],
  separador = ',',
): string {
  return aCsv(columnas, filas.map((f) => columnas.map((c) => f[c])), separador)
}
