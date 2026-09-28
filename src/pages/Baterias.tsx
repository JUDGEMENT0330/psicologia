// ============================================================================
// 06 · BATERÍAS
// ----------------------------------------------------------------------------
// Qué instrumentos se aplican juntos, en qué orden, con qué instrucciones y
// qué consentimiento. La psicóloga arma las suyas: una breve para tamizaje,
// otra completa para ingreso, otra para después de un incidente.
// ============================================================================

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarBaterias, cargarInstrumentos, invalidar } from '../lib/datos'
import { hojaEnBlanco } from '../lib/impresos'
import type { Bateria, Instrumento } from '../lib/tipos'
import { Alerta, Boton, Campo, Checkbox, Encabezado, EsqueletoTabla, Input, Insignia, Modal, Tarjeta, Textarea, Vacio } from '../components/ui'

export default function Baterias() {
  const avisos = useAvisos()
  const [bats, setBats] = useState<Bateria[] | null>(null)
  const [ins, setIns] = useState<Instrumento[]>([])
  const [editar, setEditar] = useState<Partial<Bateria> | null>(null)

  async function cargar() {
    invalidar('baterias')
    const [b, i] = await Promise.all([cargarBaterias(), cargarInstrumentos()])
    setBats(b)
    setIns(i)
  }
  useEffect(() => { cargar() }, [])

  const nombreIns = (c: string) => ins.find((i) => i.clave === c)
  const preguntas = (b: Bateria) => b.instrumentos.reduce((s, c) => s + (nombreIns(c)?.definicion.items.length ?? 0), 0)

  return (
    <div className="space-y-4">
      <Encabezado indice="06 / Baterías" titulo="Baterías"
        detalle="Conjuntos de instrumentos que se aplican juntos. Lo que cambie aquí vale para los enlaces nuevos y los que aún no se han respondido."
        accion={<Boton onClick={() => setEditar({ instrumentos: [], activa: true, pedir_contexto: true, mostrar_resultado: false })}>Nueva batería</Boton>} />
      {!bats ? <EsqueletoTabla filas={3} /> : bats.length === 0 ? <Tarjeta><Vacio texto="Sin baterías." /></Tarjeta> : (
        <div className="grid gap-4 md:grid-cols-2">
          {bats.map((b) => (
            <Tarjeta key={b.id} className={`flex flex-col p-4 ${b.activa ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-semibold text-tinta">{b.nombre}</h2>
                  <p className="text-[12px] text-tinta-tenue">{b.descripcion}</p>
                </div>
                {!b.activa && <Insignia>Inactiva</Insignia>}
              </div>
              <ol className="mt-3 flex-1 space-y-1 text-sm text-tinta-suave">
                {b.instrumentos.map((c, k) => <li key={c}><span className="cifras text-tinta-tenue">{k + 1}.</span> {nombreIns(c)?.nombre ?? c}</li>)}
              </ol>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                <span className="cifras mr-auto text-[12px] text-tinta-tenue">{preguntas(b)} preguntas</span>
                <Boton variante="fantasma" onClick={() => hojaEnBlanco({ bateria: b, instrumentos: ins })}>Imprimir en blanco</Boton>
                <Boton variante="secundario" onClick={() => setEditar(b)}>Editar</Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
      {editar && <Editor bat={editar} ins={ins} onCerrar={() => setEditar(null)} onGuardada={(m) => { setEditar(null); avisos.exito(m); cargar() }} />}
    </div>
  )
}

function Editor({ bat, ins, onCerrar, onGuardada }: { bat: Partial<Bateria>; ins: Instrumento[]; onCerrar: () => void; onGuardada: (m: string) => void }) {
  const [f, setF] = useState({
    nombre: bat.nombre ?? '', descripcion: bat.descripcion ?? '', instrucciones: bat.instrucciones ?? '', consentimiento: bat.consentimiento ?? '',
    instrumentos: [...(bat.instrumentos ?? [])], activa: bat.activa ?? true, pedir_contexto: bat.pedir_contexto ?? true, mostrar_resultado: bat.mostrar_resultado ?? false,
  })
  const [error, setError] = useState<string | null>(null)

  function mover(i: number, d: number) {
    const l = [...f.instrumentos]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    setF({ ...f, instrumentos: l })
  }

  async function guardar() {
    const fila = { ...f, nombre: f.nombre.trim(), descripcion: f.descripcion || null, instrucciones: f.instrucciones || null, consentimiento: f.consentimiento || null }
    const { error } = bat.id ? await supabase.from('ps_baterias').update(fila).eq('id', bat.id) : await supabase.from('ps_baterias').insert(fila)
    if (error) return setError(error.message)
    onGuardada(bat.id ? 'Batería actualizada.' : 'Batería creada.')
  }

  async function borrar() {
    if (!bat.id || !confirm('¿Eliminar la batería? Sólo se puede si nunca se aplicó; si no, desactívela.')) return
    const { error } = await supabase.from('ps_baterias').delete().eq('id', bat.id)
    if (error) return setError(/foreign key|violates/i.test(error.message) ? 'Ya se aplicó al menos una vez: desactívela en lugar de eliminarla.' : error.message)
    onGuardada('Batería eliminada.')
  }

  return (
    <Modal titulo={bat.id ? `Editar · ${bat.nombre}` : 'Nueva batería'} onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Descripción"><Input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo>
        </div>
        <div>
          <div className="rotulo mb-2 text-tinta-tenue">Instrumentos, en el orden en que se responden</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 rounded-control border border-borde p-2">
              {ins.filter((i) => i.activo).map((i) => (
                <Checkbox key={i.clave} etiqueta={`${i.nombre} (${i.definicion.items.length})`} checked={f.instrumentos.includes(i.clave)}
                  onChange={(v) => setF({ ...f, instrumentos: v ? [...f.instrumentos, i.clave] : f.instrumentos.filter((c) => c !== i.clave) })} />
              ))}
            </div>
            <ol className="space-y-1 rounded-control border border-borde p-2 text-sm">
              {f.instrumentos.length === 0 && <li className="p-2 text-tinta-tenue">Elija al menos uno.</li>}
              {f.instrumentos.map((c, k) => (
                <li key={c} className="flex items-center gap-2 rounded bg-superficie-alta/50 px-2 py-1">
                  <span className="cifras w-5 text-tinta-tenue">{k + 1}</span>
                  <span className="flex-1 truncate">{ins.find((i) => i.clave === c)?.nombre ?? c}</span>
                  <button type="button" aria-label="Subir" className="px-1 text-tinta-tenue hover:text-tinta" onClick={() => mover(k, -1)}>▲</button>
                  <button type="button" aria-label="Bajar" className="px-1 text-tinta-tenue hover:text-tinta" onClick={() => mover(k, 1)}>▼</button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Campo etiqueta="Instrucciones para quien responde"><Textarea rows={3} value={f.instrucciones} onChange={(e) => setF({ ...f, instrucciones: e.target.value })} /></Campo>
        <Campo etiqueta="Consentimiento" hint="Si se escribe, hay que aceptarlo antes de empezar. Déjelo vacío para no pedirlo.">
          <Textarea rows={3} value={f.consentimiento} onChange={(e) => setF({ ...f, consentimiento: e.target.value })} />
        </Campo>
        <div className="grid gap-1 sm:grid-cols-3">
          <Checkbox etiqueta="Pedir escolaridad, estado civil y edad" checked={f.pedir_contexto} onChange={(v) => setF({ ...f, pedir_contexto: v })} />
          <Checkbox etiqueta="Mostrar el resultado al terminar" checked={f.mostrar_resultado} onChange={(v) => setF({ ...f, mostrar_resultado: v })} />
          <Checkbox etiqueta="Activa" checked={f.activa} onChange={(v) => setF({ ...f, activa: v })} />
        </div>
        {f.mostrar_resultado && <Alerta tono="aviso">Quien responde verá la interpretación de cada escala (no los puntajes). Úselo sólo si hay devolución prevista.</Alerta>}
        {error && <Alerta>{error}</Alerta>}
        <div className="flex justify-between gap-2">
          {bat.id ? <Boton variante="fantasma" className="text-alerta" onClick={borrar}>Eliminar</Boton> : <span />}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
            <Boton onClick={guardar} disabled={!f.nombre.trim() || !f.instrumentos.length}>Guardar</Boton>
          </div>
        </div>
      </div>
    </Modal>
  )
}
