// ============================================================================
// CEREBRO — atlas AAL, nombres en español y cargador de la malla
// ----------------------------------------------------------------------------
// La malla (`public/cerebro/aal.bin`) son las 116 áreas del atlas AAL
// (Tzourio-Mazoyer et al., 2002) en espacio MNI, cada una como superficie
// cerrada. La genera `herramientas/cerebro/construir.py` a partir de la malla
// de NiiVue (BSD-2). Procedencia completa en docs/CREDITOS.md.
//
// El mapa colorea cada área según los problemas identificados que la
// literatura asocia con ella (tabla `ps_problemas`). Es una ayuda para leer y
// explicar los resultados, NO un hallazgo de neuroimagen: nadie ha medido la
// actividad cerebral de nadie.
// ============================================================================

/** Nombre base (sin hemisferio) de las áreas, en el orden del atlas. */
const BASE: [string, string][] = [
  ['Precentral', 'Giro precentral (motor primario)'],
  ['Frontal_Sup', 'Giro frontal superior (dorsolateral)'],
  ['Frontal_Sup_Orb', 'Frontal superior, porción orbitaria'],
  ['Frontal_Mid', 'Giro frontal medio (prefrontal dorsolateral)'],
  ['Frontal_Mid_Orb', 'Frontal medio, porción orbitaria'],
  ['Frontal_Inf_Oper', 'Frontal inferior, porción opercular'],
  ['Frontal_Inf_Tri', 'Frontal inferior, porción triangular'],
  ['Frontal_Inf_Orb', 'Frontal inferior, porción orbitaria'],
  ['Rolandic_Oper', 'Opérculo rolándico'],
  ['Supp_Motor_Area', 'Área motora suplementaria'],
  ['Olfactory', 'Corteza olfatoria'],
  ['Frontal_Sup_Medial', 'Frontal superior medial (prefrontal medial)'],
  ['Frontal_Med_Orb', 'Orbitofrontal medial (ventromedial)'],
  ['Rectus', 'Giro recto'],
  ['Insula', 'Ínsula'],
  ['Cingulum_Ant', 'Cíngulo anterior'],
  ['Cingulum_Mid', 'Cíngulo medio'],
  ['Cingulum_Post', 'Cíngulo posterior'],
  ['Hippocampus', 'Hipocampo'],
  ['ParaHippocampal', 'Giro parahipocampal'],
  ['Amygdala', 'Amígdala'],
  ['Calcarine', 'Cisura calcarina (visual primaria)'],
  ['Cuneus', 'Cúneo'],
  ['Lingual', 'Giro lingual'],
  ['Occipital_Sup', 'Occipital superior'],
  ['Occipital_Mid', 'Occipital medio'],
  ['Occipital_Inf', 'Occipital inferior'],
  ['Fusiform', 'Giro fusiforme'],
  ['Postcentral', 'Giro poscentral (somatosensorial)'],
  ['Parietal_Sup', 'Parietal superior'],
  ['Parietal_Inf', 'Parietal inferior'],
  ['SupraMarginal', 'Giro supramarginal'],
  ['Angular', 'Giro angular'],
  ['Precuneus', 'Precúneo'],
  ['Paracentral_Lobule', 'Lobulillo paracentral'],
  ['Caudate', 'Núcleo caudado'],
  ['Putamen', 'Putamen'],
  ['Pallidum', 'Globo pálido'],
  ['Thalamus', 'Tálamo'],
  ['Heschl', 'Giro de Heschl (auditivo primario)'],
  ['Temporal_Sup', 'Temporal superior'],
  ['Temporal_Pole_Sup', 'Polo temporal superior'],
  ['Temporal_Mid', 'Temporal medio'],
  ['Temporal_Pole_Mid', 'Polo temporal medio'],
  ['Temporal_Inf', 'Temporal inferior'],
]

const CEREBELO = ['Crus I', 'Crus II', 'III', 'IV-V', 'VI', 'VII b', 'VIII', 'IX', 'X']
const VERMIS = ['I-II', 'III', 'IV-V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** Nombre en español del área AAL 1–116. */
export function nombreRegion(id: number): string {
  if (id >= 1 && id <= 90) {
    const [, nombre] = BASE[Math.floor((id - 1) / 2)]
    return `${nombre} · ${id % 2 ? 'izquierdo' : 'derecho'}`
  }
  if (id >= 91 && id <= 108) {
    const i = id - 91
    return `Cerebelo ${CEREBELO[Math.floor(i / 2)]} · ${i % 2 ? 'derecho' : 'izquierdo'}`
  }
  if (id >= 109 && id <= 116) return `Vermis cerebeloso ${VERMIS[id - 109]}`
  return `Área ${id}`
}

/** Grupos para el editor de regiones: se eligen pares, no 116 casillas sueltas. */
export const GRUPOS_REGIONES: { nombre: string; regiones: number[] }[] = [
  ...BASE.map(([, nombre], i) => ({ nombre, regiones: [i * 2 + 1, i * 2 + 2] })),
  { nombre: 'Hemisferios cerebelosos', regiones: Array.from({ length: 18 }, (_, i) => 91 + i) },
  { nombre: 'Vermis cerebeloso', regiones: Array.from({ length: 8 }, (_, i) => 109 + i) },
]

/**
 * Estructuras profundas: quedan escondidas bajo la corteza y se dibujan en
 * una malla aparte, opaca, para que se vean al hacer translúcida la corteza.
 */
export const PROFUNDAS = new Set([37, 38, 41, 42, 71, 72, 73, 74, 75, 76, 77, 78])

export interface MallaAAL {
  posiciones: Float32Array
  region: Uint8Array
  indices: Uint32Array
}

let cache: Promise<MallaAAL> | null = null

/** Descarga y decodifica `aal.bin` (una sola vez por sesión). */
export function cargarMalla(): Promise<MallaAAL> {
  if (!cache) {
    cache = fetch('/cerebro/aal.bin')
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo descargar la malla cerebral (${r.status}).`)
        return r.arrayBuffer()
      })
      .then(decodificar)
    cache.catch(() => { cache = null })
  }
  return cache
}

function decodificar(buf: ArrayBuffer): MallaAAL {
  const vista = new DataView(buf)
  const magia = String.fromCharCode(...new Uint8Array(buf, 0, 4))
  if (magia !== 'AAL1') throw new Error('La malla cerebral no tiene el formato esperado.')
  const nv = vista.getUint32(4, true)
  const nf = vista.getUint32(8, true)
  const escala = vista.getFloat32(12, true)
  let o = 16
  const q = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6
  const region = new Uint8Array(buf.slice(o, o + nv)); o += nv
  o += (4 - (o % 4)) % 4
  const indices = new Uint32Array(buf.slice(o, o + nf * 12))
  const posiciones = new Float32Array(nv * 3)
  // MNI (x derecha, y anterior, z superior) → three.js (x derecha, y arriba,
  // z hacia el observador): un giro de −90° sobre X, no un intercambio de ejes,
  // que reflejaría el cerebro y cambiaría izquierda por derecha. La frente
  // queda mirando hacia −z.
  for (let i = 0; i < nv; i++) {
    posiciones[i * 3] = q[i * 3] * escala
    posiciones[i * 3 + 1] = q[i * 3 + 2] * escala
    posiciones[i * 3 + 2] = -q[i * 3 + 1] * escala
  }
  return { posiciones, region, indices }
}
