// ============================================================================
// ENLACES — crear una aplicación y compartir su enlace
// ============================================================================

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarBaterias } from '../lib/datos'
import { TIPOS_EVALUACION, enlaceEvaluacion, hoy, sumarDias } from '../lib/formato'
import type { Aplicacion, Bateria, PacienteBreve, TipoEvaluacion } from '../lib/tipos'
import { Alerta, Boton, Campo, Input, Modal, Select } from './ui'

/** El enlace con sus tres salidas: copiar, WhatsApp y QR. */
export function CompartirEnlace({ token, nombre, compacto }: { token: string; nombre?: string; compacto?: boolean }) {
  const avisos = useAvisos()
  const url = enlaceEvaluacion(token)
  const [qr, setQr] = useState<string | null>(null)
  const texto = `${nombre ? `${nombre}: ` : ''}Psicología del DM-1 le envía una evaluación. Ábrala en este enlace personal y respóndala con calma: ${url}`

  useEffect(() => {
    if (compacto) return
    QRCode.toDataURL(url, { margin: 1, width: 280 }).then(setQr).catch(() => setQr(null))
  }, [url, compacto])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      avisos.exito('Enlace copiado.')
    } catch {
      avisos.error('No se pudo copiar. Seleccione el enlace y cópielo a mano.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()}
          className="cifras min-h-11 w-full min-w-0 rounded-control border border-borde bg-superficie-alta/50 px-3 text-[12px] text-tinta" />
        <Boton variante="secundario" onClick={copiar}>Copiar</Boton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"
          className="pulsable inline-flex min-h-11 items-center gap-2 rounded-pastilla border border-borde bg-superficie-alta px-4 text-sm font-medium text-tinta hover:bg-borde">
          Enviar por WhatsApp
        </a>
        {'share' in navigator && (
          <Boton variante="fantasma" onClick={() => navigator.share({ title: 'Evaluación psicológica', text: texto }).catch(() => {})}>Compartir…</Boton>
        )}
      </div>
      {qr && !compacto && (
        <div className="flex items-center gap-4">
          <img src={qr} alt="Código QR del enlace" className="h-36 w-36 rounded-control border border-borde bg-white p-1" />
          <p className="text-[12px] leading-relaxed text-tinta-tenue">Para quien está delante: que apunte la cámara del teléfono al código.
            El enlace es personal; no lo reenvíe a otra persona.</p>
        </div>
      )}
    </div>
  )
}

/** Crea una aplicación individual (fuera de convocatoria) para una persona. */
export function ModalNuevaAplicacion({ paciente, onCerrar, onCreada }: {
  paciente: PacienteBreve
  onCerrar: () => void
  onCreada: (ap: Aplicacion, modo: 'enlace' | 'presencial') => void
}) {
  const [baterias, setBaterias] = useState<Bateria[]>([])
  const [bateria, setBateria] = useState('')
  const [tipo, setTipo] = useState<TipoEvaluacion>('seguimiento')
  const [modo, setModo] = useState<'enlace' | 'presencial'>('enlace')
  const [vence, setVence] = useState(sumarDias(hoy(), 7))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarBaterias().then((b) => {
      const activas = b.filter((x) => x.activa)
      setBaterias(activas)
      setBateria((v) => v || activas[0]?.id || '')
    })
  }, [])

  async function crear() {
    setGuardando(true)
    setError(null)
    const { data, error } = await supabase.from('ps_aplicaciones').insert({
      bateria_id: bateria, paciente_id: paciente.id, tipo,
      origen: modo === 'presencial' ? 'presencial' : 'individual',
      vence_en: modo === 'enlace' && vence ? `${vence}T23:59:59` : null,
    }).select('*').single()
    setGuardando(false)
    if (error) return setError(error.message)
    onCreada(data as Aplicacion, modo)
  }

  return (
    <Modal titulo={`Nueva evaluación · ${paciente.nombre_completo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Batería">
          <Select value={bateria} onChange={(e) => setBateria(e.target.value)}>
            {baterias.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </Select>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo de evaluación">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvaluacion)}>
              {Object.entries(TIPOS_EVALUACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Campo>
          <Campo etiqueta="Cómo se aplica">
            <Select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
              <option value="enlace">Por enlace (teléfono)</option>
              <option value="presencial">En papel, la transcribo yo</option>
            </Select>
          </Campo>
        </div>
        {modo === 'enlace' && (
          <Campo etiqueta="El enlace vence" hint="Pasada esta fecha el enlace deja de abrir.">
            <Input type="date" value={vence} min={hoy()} onChange={(e) => setVence(e.target.value)} />
          </Campo>
        )}
        {error && <Alerta>{error}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={crear} disabled={!bateria || guardando}>{guardando ? 'Creando…' : modo === 'enlace' ? 'Crear enlace' : 'Crear y capturar'}</Boton>
        </div>
      </div>
    </Modal>
  )
}
