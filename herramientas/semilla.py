#!/usr/bin/env python3
"""
Genera la semilla de instrumentos y problemas del módulo de psicología.

    python3 herramientas/semilla.py

Escribe:
  supabase/semillas/instrumentos.json   — la definición legible, para revisar
  supabase/semillas/problemas.json
  supabase/migraciones/32_instrumentos_iniciales.sql — idempotente: inserta lo
      que falta y NO pisa lo que la psicóloga ya haya editado desde la app.

Fuentes:
  · Rosenberg, BAI y BDI-II: las hojas de respuesta de la clínica (docx).
  · Mini-Mult (Kincannon, 1968; adaptación rusa СМОЛ de Zaitsev): ítems,
    clave y normas tomados de github.com/vilnar/quiz (GPL-2.0), traducidos al
    español. Las normas T son las de esa adaptación y se pueden editar desde
    la pantalla «Instrumentos».
"""
import json, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------ Rosenberg --
ROSENBERG_ITEMS = [
    "Me siento una persona tan valiosa como las otras",
    "Generalmente me inclino a pensar que soy un fracaso",
    "Creo que tengo algunas cualidades buenas",
    "Soy capaz de hacer las cosas tan bien como los demás",
    "Creo que no tengo mucho de lo que estar orgulloso",
    "Tengo una actitud positiva hacia mí mismo",
    "En general me siento satisfecho conmigo mismo",
    "Me gustaría tener más respeto por mí mismo",
    "Realmente me siento inútil en algunas ocasiones",
    "A veces pienso que no sirvo para nada",
]
rosenberg = {
    "clave": "rosenberg", "nombre": "Escala de Autoestima de Rosenberg", "sigla": "RSE",
    "autores": "Rosenberg, 1965; Atienza, Balaguer y Moreno, 2000",
    "descripcion": "Autoestima global: 10 afirmaciones, 5 positivas y 5 negativas, respuesta de 4 puntos.",
    "instrucciones": "Lea las frases que figuran a continuación y señale el nivel de acuerdo o desacuerdo que tiene con cada una de ellas.",
    "orden": 10,
    "definicion": {
        "opciones": [
            {"valor": 1, "texto": "Muy en desacuerdo"},
            {"valor": 2, "texto": "En desacuerdo"},
            {"valor": 3, "texto": "De acuerdo"},
            {"valor": 4, "texto": "Muy de acuerdo"},
        ],
        "items": [{"n": i + 1, "texto": t} for i, t in enumerate(ROSENBERG_ITEMS)],
        "escalas": [{
            "clave": "total", "nombre": "Autoestima", "items": "todos",
            "invertidos": [2, 5, 8, 9, 10], "usa": "bruta",
            "rangos": [
                {"desde": 10, "hasta": 25, "nivel": "moderado", "etiqueta": "Autoestima baja", "problema": "baja_autoestima"},
                {"desde": 26, "hasta": 29, "nivel": "leve", "etiqueta": "Autoestima media", "problema": "baja_autoestima"},
                {"desde": 30, "hasta": 40, "nivel": "normal", "etiqueta": "Autoestima elevada"},
            ],
        }],
        "alertas": [],
    },
}

# ------------------------------------------------------------------ BAI --
BAI_ITEMS = [
    "Torpe o entumecido", "Acalorado", "Con temblor en las piernas", "Incapaz de relajarme",
    "Con temor a que ocurra lo peor", "Mareado, o que se le va la cabeza",
    "Con fuertes latidos del corazón y acelerado", "Inestable", "Atemorizado o asustado", "Nervioso",
    "Con sensación de bloqueo", "Con temblores en las manos", "Inquieto, inseguro",
    "Con miedo a perder el control", "Con sensación de ahogo", "Con temor a morir", "Con miedo",
    "Con problemas digestivos", "Con desvanecimiento", "Con rubor facial", "Con sudores, fríos o calientes",
]
bai = {
    "clave": "bai", "nombre": "Inventario de Ansiedad de Beck", "sigla": "BAI",
    "autores": "Beck, Epstein, Brown y Steer, 1988",
    "descripcion": "Síntomas de ansiedad somáticos y cognitivos en las últimas semanas: 21 ítems de 0 a 3.",
    "instrucciones": "Hay una serie de síntomas comunes a la ansiedad. Lea cada uno e indique cuánto le ha afectado en las últimas semanas, incluyendo el día de hoy.",
    "orden": 20,
    "definicion": {
        "opciones": [
            {"valor": 0, "texto": "En absoluto"},
            {"valor": 1, "texto": "Levemente"},
            {"valor": 2, "texto": "Moderadamente"},
            {"valor": 3, "texto": "Severamente"},
        ],
        "items": [{"n": i + 1, "texto": t} for i, t in enumerate(BAI_ITEMS)],
        "escalas": [{
            "clave": "total", "nombre": "Ansiedad", "items": "todos", "usa": "bruta",
            "rangos": [
                {"desde": 0, "hasta": 7, "nivel": "normal", "etiqueta": "Ansiedad mínima"},
                {"desde": 8, "hasta": 15, "nivel": "leve", "etiqueta": "Ansiedad leve", "problema": "ansiedad"},
                {"desde": 16, "hasta": 25, "nivel": "moderado", "etiqueta": "Ansiedad moderada", "problema": "ansiedad"},
                {"desde": 26, "hasta": 63, "nivel": "severo", "etiqueta": "Ansiedad grave", "problema": "ansiedad"},
            ],
        }],
        "alertas": [],
    },
}

# --------------------------------------------------------------- BDI-II --
BDI = [
    ("Tristeza", ["No me siento triste.", "Me siento triste gran parte del tiempo.", "Me siento triste todo el tiempo.", "Me siento tan triste o soy tan infeliz que no puedo soportarlo."]),
    ("Pesimismo", ["No estoy desalentado respecto de mi futuro.", "Me siento más desalentado respecto de mi futuro que lo que solía estarlo.", "No espero que las cosas funcionen para mí.", "Siento que no hay esperanza para mi futuro y que sólo puede empeorar."]),
    ("Fracaso", ["No me siento como un fracasado.", "He fracasado más de lo que hubiera debido.", "Cuando miro hacia atrás, veo muchos fracasos.", "Siento que como persona soy un fracaso total."]),
    ("Pérdida de placer", ["Obtengo tanto placer como siempre por las cosas de las que disfruto.", "No disfruto tanto de las cosas como solía hacerlo.", "Obtengo muy poco placer de las cosas que solía disfrutar.", "No puedo obtener ningún placer de las cosas de las que solía disfrutar."]),
    ("Sentimientos de culpa", ["No me siento particularmente culpable.", "Me siento culpable respecto de varias cosas que he hecho o que debería haber hecho.", "Me siento bastante culpable la mayor parte del tiempo.", "Me siento culpable todo el tiempo."]),
    ("Sentimientos de castigo", ["No siento que esté siendo castigado.", "Siento que tal vez pueda ser castigado.", "Espero ser castigado.", "Siento que estoy siendo castigado."]),
    ("Disconformidad con uno mismo", ["Siento acerca de mí lo mismo que siempre.", "He perdido la confianza en mí mismo.", "Estoy decepcionado conmigo mismo.", "No me gusto a mí mismo."]),
    ("Autocrítica", ["No me critico ni me culpo más de lo habitual.", "Estoy más crítico conmigo mismo de lo que solía estarlo.", "Me critico a mí mismo por todos mis errores.", "Me culpo a mí mismo por todo lo malo que sucede."]),
    ("Pensamientos o deseos suicidas", ["No tengo ningún pensamiento de matarme.", "He tenido pensamientos de matarme, pero no lo haría.", "Querría matarme.", "Me mataría si tuviera la oportunidad de hacerlo."]),
    ("Llanto", ["No lloro más de lo que solía hacerlo.", "Lloro más de lo que solía hacerlo.", "Lloro por cualquier pequeñez.", "Siento ganas de llorar pero no puedo."]),
    ("Agitación", ["No estoy más inquieto o tenso que lo habitual.", "Me siento más inquieto o tenso que lo habitual.", "Estoy tan inquieto o agitado que me es difícil quedarme quieto.", "Estoy tan inquieto o agitado que tengo que estar siempre en movimiento o haciendo algo."]),
    ("Pérdida de interés", ["No he perdido el interés en otras actividades o personas.", "Estoy menos interesado que antes en otras personas o cosas.", "He perdido casi todo el interés en otras personas o cosas.", "Me es difícil interesarme por algo."]),
    ("Indecisión", ["Tomo mis propias decisiones tan bien como siempre.", "Me resulta más difícil que de costumbre tomar decisiones.", "Encuentro mucha más dificultad que antes para tomar decisiones.", "Tengo problemas para tomar cualquier decisión."]),
    ("Desvalorización", ["No siento que yo no sea valioso.", "No me considero a mí mismo tan valioso y útil como solía considerarme.", "Me siento menos valioso cuando me comparo con otros.", "Siento que no valgo nada."]),
    ("Pérdida de energía", ["Tengo tanta energía como siempre.", "Tengo menos energía que la que solía tener.", "No tengo suficiente energía para hacer demasiado.", "No tengo energía suficiente para hacer nada."]),
    ("Cambios en los hábitos de sueño", None),
    ("Irritabilidad", ["No estoy más irritable que lo habitual.", "Estoy más irritable que lo habitual.", "Estoy mucho más irritable que lo habitual.", "Estoy irritable todo el tiempo."]),
    ("Cambios en el apetito", None),
    ("Dificultad de concentración", ["Puedo concentrarme tan bien como siempre.", "No puedo concentrarme tan bien como habitualmente.", "Me es difícil mantener la mente en algo por mucho tiempo.", "Encuentro que no puedo concentrarme en nada."]),
    ("Cansancio o fatiga", ["No estoy más cansado o fatigado que lo habitual.", "Me fatigo o me canso más fácilmente que lo habitual.", "Estoy demasiado fatigado o cansado para hacer muchas de las cosas que solía hacer.", "Estoy demasiado fatigado o cansado para hacer la mayoría de las cosas que solía hacer."]),
    ("Pérdida de interés en el sexo", ["No he notado ningún cambio reciente en mi interés por el sexo.", "Estoy menos interesado en el sexo de lo que solía estarlo.", "Estoy mucho menos interesado en el sexo.", "He perdido completamente el interés en el sexo."]),
]
SUENO = [(0, "0", "No he experimentado ningún cambio en mis hábitos de sueño."),
         (1, "1a", "Duermo un poco más que lo habitual."), (1, "1b", "Duermo un poco menos que lo habitual."),
         (2, "2a", "Duermo mucho más que lo habitual."), (2, "2b", "Duermo mucho menos que lo habitual."),
         (3, "3a", "Duermo la mayor parte del día."), (3, "3b", "Me despierto 1-2 horas más temprano y no puedo volver a dormirme.")]
APETITO = [(0, "0", "No he experimentado ningún cambio en mi apetito."),
           (1, "1a", "Mi apetito es un poco menor que lo habitual."), (1, "1b", "Mi apetito es un poco mayor que lo habitual."),
           (2, "2a", "Mi apetito es mucho menor que antes."), (2, "2b", "Mi apetito es mucho mayor que lo habitual."),
           (3, "3a", "No tengo apetito en absoluto."), (3, "3b", "Quiero comer todo el día.")]
bdi_items = []
for i, (grupo, ops) in enumerate(BDI):
    n = i + 1
    if n == 16: o = [{"valor": v, "rotulo": r, "texto": t} for v, r, t in SUENO]
    elif n == 18: o = [{"valor": v, "rotulo": r, "texto": t} for v, r, t in APETITO]
    else: o = [{"valor": v, "rotulo": str(v), "texto": t} for v, t in enumerate(ops)]
    bdi_items.append({"n": n, "texto": grupo, "grupo": grupo, "opciones": o})
bdi = {
    "clave": "bdi2", "nombre": "Inventario de Depresión de Beck", "sigla": "BDI-II",
    "autores": "Beck, Steer y Brown, 1996",
    "descripcion": "Gravedad de la sintomatología depresiva en las últimas dos semanas: 21 grupos de afirmaciones de 0 a 3.",
    "instrucciones": "Este cuestionario consta de 21 grupos de afirmaciones. Lea con atención cada uno y elija el enunciado que mejor describa el modo como se ha sentido las últimas dos semanas, incluyendo el día de hoy. Si varios le parecen igualmente apropiados, elija el de número más alto.",
    "orden": 30,
    "definicion": {
        "items": bdi_items,
        "escalas": [{
            "clave": "total", "nombre": "Depresión", "items": "todos", "usa": "bruta",
            "rangos": [
                {"desde": 0, "hasta": 13, "nivel": "normal", "etiqueta": "Depresión mínima"},
                {"desde": 14, "hasta": 19, "nivel": "leve", "etiqueta": "Depresión leve", "problema": "depresion"},
                {"desde": 20, "hasta": 28, "nivel": "moderado", "etiqueta": "Depresión moderada", "problema": "depresion"},
                {"desde": 29, "hasta": 63, "nivel": "severo", "etiqueta": "Depresión grave", "problema": "depresion"},
            ],
        }],
        "alertas": [
            {"item": 9, "minimo": 1, "nivel": "critico", "problema": "ideacion_suicida",
             "mensaje": "Ideación suicida referida en el ítem 9: requiere valoración de riesgo inmediata."},
        ],
    },
}

# ------------------------------------------------------------- Mini-Mult --
MM_ITEMS = [
    "Tengo buen apetito.",
    "Casi todas las mañanas me levanto descansado(a) y sintiendo que dormí bien.",
    "Mi vida diaria está llena de cosas que me interesan.",
    "Trabajo bajo mucha tensión.",
    "A veces me vienen a la mente pensamientos tan malos que es mejor no hablar de ellos.",
    "Rara vez sufro de estreñimiento.",
    "A veces he sentido muchos deseos de irme de mi casa para siempre.",
    "A veces tengo ataques de risa o de llanto que no puedo controlar.",
    "Me molestan las náuseas y las ganas de vomitar.",
    "Siento que nadie me comprende.",
    "A veces siento ganas de decir malas palabras.",
    "Tengo pesadillas casi todas las semanas.",
    "Me cuesta más concentrarme que a la mayoría de las personas.",
    "Me han sucedido (o me suceden) cosas muy extrañas.",
    "Habría logrado mucho más en la vida si la gente no estuviera en mi contra.",
    "Cuando era niño(a) hubo una época en que cometí pequeños robos.",
    "He tenido períodos de días, semanas o meses en que no podía ocuparme de nada porque no lograba ponerme a trabajar.",
    "Mi sueño es interrumpido e intranquilo.",
    "Cuando estoy entre otras personas, oigo cosas extrañas.",
    "La mayoría de las personas que me conocen no me consideran una persona desagradable.",
    "Con frecuencia he tenido que obedecer a alguien que sabía menos que yo.",
    "La mayoría de las personas está más satisfecha con su vida que yo.",
    "Mucha gente exagera sus desgracias para obtener compasión y ayuda.",
    "A veces me enojo.",
    "Definitivamente me falta confianza en mí mismo(a).",
    "Con frecuencia se me contraen o tiemblan los músculos.",
    "Con frecuencia siento que he hecho algo malo o incorrecto.",
    "Generalmente estoy satisfecho(a) con mi suerte.",
    "Algunas personas son tan mandonas que me dan ganas de hacer lo contrario, aunque sepa que tienen razón.",
    "Creo que están tramando algo en mi contra.",
    "La mayoría de la gente es capaz de obtener ventajas por medios no del todo honestos.",
    "Con frecuencia me molesta el estómago.",
    "A menudo no entiendo por qué el día anterior estuve de mal humor e irritable.",
    "A veces mis pensamientos van tan rápido que no alcanzo a expresarlos.",
    "Creo que mi vida familiar es tan buena como la de la mayoría de las personas que conozco.",
    "A veces estoy seguro(a) de que no sirvo para nada.",
    "En los últimos años me he sentido bien la mayor parte del tiempo.",
    "He tenido períodos en los que hice cosas que después no podía recordar.",
    "Creo que con frecuencia me han castigado sin motivo.",
    "Nunca me he sentido mejor que ahora.",
    "No me importa lo que piensen los demás de mí.",
    "Mi memoria está bien.",
    "Me cuesta mantener una conversación con alguien que acabo de conocer.",
    "La mayor parte del tiempo me siento débil.",
    "Rara vez me duele la cabeza.",
    "A veces me ha costado mantener el equilibrio al caminar.",
    "No me agradan todas las personas que conozco.",
    "Hay personas que tratan de robarme mis ideas y pensamientos.",
    "Creo que he cometido actos que no pueden perdonarse.",
    "Creo que soy demasiado tímido(a).",
    "Casi siempre estoy preocupado(a) por algo.",
    "Con frecuencia mis padres no aprobaban a mis amistades.",
    "A veces chismeo un poco.",
    "A veces siento que me resulta inusualmente fácil tomar decisiones.",
    "Con frecuencia siento palpitaciones fuertes y me falta el aire.",
    "Me enojo con facilidad, pero se me pasa pronto.",
    "He tenido épocas de tanta inquietud que me costaba permanecer sentado(a).",
    "Mis padres y otros familiares me critican con frecuencia.",
    "A nadie le importa mucho lo que me pase.",
    "No culpo a quien se aprovecha de los errores de otro en su propio beneficio.",
    "A veces me siento lleno(a) de energía.",
    "Últimamente ha empeorado mi vista.",
    "Con frecuencia me zumban o me suenan los oídos.",
    "Alguna vez en mi vida (quizá sólo una) sentí que alguien me hipnotizaba o influía sobre mí.",
    "Tengo períodos en los que me siento inusualmente alegre sin una razón especial.",
    "Aun estando acompañado(a), casi siempre me siento solo(a).",
    "Creo que casi cualquiera mentiría para evitarse problemas.",
    "Siento las cosas con más intensidad que la mayoría de las personas.",
    "A veces mi mente trabaja más lento de lo habitual.",
    "Con frecuencia me decepciono de la gente.",
    "He abusado de las bebidas alcohólicas.",
]
assert len(MM_ITEMS) == 71

def rng_clinico(problema, nombre):
    return [
        {"hasta": 59.9, "nivel": "normal", "etiqueta": "Dentro de la norma"},
        {"desde": 60, "hasta": 69.9, "nivel": "leve", "etiqueta": f"{nombre}: acentuación", "problema": problema},
        {"desde": 70, "hasta": 79.9, "nivel": "moderado", "etiqueta": f"{nombre}: elevación clínica", "problema": problema},
        {"desde": 80, "nivel": "severo", "etiqueta": f"{nombre}: elevación marcada", "problema": problema},
    ]

def rng_validez(etq):
    return [{"hasta": 69.9, "nivel": "normal", "etiqueta": "Válida"},
            {"desde": 70, "nivel": "moderado", "etiqueta": etq}]

MM_ESCALAS = [
    dict(clave="L", nombre="L · Mentira", clave_f=[5, 11, 24, 47, 53], t=(1.48, 1.23), validez=True,
         rangos=rng_validez("Tendencia a presentarse de forma favorable")),
    dict(clave="F", nombre="F · Validez", clave_v=[9, 12, 15, 19, 30, 38, 48, 49, 58, 59, 64, 71], clave_f=[22, 24, 61],
         t=(3.1, 2.3), validez=True, rangos=rng_validez("Respuestas atípicas: posible exageración o azar")),
    dict(clave="K", nombre="K · Corrección", clave_f=[11, 23, 31, 33, 34, 36, 40, 41, 43, 51, 56, 61, 65, 67, 69, 70],
         t=(7.68, 3.42), validez=True, rangos=rng_validez("Actitud defensiva")),
    dict(clave="Hs", nombre="1 · Hs Hipocondría", clave_v=[9, 18, 26, 32, 44, 46, 55, 62, 63], clave_f=[1, 2, 6, 37, 45],
         k=0.5, t=(7.24, 3), problema="somatizacion"),
    dict(clave="D", nombre="2 · D Depresión", clave_v=[9, 13, 17, 18, 22, 25, 36, 44],
         clave_f=[1, 3, 6, 11, 28, 37, 40, 42, 60, 61, 65], t=(7.02, 2.68), problema="depresion"),
    dict(clave="Hy", nombre="3 · Hy Histeria", clave_v=[9, 13, 18, 26, 44, 46, 55, 57, 62],
         clave_f=[1, 2, 3, 11, 23, 28, 29, 31, 33, 35, 37, 40, 41, 43, 45, 50, 56], t=(9.73, 2.91), problema="conversion"),
    dict(clave="Pd", nombre="4 · Pd Desviación psicopática", clave_v=[7, 10, 13, 14, 15, 16, 22, 27, 52, 58, 71],
         clave_f=[3, 28, 34, 35, 41, 43, 50, 65], k=0.4, t=(10.39, 2.13), problema="impulsividad"),
    dict(clave="Pa", nombre="6 · Pa Paranoia", clave_v=[5, 8, 10, 15, 30, 39, 63, 64, 66, 68], clave_f=[28, 29, 31, 67],
         t=(4.03, 1.74), problema="paranoia"),
    dict(clave="Pt", nombre="7 · Pt Psicastenia", clave_v=[5, 8, 13, 17, 22, 25, 27, 36, 44, 51, 57, 66, 68],
         clave_f=[2, 3, 42], k=1, t=(13.57, 2.51), problema="ansiedad_obsesiva"),
    dict(clave="Sc", nombre="8 · Sc Esquizofrenia", clave_v=[5, 7, 8, 10, 13, 14, 15, 16, 17, 26, 30, 38, 39, 46, 57, 63, 64, 66],
         clave_f=[3, 42], k=1, t=(13.68, 2.83), problema="alteracion_pensamiento"),
    dict(clave="Ma", nombre="9 · Ma Hipomanía", clave_v=[4, 7, 8, 21, 29, 34, 38, 39, 54, 57, 60], clave_f=[43],
         k=0.2, t=(6.23, 1.55), problema="hipomania"),
]
mm_escalas = []
for e in MM_ESCALAS:
    d = {"clave": e["clave"], "nombre": e["nombre"], "usa": "t",
         "t": {"media": e["t"][0], "de": e["t"][1]}}
    if e.get("clave_v"): d["clave_v"] = e["clave_v"]
    if e.get("clave_f"): d["clave_f"] = e["clave_f"]
    if e.get("k"): d["suma_k"] = {"escala": "K", "factor": e["k"], "redondeo": "techo"}
    if e.get("validez"):
        d["validez"] = True; d["rangos"] = e["rangos"]
    else:
        d["rangos"] = rng_clinico(e["problema"], e["nombre"].split(" ", 2)[-1])
    mm_escalas.append(d)

minimult = {
    "clave": "minimult", "nombre": "Mini-Mult (MMPI abreviado)", "sigla": "Mini-Mult",
    "autores": "Kincannon, 1968; adaptación de normas СМОЛ (Zaitsev)",
    "descripcion": "Versión abreviada del MMPI: 71 afirmaciones Verdadero/Falso, 3 escalas de validez (L, F, K) y 8 clínicas con corrección K. Puntajes T; se considera elevación clínica T ≥ 70.",
    "instrucciones": "A continuación hay una serie de afirmaciones sobre su salud y su carácter. Lea cada una y decida si es verdadera o falsa en su caso. No se detenga a pensar demasiado: la respuesta más natural es la primera que se le ocurre.",
    "orden": 40,
    "definicion": {
        "opciones": [{"valor": 1, "texto": "Verdadero"}, {"valor": 0, "texto": "Falso"}],
        "items": [{"n": i + 1, "texto": t} for i, t in enumerate(MM_ITEMS)],
        "escalas": mm_escalas,
        "alertas": [
            {"item": 71, "minimo": 1, "nivel": "moderado", "problema": "consumo_alcohol",
             "mensaje": "Refiere abuso de bebidas alcohólicas (ítem 71)."},
        ],
    },
}

INSTRUMENTOS = [rosenberg, bai, bdi, minimult]

# ------------------------------------------------------------ problemas --
# Regiones: identificadores del atlas AAL (Tzourio-Mazoyer et al., 2002).
# Pares izquierda/derecha. La asociación es orientativa, para la lectura
# clínica y la educación del evaluado: NO es un hallazgo de neuroimagen.
PROBLEMAS = [
    dict(clave="depresion", nombre="Síntomas depresivos", color="#1a44b8", orden=10,
         regiones=[7, 8, 3, 4, 31, 32, 25, 26, 41, 42, 37, 38, 29, 30],
         descripcion="Tristeza, anhedonia, pesimismo, fatiga y alteraciones del sueño y del apetito.",
         explicacion="Hipoactividad de la corteza prefrontal dorsolateral (giro frontal medio y superior), hiperactividad de la corteza cingulada anterior subgenual y la corteza orbitofrontal medial, reactividad aumentada de la amígdala y menor volumen hipocampal; la ínsula participa en la vivencia corporal del ánimo."),
    dict(clave="ansiedad", nombre="Ansiedad", color="#8a5800", orden=20,
         regiones=[41, 42, 29, 30, 31, 32, 37, 38, 39, 40, 25, 26],
         descripcion="Síntomas somáticos y cognitivos de ansiedad: tensión, temor, activación autonómica.",
         explicacion="Circuito del miedo: amígdala (detección de amenaza), ínsula (conciencia de la activación corporal), cingulado anterior (evaluación del conflicto), hipocampo y parahipocampo (contexto) con menor regulación desde la corteza prefrontal ventromedial."),
    dict(clave="baja_autoestima", nombre="Baja autoestima", color="#6d4bb8", orden=30,
         regiones=[23, 24, 35, 36, 67, 68, 31, 32],
         descripcion="Valoración global negativa de uno mismo.",
         explicacion="Red de autorreferencia (red neuronal por defecto): corteza prefrontal medial (giro frontal superior medial), cingulado posterior y precúneo, con el cingulado anterior en la sensibilidad al rechazo."),
    dict(clave="ideacion_suicida", nombre="Ideación suicida", color="#b8241a", orden=5,
         regiones=[25, 26, 27, 28, 15, 16, 31, 32, 7, 8],
         descripcion="Pensamientos o deseos de morir referidos por el evaluado. Requiere valoración de riesgo inmediata.",
         explicacion="Alteraciones descritas en la corteza orbitofrontal y ventromedial (giro recto, orbitofrontal inferior), el cingulado anterior y la prefrontal dorsolateral: toma de decisiones, control inhibitorio y dolor psicológico."),
    dict(clave="somatizacion", nombre="Preocupación somática (Hs)", color="#b0521f", orden=40,
         regiones=[29, 30, 57, 58, 31, 32, 33, 34],
         descripcion="Preocupación excesiva por el funcionamiento corporal y la salud.",
         explicacion="Interocepción amplificada: ínsula, corteza somatosensorial (poscentral) y cingulado anterior y medio."),
    dict(clave="conversion", nombre="Reacciones de conversión (Hy)", color="#a0336e", orden=50,
         regiones=[19, 20, 1, 2, 63, 64, 31, 32],
         descripcion="Tendencia a expresar el malestar mediante síntomas físicos y a negar conflictos.",
         explicacion="Síntomas funcionales vinculados al área motora suplementaria y precentral, la unión temporoparietal (supramarginal) y el cingulado anterior."),
    dict(clave="impulsividad", nombre="Impulsividad y conflicto con normas (Pd)", color="#c2410c", orden=60,
         regiones=[15, 16, 9, 10, 25, 26, 41, 42, 71, 72, 73, 74],
         descripcion="Desajuste social, impulsividad, conflicto con la autoridad y las normas.",
         explicacion="Control inhibitorio y valoración de consecuencias: corteza orbitofrontal (inferior, media y medial), amígdala y estriado (caudado y putamen)."),
    dict(clave="paranoia", nombre="Suspicacia (Pa)", color="#7c2d12", orden=70,
         regiones=[41, 42, 81, 82, 23, 24, 65, 66],
         descripcion="Desconfianza, sensibilidad interpersonal, ideas de referencia o perjuicio.",
         explicacion="Detección de amenaza social (amígdala) y teoría de la mente: temporal superior, prefrontal medial y giro angular (unión temporoparietal)."),
    dict(clave="ansiedad_obsesiva", nombre="Ansiedad obsesiva (Pt)", color="#a16207", orden=80,
         regiones=[5, 6, 9, 10, 71, 72, 31, 32, 77, 78],
         descripcion="Tensión, duda, rumiación, perfeccionismo y sentimientos de insuficiencia.",
         explicacion="Circuito córtico-estriado-tálamo-cortical: orbitofrontal, núcleo caudado, cingulado anterior y tálamo."),
    dict(clave="alteracion_pensamiento", nombre="Alteración del pensamiento (Sc)", color="#4c1d95", orden=90,
         regiones=[7, 8, 81, 82, 79, 80, 37, 38, 77, 78],
         descripcion="Aislamiento, experiencias inusuales, pensamiento poco convencional.",
         explicacion="Prefrontal dorsolateral, temporal superior y giro de Heschl (percepción auditiva), hipocampo y tálamo."),
    dict(clave="hipomania", nombre="Activación hipomaníaca (Ma)", color="#be185d", orden=100,
         regiones=[15, 16, 41, 42, 73, 74, 75, 76, 31, 32],
         descripcion="Energía y ánimo elevados, aceleración, impulsividad.",
         explicacion="Hiperactividad del circuito de recompensa y regulación emocional: orbitofrontal inferior, amígdala, putamen, pálido y cingulado anterior."),
    dict(clave="consumo_alcohol", nombre="Consumo problemático de alcohol", color="#0f766e", orden=110,
         regiones=[71, 72, 73, 74, 25, 26, 29, 30, 109, 110, 111, 112, 113, 114, 115, 116],
         descripcion="Refiere abuso de bebidas alcohólicas.",
         explicacion="Estriado (caudado y putamen, vía de recompensa), orbitofrontal medial, ínsula (deseo de consumo) y vermis cerebeloso, sensible al daño por alcohol."),
]

def sql_txt(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"

def main():
    os.makedirs(os.path.join(RAIZ, "supabase", "semillas"), exist_ok=True)
    json.dump(INSTRUMENTOS, open(os.path.join(RAIZ, "supabase/semillas/instrumentos.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(PROBLEMAS, open(os.path.join(RAIZ, "supabase/semillas/problemas.json"), "w"), ensure_ascii=False, indent=1)
    out = ["-- ============================================================================",
           "-- 32 · INSTRUMENTOS, PROBLEMAS Y BATERÍA INICIALES",
           "-- ----------------------------------------------------------------------------",
           "-- GENERADO por `herramientas/semilla.py`: no editar a mano.",
           "-- Idempotente: `on conflict do nothing`, así que volver a correrla no pisa lo",
           "-- que la psicóloga haya ajustado desde la pantalla «Instrumentos».",
           "-- ============================================================================", ""]
    for p in PROBLEMAS:
        out.append("insert into ps_problemas (clave, nombre, descripcion, regiones, explicacion, color, orden) values ("
                   f"{sql_txt(p['clave'])}, {sql_txt(p['nombre'])}, {sql_txt(p['descripcion'])}, "
                   f"'{{{','.join(map(str, p['regiones']))}}}', {sql_txt(p['explicacion'])}, {sql_txt(p['color'])}, {p['orden']}) "
                   "on conflict (clave) do nothing;")
    out.append("")
    for i in INSTRUMENTOS:
        out.append("insert into ps_instrumentos (clave, nombre, sigla, autores, descripcion, instrucciones, definicion, orden) values ("
                   f"{sql_txt(i['clave'])}, {sql_txt(i['nombre'])}, {sql_txt(i['sigla'])}, {sql_txt(i['autores'])}, "
                   f"{sql_txt(i['descripcion'])}, {sql_txt(i['instrucciones'])}, "
                   f"{sql_txt(json.dumps(i['definicion'], ensure_ascii=False))}::jsonb, {i['orden']}) on conflict (clave) do nothing;")
    out.append("")
    out.append("""-- Dos baterías de partida: la de tamizaje periódico y la completa con Mini-Mult.
insert into ps_baterias (nombre, descripcion, instrucciones, consentimiento, instrumentos)
select 'Tamizaje emocional', 'Autoestima, ansiedad y depresión. Unos 15 minutos.',
       'Responda con sinceridad. No hay respuestas buenas ni malas. Sus respuestas son confidenciales y sólo las ve la psicóloga de la Sección de Sanidad.',
       'Acepto responder esta evaluación psicológica. Entiendo que mis respuestas son confidenciales, que sólo las conoce el personal de Psicología y que se usan para mi atención y, sin mi nombre, para estadísticas de la unidad.',
       array['rosenberg','bai','bdi2']
 where not exists (select 1 from ps_baterias where nombre = 'Tamizaje emocional');
insert into ps_baterias (nombre, descripcion, instrucciones, consentimiento, instrumentos)
select 'Evaluación integral', 'Tamizaje emocional más perfil de personalidad Mini-Mult. Unos 30 minutos.',
       'Responda con sinceridad. No hay respuestas buenas ni malas. Sus respuestas son confidenciales y sólo las ve la psicóloga de la Sección de Sanidad.',
       'Acepto responder esta evaluación psicológica. Entiendo que mis respuestas son confidenciales, que sólo las conoce el personal de Psicología y que se usan para mi atención y, sin mi nombre, para estadísticas de la unidad.',
       array['rosenberg','bai','bdi2','minimult']
 where not exists (select 1 from ps_baterias where nombre = 'Evaluación integral');""")
    open(os.path.join(RAIZ, "supabase/migraciones/32_instrumentos_iniciales.sql"), "w").write("\n".join(out) + "\n")
    print("ok", len(INSTRUMENTOS), "instrumentos,", len(PROBLEMAS), "problemas")

if __name__ == "__main__":
    main()
