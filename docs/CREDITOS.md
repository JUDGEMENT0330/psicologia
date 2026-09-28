# Créditos, referencias y licencias

## Repositorios consultados como referencia

| Repositorio | Qué se tomó | Licencia |
| --- | --- | --- |
| [vilnar/quiz](https://github.com/vilnar/quiz) | Sistema de pruebas psicológicas para personal militar (Go). De él se tomaron **como datos** los 71 ítems del Mini-Mult, su clave de corrección, la corrección K y las normas T (adaptación СМОЛ). Los ítems se tradujeron al español. No se copió código. | GPL-2.0 |
| [niivue/niivue](https://github.com/niivue/niivue) | La malla `aal.mz3` (116 áreas del atlas AAL como superficies), convertida a `public/cerebro/aal.bin` con `herramientas/cerebro/construir.py`. | BSD-2-Clause |
| JUDGEMENT0330/clinica-dental | Armazón visual, componentes y convenciones del sistema de la Sección de Sanidad. | Propio |

## Atlas

- Tzourio-Mazoyer N. et al. (2002). *Automated anatomical labeling of
  activations in SPM using a macroscopic anatomical parcellation of the MNI MRI
  single-subject brain.* NeuroImage 15:273–289. El atlas AAL se distribuye
  libremente para investigación; aquí se usa sólo su geometría y sus rótulos
  con fines de explicación clínica, no diagnósticos.

## Instrumentos

- Rosenberg, M. (1965). *Society and the adolescent self-image.* Versión
  española: Atienza, Balaguer y Moreno (2000).
- Beck, A. T., Epstein, N., Brown, G., Steer, R. A. (1988). *An inventory for
  measuring clinical anxiety* (BAI).
- Beck, A. T., Steer, R. A., Brown, G. K. (1996). *Manual for the Beck
  Depression Inventory-II.*
- Kincannon, J. C. (1968). *Prediction of the standard MMPI scale scores from
  71 items: The Mini-Mult.* Journal of Consulting and Clinical Psychology 32:319–325.

Los textos de Rosenberg, BAI y BDI-II provienen de las hojas de respuesta de la
clínica. Los instrumentos psicométricos pueden estar sujetos a derechos de sus
editores: su uso aquí es clínico e interno de la Sección de Sanidad.

## Asociación problema → áreas cerebrales

Las áreas de `ps_problemas` resumen hallazgos de neuroimagen descritos en la
literatura (circuito del miedo en ansiedad, red por defecto en autoestima,
corteza prefrontal y cíngulo anterior en depresión, circuitos córtico-estriados
en obsesividad e impulsividad, etc.). Son orientativas y editables por la
psicóloga; el mapa **no es un estudio de neuroimagen** de la persona evaluada.
