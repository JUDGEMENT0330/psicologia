# Formato de un instrumento

Cada fila de `ps_instrumentos` guarda en `definicion` todo lo necesario para
aplicar y calificar el cuestionario. La psicóloga lo edita desde
**Instrumentos → (instrumento)**; el apartado «Avanzado» muestra este mismo
JSON. Lo interpreta `ps_calificar_instrumento()` en la base
(`supabase/migraciones/31_psicologia.sql`).

```jsonc
{
  // Alternativas comunes. «valor» es lo que suma.
  "opciones": [{ "valor": 0, "texto": "En absoluto" }, { "valor": 1, "texto": "Levemente" }],

  "items": [
    { "n": 1, "texto": "Torpe o entumecido" },
    // Un ítem con alternativas propias (BDI-II): «rotulo» es lo que se imprime.
    { "n": 16, "texto": "Cambios en los hábitos de sueño", "opciones": [
      { "valor": 0, "rotulo": "0",  "texto": "No he experimentado…" },
      { "valor": 1, "rotulo": "1a", "texto": "Duermo un poco más…" },
      { "valor": 1, "rotulo": "1b", "texto": "Duermo un poco menos…" } ] }
  ],

  // Se calculan en orden: una escala puede sumar otra anterior (corrección K).
  "escalas": [
    {
      "clave": "total", "nombre": "Ansiedad",
      "items": "todos",                  // o [1, 2, 5]
      "invertidos": [2, 5],              // mín + máx − valor (Likert)
      "usa": "bruta",                    // o "t": los cortes se aplican sobre T
      "rangos": [
        { "desde": 0,  "hasta": 7,  "nivel": "normal",   "etiqueta": "Ansiedad mínima" },
        { "desde": 8,  "hasta": 15, "nivel": "leve",     "etiqueta": "Ansiedad leve", "problema": "ansiedad" }
      ]
    },
    {
      // Escala Verdadero/Falso (Mini-Mult): suma 1 por cada ítem en su clave.
      "clave": "Hs", "nombre": "1 · Hs Hipocondría",
      "clave_v": [9, 18, 26], "clave_f": [1, 2, 6],
      "suma_k": { "escala": "K", "factor": 0.5, "redondeo": "techo" },
      "t": { "media": 7.24, "de": 3 },   // T = 50 + 10·(bruta − media)/de
      "usa": "t",
      "rangos": [{ "desde": 70, "nivel": "moderado", "etiqueta": "Elevación clínica", "problema": "somatizacion" }]
    },
    { "clave": "L", "validez": true, "…": "no genera hallazgo; marca la aplicación como de validez dudosa" }
  ],

  // Un ítem que exige atención aunque el total sea normal.
  "alertas": [
    { "item": 9, "minimo": 1, "nivel": "critico", "problema": "ideacion_suicida",
      "mensaje": "Ideación suicida referida en el ítem 9: requiere valoración de riesgo inmediata." }
  ]
}
```

## Niveles

`normal` · `leve` · `moderado` · `severo` · `critico`. Un rango o alerta con
nivel distinto de `normal` y con `problema` genera un **hallazgo**. Las
estadísticas del mando cuentan «con problema identificado» desde `moderado`.

## Respuestas

La aplicación guarda, por instrumento, el **índice** de la alternativa elegida
(`{"bdi2": {"16": 2}}`), no su valor: así 1a y 1b quedan distinguidos aunque
sumen igual. La base descarta cualquier respuesta a un ítem que no existe o con
un índice fuera de rango.

## Versiones

Cambiar la definición sube `version`. Las aplicaciones ya calificadas guardan
su resultado con la versión usada; **Recalificar** (en la ficha) vuelve a
calcularlo con la vigente.

## Mini-Mult

71 ítems y clave de Kincannon (1968); normas T de la adaptación rusa СМОЛ
(Zaitsev) tal como las usa `github.com/vilnar/quiz`, con corrección K por
techo (Hs +0,5K, Pd +0,4K, Pt +1K, Sc +1K, Ma +0,2K). Si la Sección dispone
de normas locales o de la conversión a puntajes MMPI de la versión en español,
reemplace media y desviación en cada escala.

## BPS · Bienestar Psicológico de Ryff

39 ítems de 1 a 6 (versión española de Díaz et al., 2006). Los 17 ítems
redactados en negativo (2, 4, 5, 8, 9, 13, 15, 20, 22, 25, 26, 27, 29, 30, 33,
34, 36) se invierten (7 − valor), de modo que un puntaje alto es siempre más
bienestar. Total de 39 a 234 con los cortes de la hoja FAES: ≤ 116 bajo
(hallazgo `bienestar_bajo`, nivel severo: acompañamiento prioritario), 117–140
moderado (nivel leve: seguimiento sin emergencia), 141–175 alto y ≥ 176
elevado. Las seis dimensiones se califican con los rangos de la hoja
(bajo / medio / alto) para la lectura, pero no generan hallazgo: la hoja indica
que ese análisis es para las unidades. Si la Sección prefiere sumar sin
invertir, quite la lista `invertidos` desde «Avanzado».

## ADS · Dependencia al Alcohol (Skinner y Horn)

25 ítems con alternativas propias que valen 0–1, 0–2 o 0–3 (el ítem 25
puntúa al revés: «Sí» 0, «No» 1). Total de 0 a 48: 0–7 no dependiente,
8–13 baja (leve), 14–21 moderada, 22–30 riesgo sustancial (severo),
31–48 severa (severo). Desde «leve» genera el hallazgo `consumo_alcohol`.
