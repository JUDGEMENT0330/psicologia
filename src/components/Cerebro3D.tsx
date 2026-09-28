// ============================================================================
// CEREBRO 3D — las áreas asociadas a los problemas identificados
// ----------------------------------------------------------------------------
// Malla del atlas AAL (116 áreas). Cada área se tiñe según su «peso»: cuántos
// hallazgos, y de qué gravedad, la involucran. La corteza puede hacerse
// translúcida para ver amígdala, hipocampo, tálamo y ganglios basales, que
// viven debajo.
//
// Se usa en tres sitios con los mismos datos de entrada:
//   · la ficha de una persona (sus hallazgos),
//   · el tablero de la psicóloga (todos),
//   · las estadísticas de la S-4 y el Comandante (agregado, sin nombres).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { cargarMalla, nombreRegion, PROFUNDAS, type MallaAAL } from '../lib/cerebro'
import { useTema } from '../lib/tema'
import { useMovimientoReducido } from './GraficoVidrio'
import { Cargando } from './ui'
import { Segmentado } from './Vidrio'

export interface ProblemaEnMapa {
  clave: string
  nombre: string
  color: string
  regiones: number[]
  explicacion?: string | null
}

type Vista = 'izquierda' | 'derecha' | 'frontal' | 'superior' | 'posterior' | 'inferior'

const VISTAS: { v: Vista; t: string }[] = [
  { v: 'izquierda', t: 'Izq.' },
  { v: 'frontal', t: 'Frente' },
  { v: 'derecha', t: 'Der.' },
  { v: 'superior', t: 'Arriba' },
  { v: 'posterior', t: 'Atrás' },
  { v: 'inferior', t: 'Abajo' },
]

const DIRECCION: Record<Vista, [number, number, number]> = {
  izquierda: [-1, 0.12, 0],
  derecha: [1, 0.12, 0],
  frontal: [0, 0.15, -1],
  posterior: [0, 0.15, 1],
  superior: [0, 1, 0.001],
  inferior: [0, -1, 0.001],
}

/** Escala de calor: base → ámbar → rojo. */
const CALOR = [new THREE.Color('#f2c14e'), new THREE.Color('#e07b24'), new THREE.Color('#c3281c')]

function colorCalor(t: number, base: THREE.Color): THREE.Color {
  if (t <= 0) return base.clone()
  const c = t < 0.5
    ? CALOR[0].clone().lerp(CALOR[1], t / 0.5)
    : CALOR[1].clone().lerp(CALOR[2], (t - 0.5) / 0.5)
  // Un peso mínimo ya se distingue de la base, pero sin saltar al ámbar pleno.
  return base.clone().lerp(c, 0.35 + 0.65 * Math.min(1, t * 1.6))
}

export default function Cerebro3D({
  pesos,
  problemas = [],
  alto = 420,
  resaltar,
  pie,
}: {
  /** Área AAL → peso (≥ 0). Se normaliza sobre el máximo. */
  pesos: Record<number, number>
  /** Para explicar, al señalar un área, qué problemas la involucran. */
  problemas?: ProblemaEnMapa[]
  alto?: number
  /** Si se indica, sólo se tiñen las áreas de ese problema, con su color. */
  resaltar?: string | null
  pie?: React.ReactNode
}) {
  const lienzo = useRef<HTMLDivElement>(null)
  const escena = useRef<Escena | null>(null)
  const [malla, setMalla] = useState<MallaAAL | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('izquierda')
  const [opacidad, setOpacidad] = useState(1)
  const [senalada, setSenalada] = useState<number | null>(null)
  const [fija, setFija] = useState<number | null>(null)
  const { tema } = useTema()
  const reducido = useMovimientoReducido()

  useEffect(() => {
    let vivo = true
    cargarMalla().then((m) => vivo && setMalla(m)).catch((e) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [])

  // Colores por área: calor normalizado o, con un problema resaltado, su color.
  const colores = useMemo(() => {
    const base = new THREE.Color(tema === 'claro' ? '#d8d1c4' : '#4a4f4b')
    const out = new Map<number, THREE.Color>()
    const foco = resaltar ? problemas.find((p) => p.clave === resaltar) : null
    if (foco) {
      const c = new THREE.Color(foco.color)
      for (let id = 1; id <= 116; id++) out.set(id, foco.regiones.includes(id) ? base.clone().lerp(c, 0.85) : base)
      return out
    }
    const max = Math.max(0, ...Object.values(pesos))
    for (let id = 1; id <= 116; id++) out.set(id, colorCalor(max ? (pesos[id] ?? 0) / max : 0, base))
    return out
  }, [pesos, resaltar, problemas, tema])

  // Montaje de la escena: una vez por malla.
  useEffect(() => {
    if (!malla || !lienzo.current) return
    const e = new Escena(lienzo.current, malla, (id) => setSenalada(id), (id) => setFija((f) => (f === id ? null : id)))
    escena.current = e
    return () => {
      e.destruir()
      escena.current = null
    }
  }, [malla])

  useEffect(() => { escena.current?.pintar(colores) }, [colores, malla])
  useEffect(() => { escena.current?.opacidadCorteza(opacidad) }, [opacidad, malla])
  useEffect(() => { escena.current?.mirar(vista, !reducido) }, [vista, malla, reducido])

  const activa = fija ?? senalada
  const deArea = activa ? problemas.filter((p) => p.regiones.includes(activa)) : []
  const max = Math.max(0, ...Object.values(pesos))

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-control border border-borde bg-superficie-alta/40" style={{ height: alto }}>
        <div ref={lienzo} className="absolute inset-0 touch-none" aria-label="Modelo 3D del cerebro con las áreas asociadas a los hallazgos" role="img" />
        {!malla && !error && <div className="absolute inset-0 flex items-center justify-center"><Cargando texto="Cargando modelo cerebral…" /></div>}
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-alerta">{error}</div>}

        {activa && (
          <div className="vidrio-grueso pointer-events-none absolute top-3 left-3 max-w-[min(22rem,calc(100%-1.5rem))] rounded-control p-3 text-[12px] leading-snug shadow-lg">
            <div className="font-semibold text-tinta">{nombreRegion(activa)}</div>
            {!resaltar && max > 0 && (
              <div className="cifras mt-0.5 text-tinta-tenue">Peso {pesos[activa] ?? 0} de {max}</div>
            )}
            {deArea.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {deArea.map((p) => (
                  <li key={p.clave} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="text-tinta-suave">{p.nombre}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-tinta-tenue">Sin problemas asociados en este mapa.</div>
            )}
            {fija && <div className="mt-2 text-[11px] text-tinta-tenue">Fijada · toque de nuevo para soltarla</div>}
          </div>
        )}

        {!resaltar && max > 0 && (
          <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 text-[10px] text-tinta-tenue">
            <span>menos</span>
            <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#f2c14e,#e07b24,#c3281c)' }} />
            <span>más</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[16rem] flex-1">
          <Segmentado etiqueta="Vista del cerebro" valor={vista} onCambiar={setVista} opciones={VISTAS} />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-tinta-tenue">
          Corteza
          <input
            type="range" min={0.15} max={1} step={0.05} value={opacidad}
            onChange={(e) => setOpacidad(Number(e.target.value))}
            className="w-28 accent-marca"
            aria-label="Opacidad de la corteza: bájela para ver amígdala, hipocampo, tálamo y ganglios basales"
          />
        </label>
      </div>
      {pie}
      <p className="text-[11px] leading-relaxed text-tinta-tenue">
        Áreas del atlas AAL asociadas en la literatura a los problemas identificados. Orientativo, para explicar
        resultados: no es un estudio de neuroimagen. Arrastre para girar, rueda o pellizco para acercar; baje la
        corteza para ver las estructuras profundas.
      </p>
    </div>
  )
}

/* ================================================================ escena === */

class Escena {
  private renderer: THREE.WebGLRenderer
  private camara: THREE.PerspectiveCamera
  private escena = new THREE.Scene()
  private controles: OrbitControls
  private corteza: THREE.Mesh
  private profundas: THREE.Mesh
  private regionPorVertice: Uint8Array
  private raf = 0
  private anim: { desde: THREE.Vector3; hasta: THREE.Vector3; t0: number } | null = null
  private ro: ResizeObserver
  private rayo = new THREE.Raycaster()
  private contenedor: HTMLElement
  private alSenalar: (id: number | null) => void
  private alFijar: (id: number) => void
  private abajo: { x: number; y: number } | null = null
  private radio = 340

  constructor(contenedor: HTMLElement, m: MallaAAL, alSenalar: (id: number | null) => void, alFijar: (id: number) => void) {
    this.contenedor = contenedor
    this.alSenalar = alSenalar
    this.alFijar = alFijar
    this.regionPorVertice = m.region

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    contenedor.appendChild(this.renderer.domElement)

    this.camara = new THREE.PerspectiveCamera(32, 1, 1, 3000)

    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x6b6257, 1.6))
    const luz = new THREE.DirectionalLight(0xffffff, 1.6)
    luz.position.set(-1, 2, 1.5)
    this.camara.add(luz)
    this.escena.add(this.camara)

    const [corteza, profundas] = this.geometrias(m)
    this.corteza = new THREE.Mesh(corteza, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.62, metalness: 0.02, transparent: true, opacity: 1,
    }))
    this.profundas = new THREE.Mesh(profundas, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.5, metalness: 0.02,
    }))
    this.corteza.renderOrder = 2
    this.escena.add(this.profundas, this.corteza)

    // Encuadre a partir de la malla real: centro de su esfera envolvente y una
    // distancia que la deja entera en pantalla con el campo de visión elegido.
    corteza.computeBoundingSphere()
    const esfera = corteza.boundingSphere!
    const ajuste = esfera.radius / Math.sin(THREE.MathUtils.degToRad(this.camara.fov / 2))
    this.radio = ajuste * 0.82
    this.controles = new OrbitControls(this.camara, this.renderer.domElement)
    this.controles.enableDamping = true
    this.controles.enablePan = false
    this.controles.minDistance = esfera.radius * 1.3
    this.controles.maxDistance = ajuste * 1.8
    this.controles.target.copy(esfera.center)
    this.camara.position.copy(esfera.center).add(new THREE.Vector3(-this.radio, this.radio * 0.12, 0))

    this.ro = new ResizeObserver(() => this.medir())
    this.ro.observe(contenedor)
    this.medir()

    const el = this.renderer.domElement
    el.addEventListener('pointermove', this.mover)
    el.addEventListener('pointerleave', this.salir)
    el.addEventListener('pointerdown', this.bajar)
    el.addEventListener('pointerup', this.subir)
    this.bucle()
  }

  /** Separa la corteza de las estructuras profundas y calcula las normales. */
  private geometrias(m: MallaAAL): [THREE.BufferGeometry, THREE.BufferGeometry] {
    const hacer = (profunda: boolean) => {
      const idx: number[] = []
      for (let f = 0; f < m.indices.length; f += 3) {
        if (PROFUNDAS.has(m.region[m.indices[f]]) === profunda) idx.push(m.indices[f], m.indices[f + 1], m.indices[f + 2])
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(m.posiciones, 3))
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(m.posiciones.length), 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }
    return [hacer(false), hacer(true)]
  }

  pintar(colores: Map<number, THREE.Color>) {
    for (const malla of [this.corteza, this.profundas]) {
      const attr = malla.geometry.getAttribute('color') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      for (let i = 0; i < this.regionPorVertice.length; i++) {
        const c = colores.get(this.regionPorVertice[i])
        if (!c) continue
        arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
      }
      attr.needsUpdate = true
    }
  }

  opacidadCorteza(o: number) {
    const mat = this.corteza.material as THREE.MeshStandardMaterial
    mat.opacity = o
    // Opaca escribe profundidad (se ve bien); translúcida no, para que las
    // estructuras de debajo no queden tapadas por su propia sombra.
    mat.depthWrite = o >= 0.99
    mat.needsUpdate = true
  }

  mirar(v: Vista, animado: boolean) {
    const [x, y, z] = DIRECCION[v]
    const hasta = new THREE.Vector3(x, y, z).normalize().multiplyScalar(this.camara.position.distanceTo(this.controles.target) || this.radio)
      .add(this.controles.target)
    if (!animado) {
      this.camara.position.copy(hasta)
      this.anim = null
      return
    }
    this.anim = { desde: this.camara.position.clone(), hasta, t0: performance.now() }
  }

  private medir() {
    const w = this.contenedor.clientWidth || 1
    const h = this.contenedor.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camara.aspect = w / h
    this.camara.updateProjectionMatrix()
  }

  private bucle = () => {
    this.raf = requestAnimationFrame(this.bucle)
    if (this.anim) {
      const p = Math.min(1, (performance.now() - this.anim.t0) / 650)
      const e = 1 - Math.pow(1 - p, 3)
      // Interpolación esférica alrededor del objetivo: la cámara orbita, no atraviesa el cerebro.
      const t = this.controles.target
      const a = this.anim.desde.clone().sub(t)
      const b = this.anim.hasta.clone().sub(t)
      const r = THREE.MathUtils.lerp(a.length(), b.length(), e)
      const dir = a.normalize().lerp(b.normalize(), e)
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0)
      this.camara.position.copy(t).add(dir.normalize().multiplyScalar(r))
      if (p >= 1) this.anim = null
    }
    this.controles.update()
    this.renderer.render(this.escena, this.camara)
  }

  private regionEn(ev: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    this.rayo.setFromCamera(p, this.camara)
    const opaca = (this.corteza.material as THREE.MeshStandardMaterial).opacity >= 0.6
    const objetivos = opaca ? [this.corteza, this.profundas] : [this.profundas, this.corteza]
    for (const o of objetivos) {
      const hit = this.rayo.intersectObject(o, false)[0]
      if (hit?.face) return this.regionPorVertice[hit.face.a] || null
    }
    return null
  }

  private mover = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') return
    this.alSenalar(this.regionEn(ev))
  }

  private salir = () => this.alSenalar(null)

  private bajar = (ev: PointerEvent) => { this.abajo = { x: ev.clientX, y: ev.clientY } }

  /** Un toque sin arrastre fija el área; un arrastre sólo gira. */
  private subir = (ev: PointerEvent) => {
    if (!this.abajo) return
    const quieto = Math.hypot(ev.clientX - this.abajo.x, ev.clientY - this.abajo.y) < 6
    this.abajo = null
    if (!quieto) return
    const id = this.regionEn(ev)
    if (id) this.alFijar(id)
  }

  destruir() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.mover)
    el.removeEventListener('pointerleave', this.salir)
    el.removeEventListener('pointerdown', this.bajar)
    el.removeEventListener('pointerup', this.subir)
    this.controles.dispose()
    for (const m of [this.corteza, this.profundas]) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.renderer.dispose()
    el.remove()
  }
}
