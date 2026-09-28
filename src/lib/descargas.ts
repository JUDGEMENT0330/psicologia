// ============================================================================
// DESCARGAS — LA ENTREGA DEL ARCHIVO AL NAVEGADOR
// ----------------------------------------------------------------------------
// Separado de `csv.ts` a propósito, y no por gusto de dividir: `csv.ts` lo
// importa también el proceso principal del escritorio, que corre en Node, no
// tiene ventana y cuyo `tsconfig` excluye el DOM. Mezclar el formato con la
// entrega hacía que un `document.createElement` acabara compilándose contra un
// entorno donde `document` no existe.
//
// Aquí, en cambio, todo es del navegador y puede serlo sin disimulo.
// ============================================================================

import { aCsv, BOM, type Celda } from './csv'

/**
 * Entrega un archivo de texto al navegador.
 *
 * La dirección temporal se libera en el siguiente ciclo y no en la misma
 * línea: revocarla antes de que el navegador haya empezado la descarga la
 * cancela en algunos equipos, y el fallo no avisa —simplemente no baja nada—.
 */
export function descargarTexto(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.rel = 'noopener'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Un CSV, con su marca de orden de bytes para que Excel lea las tildes. */
export function descargarCsv(nombre: string, csv: string) {
  descargarTexto(nombre.endsWith('.csv') ? nombre : `${nombre}.csv`, BOM + csv)
}

/**
 * El caso corriente: cabecera, filas y nombre con la fecha del día. La fecha va
 * en el nombre porque en la práctica se exporta el mismo listado varias veces y
 * en la carpeta de descargas hay que poder distinguir cuál es el de hoy.
 */
export function exportar(
  base: string,
  cabecera: readonly Celda[],
  filas: readonly Celda[][],
  separador?: string,
) {
  descargarCsv(`${base}_${new Date().toISOString().slice(0, 10)}.csv`, aCsv(cabecera, filas, separador))
}
