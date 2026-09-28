// ============================================================================
// LÍMITE DE ERROR
// ----------------------------------------------------------------------------
// Un fallo de una pantalla no puede dejar la aplicación en blanco con el
// paciente en el sillón. El límite atrapa el error, deja el resto de la
// aplicación en pie —la barra lateral sigue navegando— y da dos salidas:
// reintentar la misma pantalla o volver al tablero.
//
// El detalle técnico no se esconde: se copia al portapapeles de un botón, que
// es la única forma realista de que un error de un equipo del destacamento
// llegue a quien puede corregirlo.
// ============================================================================

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Cambiar este valor rearma el límite: se usa con la ruta activa. */
  llave?: string
}

interface Estado {
  error: Error | null
  pila: string | null
  copiado: boolean
  /** Última ruta vista, para saber cuándo hay que rearmar. */
  llave: string | undefined
}

export default class Limite extends Component<Props, Estado> {
  state: Estado = { error: null, pila: null, copiado: false, llave: this.props.llave }

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error }
  }

  // Al cambiar de sección se vuelve a intentar por sí solo: quedarse en la
  // pantalla de error después de pulsar otra sección no tendría sentido. Se
  // resuelve al derivar el estado y no después de pintar, para no encadenar
  // un segundo render por cada navegación.
  static getDerivedStateFromProps(props: Props, estado: Estado): Partial<Estado> | null {
    if (props.llave === estado.llave) return null
    return estado.error
      ? { error: null, pila: null, copiado: false, llave: props.llave }
      : { llave: props.llave }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ pila: info.componentStack ?? null })
    console.error('[DM-1] fallo en la interfaz', error, info.componentStack)
  }

  private informe() {
    const { error, pila } = this.state
    return [
      `Psicología DM-1 — informe de fallo`,
      `Fecha: ${new Date().toISOString()}`,
      `Ruta: ${typeof location !== 'undefined' ? location.hash || location.pathname : '—'}`,
      `Versión: ${__VERSION_APP__}`,
      ``,
      `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      error?.stack ?? '',
      pila ?? '',
    ].join('\n')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="aparece mx-auto max-w-2xl py-10">
        <div className="folio mb-3 flex items-center justify-between border-b border-borde pb-2">
          <span>Destacamento Militar N° 1 · Psicología</span>
          <span>Fallo de la interfaz</span>
        </div>

        <div className="cifras rotulo mb-2 text-alerta">Error</div>
        <h1 className="titular titular-pagina mb-4 text-tinta">Esta pantalla no se pudo dibujar</h1>
        <div aria-hidden className="regla-doble mb-5" />

        <p className="mb-4 max-w-prose text-sm leading-relaxed text-tinta-suave">
          El resto de la aplicación sigue en funcionamiento y{' '}
          <strong className="font-medium text-tinta">no se ha perdido ningún dato guardado</strong>: el fallo
          está en cómo se está mostrando la información, no en el expediente. Lo que estuviera a medio escribir
          en un formulario sí se perdió.
        </p>

        <pre className="cifras mb-5 max-h-40 overflow-auto border border-borde border-l-2 border-l-alerta bg-superficie p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-tinta-suave">
          {this.state.error.message || 'Error sin descripción.'}
        </pre>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null, pila: null, copiado: false })}
            className="inline-flex min-h-11 items-center border border-marca bg-marca px-4 text-sm font-medium text-fondo transition-colors hover:bg-marca-fuerte"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => {
              location.assign('/')
            }}
            className="inline-flex min-h-11 items-center border border-borde bg-superficie-alta px-4 text-sm font-medium text-tinta transition-colors hover:bg-borde"
          >
            Volver al tablero
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(this.informe()).then(
                () => this.setState({ copiado: true }),
                () => this.setState({ copiado: false }),
              )
            }}
            className="inline-flex min-h-11 items-center border border-borde px-4 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alta hover:text-tinta"
          >
            {this.state.copiado ? 'Informe copiado' : 'Copiar informe del fallo'}
          </button>
        </div>

        <p className="folio mt-8 border-t border-borde pt-3">Versión {__VERSION_APP__}</p>
      </div>
    )
  }
}
