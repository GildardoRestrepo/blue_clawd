// Clawd, píxel por píxel, a partir del logo de bloques de Claude Code:
//
//    ▐▛███▜▌
//   ▝▜█████▛▘
//     ▘▘ ▝▝
//
// Cada carácter son 2×2 "cuadrantes"; en la terminal un cuadrante es el doble de
// alto que de ancho, así que aquí cada píxel mide 1 de ancho y 2 de alto.
// Rejilla: 16 columnas × 5 filas (viewBox 16×10). Los ojos van pintados del color
// del fondo, como los huecos del logo.
//
// Clawd de la barra (clase en el <svg>):
//   idle    esperando: respira, parpadea, mira alrededor; a los 40 s saca un
//           librito y lee (recorre las líneas, pasa la página); a los 5 min sin
//           cambios se duerme (ojos cerrados y "z z z"). Todo es CSS: cada vez
//           que el dibujo cambia, la cuenta vuelve a empezar.
//   typing  escribes: sus ojos siguen tu cursor por el renglón, asiente y
//           golpetea una pata
//   hide    Claude trabaja: se mete detrás de la barra y cada tanto se asoma
//           (cabeza, ojos y pinzas en el borde), mira a los lados y se vuelve a meter
// Efectos de una sola vez, junto al estado:
//   pop        se asoma desde detrás de la barra
//   celebrate  se asoma, salta dos veces con las pinzas arriba y suelta destellos
//   poke       /clawd hola: salta y saluda con la pinza derecha
//
// Según la hora (local), el Clawd de la barra lleva: de 6 a 12 una taza de café
// humeante (y de vez en cuando da un sorbo); de 12 a 18 nada; de 18 a 6 un gorro
// de dormir con pompón.
//
// Clawd del chat (spinner), según lo que hace Claude (WorkTask):
//   think  pensando: mira arriba con "…" sobre la cabeza
//   read   leyendo o buscando: recorre algo con una lupa
//   edit   editando archivos: martilla
//   shell  comandos: teclea frente a una pantallita con ">_"
//   write  escribiendo la respuesta: llena renglones en un papelito
//   walk   cualquier otra cosa: camina

export type ClawdMode = 'idle' | 'typing' | 'hide' | 'walk'
export type ClawdEffect = 'pop' | 'celebrate' | 'poke'
export type WorkTask = 'think' | 'read' | 'edit' | 'shell' | 'write' | 'walk'
/** Accesorio del Clawd de la barra según la hora: café (6–12), nada (12–18), gorro (18–6). */
export type Accessory = 'coffee' | 'none' | 'nightcap'

export const CLAWD_W = 16
export const CLAWD_H = 10
/** Segundos sin cambios hasta que Clawd saca su librito y lee. */
export const READ_AFTER_S = 40
/** Segundos sin cambios hasta que Clawd guarda el libro y se duerme. */
export const SLEEP_AFTER_S = 300

const BODY = '#5988d9'
// Los ojos van pintados del color del fondo oscuro de la app: se ven como los
// huecos del logo y, a diferencia de una máscara, siempre se animan.
const EYE = '#262624'
const SPARK = ['#f5d76e', '#cfe0ff', '#f5d76e', '#cfe0ff', '#f5d76e', '#cfe0ff']
const Z = '#a9c4f0'
const COVER = '#c0563f'
const PAGE = '#f1ead8'
const INK = '#9b9384'

const R = READ_AFTER_S
const S = SLEEP_AFTER_S
const STYLE = `
.eye { transform-box: fill-box; transform-origin: center; animation: blink 7s infinite; }
.z, .spark, .book, .flip { opacity: 0; }
.spark { transform-box: fill-box; transform-origin: center; }
.idle .clawd { animation: bob 3.2s ease-in-out infinite, slump 4s ease-in-out ${S}s infinite; }
.idle .eyes { animation: look 9s ease-in-out infinite, scan 3.2s ease-in-out ${R}s infinite, settle 0.4s ${S}s forwards; }
.idle .book { animation: bookin 0.5s ease-out ${R}s forwards, bookout 0.4s ease-in ${S - 0.6}s forwards; }
.idle .flip { animation: flip 6.4s steps(1) ${R + 3}s infinite, bookout 0.4s ease-in ${S - 0.6}s forwards; }
.idle .eye { animation: blink 7s infinite, doze 1.2s ease-in ${S}s forwards; }
.idle .z1 { animation: zfloat 3.6s linear ${S + 1}s infinite; }
.idle .z2 { animation: zfloat 3.6s linear ${S + 2.2}s infinite; }
.idle .z3 { animation: zfloat 3.6s linear ${S + 3.4}s infinite; }
.typing .clawd { animation: nod 1.4s ease-in-out infinite; }
.typing .l4 { animation: step 0.7s steps(1) infinite; }
.walk .clawd { animation: bob 0.46s ease-in-out infinite; }
.walk .l1, .walk .l3 { animation: step 0.46s steps(1) infinite; }
.walk .l2, .walk .l4 { animation: step 0.46s steps(1) infinite 0.23s; }
.walk .arm { animation: step 0.46s steps(1) infinite 0.12s; }
.hide .all { animation: dive 0.35s ease-in forwards, peek 9s ease-in-out 2.5s infinite; }
.hide .eyes { animation: peeklook 9s ease-in-out 2.5s infinite; }
.think .clawd { animation: bob 3.2s ease-in-out infinite; }
.think .dot { animation: dotwave 1.2s ease-in-out infinite; }
.think .d2 { animation-delay: 0.2s; }
.think .d3 { animation-delay: 0.4s; }
.read .lupa { animation: scanx 1.4s ease-in-out infinite; }
.read .clawd { animation: bob 3.2s ease-in-out infinite; }
.edit .hammer { transform-box: fill-box; transform-origin: 50% 100%; animation: hammer 0.5s ease-in-out infinite; }
.edit .arm-r { animation: step 0.5s steps(1) infinite; }
.shell .arm { animation: step 0.2s steps(1) infinite; }
.shell .arm-r { animation-delay: 0.1s; }
.shell .cur { animation: curblink 0.8s steps(1) infinite; }
.write .ln { transform-box: fill-box; transform-origin: 0 50%; animation: ink 2.4s linear infinite; }
.write .ln2 { animation-delay: 0.8s; }
.write .ln3 { animation-delay: 1.6s; }
.write .arm-r { animation: step 0.3s steps(1) infinite; }
.steam { opacity: 0; }
.coffee .steam { animation: steam 2.6s ease-out infinite; }
.coffee .st2 { animation-delay: 1.3s; }
.coffee .mug { animation: sip 9s ease-in-out infinite; }
.nightcap .pom { animation: bob 3.2s ease-in-out infinite 0.4s; }
.pop .all { animation: pop 0.45s cubic-bezier(.3, 1.5, .6, 1) both; }
.celebrate .all { animation: pop 0.45s cubic-bezier(.3, 1.5, .6, 1) both, hop 0.34s ease-out 0.5s 2; }
.celebrate .arm { animation: cheer 0.34s steps(1) 0.5s 4; }
.celebrate .spark { animation: spark 0.8s ease-out 0.6s 2; }
.celebrate .s2, .celebrate .s5 { animation-delay: 0.75s; }
.poke .all { animation: hop 0.3s ease-out 2; }
.poke .arm-r { animation: wave 0.24s steps(1) 5; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-0.5px); } }
@keyframes slump { 0%, 100% { transform: translateY(0.6px); } 50% { transform: translateY(1px); } }
@keyframes nod { 0%, 60%, 100% { transform: translateY(0); } 75% { transform: translateY(0.6px); } }
@keyframes blink { 0%, 40%, 44%, 86%, 89%, 92%, 100% { transform: scaleY(1); } 42%, 87.5%, 90.5% { transform: scaleY(0.1); } }
@keyframes doze { to { transform: scaleY(0.25); } }
@keyframes look { 0%, 40%, 100% { transform: translateX(0); } 48%, 58% { transform: translateX(-1px); } 66%, 76% { transform: translateX(1px); } 84% { transform: translateX(0); } }
@keyframes settle { to { transform: translateX(0); } }
@keyframes scan { 0% { transform: translate(-1px, 0.5px); } 40% { transform: translate(0, 0.5px); } 50% { transform: translate(-1px, 0.8px); } 90% { transform: translate(0, 0.8px); } 100% { transform: translate(-1px, 0.5px); } }
@keyframes bookin { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bookout { to { opacity: 0; transform: translateY(2px); } }
@keyframes flip { 0% { opacity: 0; } 92% { opacity: 1; } }
@keyframes step { 0% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
@keyframes pop { from { transform: translateY(11px); opacity: 0; } 40% { opacity: 1; } to { transform: translateY(0); opacity: 1; } }
@keyframes dive { from { transform: translateY(0); opacity: 1; } to { transform: translateY(11px); opacity: 0; } }
@keyframes hop { 0%, 100% { transform: translateY(0); } 45% { transform: translateY(-3px); } }
@keyframes cheer { 0% { transform: translateY(-2px); } 50% { transform: translateY(0); } }
@keyframes wave { 0% { transform: translateY(-2px); } 50% { transform: translateY(0); } }
@keyframes zfloat { 0% { opacity: 0; transform: translate(0, 0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(2px, -6px); } }
@keyframes spark { 0% { opacity: 0; transform: scale(0.2); } 30% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(0.6); } }
@keyframes peek { 0%, 70% { transform: translateY(11px); opacity: 0; } 71% { opacity: 1; } 76%, 90% { transform: translateY(5px); opacity: 1; } 95% { transform: translateY(11px); opacity: 1; } 96%, 100% { transform: translateY(11px); opacity: 0; } }
@keyframes peeklook { 0%, 77% { transform: translateX(0); } 80%, 83% { transform: translateX(-1px); } 85%, 88% { transform: translateX(1px); } 90%, 100% { transform: translateX(0); } }
@keyframes dotwave { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-0.6px); } }
@keyframes scanx { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-1.6px); } }
@keyframes hammer { 0%, 100% { transform: rotate(0); } 45% { transform: rotate(-40deg); } 60% { transform: rotate(8deg); } }
@keyframes curblink { 0% { opacity: 1; } 50% { opacity: 0; } }
@keyframes ink { 0% { transform: scaleX(0); } 60%, 100% { transform: scaleX(1); } }
@keyframes steam { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(-1.8px); } }
@keyframes sip { 0%, 84%, 100% { transform: translate(0, 0); } 88%, 94% { transform: translate(0.8px, -1.4px); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } .hide .all { opacity: 0; } }
`

/** Una "z" de 3×3 unidades con trazo fino, para el sueño. */
function zGlyph(cls: string, x: number, y: number): string {
  return [
    `<g class="z ${cls}">`,
    `<rect x="${x}" y="${y}" width="3" height="1" fill="${Z}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${Z}"/>`,
    `<rect x="${x}" y="${y + 2}" width="3" height="1" fill="${Z}"/>`,
    '</g>',
  ].join('')
}

/**
 * Hacia dónde miran los ojos mientras escribes, según la columna del cursor en su
 * renglón: 0 al empezar (lejos, a la izquierda) hasta 3 al final (más cerca de
 * Clawd). Siempre un poco hacia abajo, porque el texto está bajo él.
 */
export const GAZE: readonly (readonly [number, number])[] = [
  [-1.5, 0.6],
  [-1, 0.6],
  [-0.5, 0.6],
  [0, 0.6],
]

/** La posición de la mirada (0 a 3) para un cursor en `text`, según su renglón visual. */
export function gazeFor(text: string, cursor: number, widthPct = 100): number {
  const at = Math.max(0, Math.min(cursor, text.length))
  const line = wrapLines(text, widthPct).find(l => at >= l.start && at <= l.end)
  if (!line) return 0
  const fraction = textWidthEm(text.slice(line.start, at)) / lineEm(widthPct)
  return Math.min(GAZE.length - 1, Math.max(0, Math.floor(fraction * GAZE.length)))
}

const MUG = '#f1ead8'
const COFFEE = '#6b4a2b'
const STRIPE = '#2f7cf6'
const STEAM = '#cfd6e0'
const CAP = '#3d3a7a'
const TRIM = '#e9e4f5'
const STAR = '#f5d76e'

const rect = (x: number, y: number, w: number, h: number, fill: string, cls = '') =>
  `<rect${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

/** Lo que lleva puesto o en la mano según la hora. Se mueve con el cuerpo. */
const ACCESSORY: Record<Accessory, string> = {
  none: '',
  // taza de café en la pinza izquierda, con vapor; de vez en cuando da un sorbo
  coffee: [
    '<g class="mug">',
    rect(-2.4, 1.6, 0.5, 1.2, STEAM, 'steam st1'),
    rect(-1.4, 2, 0.5, 1.2, STEAM, 'steam st2'),
    rect(-3.2, 3.6, 2.8, 3.4, MUG), // taza
    rect(-3, 3.6, 2.4, 0.6, COFFEE), // café
    rect(-3.2, 5.2, 2.8, 0.5, STRIPE), // franja
    rect(-4, 4.4, 0.8, 0.5, MUG), // asa
    rect(-4, 4.4, 0.5, 1.8, MUG),
    rect(-4, 5.7, 0.8, 0.5, MUG),
    '</g>',
  ].join(''),
  // gorro de dormir caído hacia la derecha, con estrellitas y pompón
  nightcap: [
    rect(4.5, -2.4, 8, 0.8, CAP),
    rect(3, -1.6, 10, 0.8, CAP),
    rect(6.5, -3.2, 6.5, 0.8, CAP),
    rect(9, -4, 4.5, 0.8, CAP),
    rect(11.5, -4.8, 3, 0.8, CAP),
    rect(14, -4.4, 1.2, 1.2, CAP), // punta caída
    rect(2, -0.8, 12, 0.8, TRIM), // borde
    rect(6, -2.3, 0.5, 0.5, STAR),
    rect(10.2, -3.6, 0.5, 0.5, STAR),
    rect(14.6, -3.4, 1.6, 1.6, TRIM, 'pom'), // pompón
  ].join(''),
}

/**
 * Las piezas de Clawd, en coordenadas de la rejilla (16×10). `look` fija hacia
 * dónde miran los ojos; `props` son objetos que sostiene (se mueven con él);
 * `wear` es el accesorio de la hora.
 */
function parts(look?: readonly [number, number], props = '', wear: Accessory = 'none'): string {
  const px = (x: number, row: number, w: number, cls = '') =>
    `<rect${cls ? ` class="${cls}"` : ''} x="${x}" y="${row * 2}" width="${w}" height="2" fill="${BODY}"/>`
  // destellos alrededor de la cabeza, para celebrar
  const sparks = [
    [-2, -1],
    [1, -4],
    [7.5, -6],
    [14, -4],
    [17, -1],
    [4, -7],
  ]
    .map(([x, y], i) => `<rect class="spark s${i + 1}" x="${x}" y="${y}" width="1" height="1" fill="${SPARK[i]}"/>`)
    .join('')
  return [
    '<g class="all">',
    '<g class="clawd">',
    `<rect x="2" y="0" width="12" height="8" fill="${BODY}"/>`, // cuerpo, filas 0 a 3
    // ojos de 1×1 píxel (fila 1, columnas 4 y 11); el grupo los mueve juntos
    look ? `<g class="eyes" transform="translate(${look[0]} ${look[1]})">` : '<g class="eyes">',
    `<rect class="eye" x="4" y="2" width="1" height="2" fill="${EYE}"/>`,
    `<rect class="eye" x="11" y="2" width="1" height="2" fill="${EYE}"/>`,
    '</g>',
    // librito abierto, sostenido frente al cuerpo (filas 2 y 3)
    '<g class="book">',
    `<rect x="3" y="4.5" width="10" height="3.5" fill="${COVER}"/>`,
    `<rect x="4" y="5" width="3.6" height="2.5" fill="${PAGE}"/>`,
    `<rect x="8.4" y="5" width="3.6" height="2.5" fill="${PAGE}"/>`,
    `<rect x="4.6" y="5.6" width="2.4" height="0.4" fill="${INK}"/>`,
    `<rect x="4.6" y="6.6" width="2" height="0.4" fill="${INK}"/>`,
    `<rect x="9" y="5.6" width="2.4" height="0.4" fill="${INK}"/>`,
    `<rect x="9" y="6.6" width="1.8" height="0.4" fill="${INK}"/>`,
    // la página que se pasa
    `<rect class="flip" x="8" y="4.6" width="2.2" height="3" fill="${PAGE}"/>`,
    '</g>',
    px(0, 2, 2, 'arm arm-l'), // brazo izquierdo
    px(14, 2, 2, 'arm arm-r'), // brazo derecho
    props,
    ACCESSORY[wear],
    zGlyph('z1', 13, -4),
    zGlyph('z2', 15, -7),
    zGlyph('z3', 17, -10),
    '</g>',
    // patas (fila 4)
    px(3, 4, 1, 'leg l1'),
    px(5, 4, 1, 'leg l2'),
    px(10, 4, 1, 'leg l3'),
    px(12, 4, 1, 'leg l4'),
    sparks,
    '</g>',
  ].join('')
}

/** Clawd solo, como SVG de `scale` píxeles de pantalla por unidad (16·scale × 10·scale). */
export function clawdSvg(mode: ClawdMode, scale = 3): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CLAWD_W} ${CLAWD_H}" width="${CLAWD_W * scale}" height="${CLAWD_H * scale}" shape-rendering="crispEdges" overflow="visible" class="${mode}">`,
    `<style>${STYLE}</style>`,
    parts(),
    '</svg>',
  ].join('')
}

const METAL = '#b7bec8'
const WOOD = '#a0764a'
const SCREEN = '#141414'
const TERM = '#7ee787'
const DOT = '#cfe0ff'

const r = (x: number, y: number, w: number, h: number, fill: string, cls = '') =>
  `<rect${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

/** Lo que sostiene Clawd en cada tarea, y hacia dónde mira. */
const TASKS: Record<WorkTask, { look?: readonly [number, number]; props: string }> = {
  walk: { props: '' },
  think: {
    look: [0, -0.6], // mira hacia arriba
    props: [r(5.5, -3, 1, 1, DOT, 'dot d1'), r(7.5, -3.6, 1, 1, DOT, 'dot d2'), r(9.5, -3, 1, 1, DOT, 'dot d3')].join(''),
  },
  read: {
    look: [0.6, 0.2],
    props: [
      '<g class="lupa">',
      r(17, 0.6, 1, 0.5, METAL), // aro
      r(16.5, 1.1, 0.5, 2, METAL),
      r(18, 1.1, 0.5, 2, METAL),
      r(17, 3.1, 1, 0.5, METAL),
      r(17, 1.1, 1, 2, '#9fc3ff'), // cristal
      r(18.4, 3.5, 0.7, 0.7, WOOD), // mango
      r(19, 4.1, 0.7, 0.7, WOOD),
      r(19.6, 4.7, 0.7, 0.7, WOOD),
      '</g>',
    ].join(''),
  },
  edit: {
    look: [0.6, 0.4],
    props: ['<g class="hammer">', r(17.6, 1.4, 0.8, 4.4, WOOD), r(16.4, 0.2, 3.2, 1.4, METAL), '</g>'].join(''),
  },
  shell: {
    look: [0.6, 0],
    props: [
      r(16.2, 0, 6, 4.6, METAL), // marco
      r(16.7, 0.5, 5, 3.6, SCREEN), // pantalla
      r(17.2, 1.2, 0.5, 0.5, TERM), // ">"
      r(17.7, 1.7, 0.5, 0.5, TERM),
      r(17.2, 2.2, 0.5, 0.5, TERM),
      r(18.6, 2.5, 1.2, 0.4, TERM, 'cur'), // cursor "_"
      r(18.9, 4.6, 0.6, 1.2, METAL), // pie
      r(18, 5.8, 2.4, 0.5, METAL),
    ].join(''),
  },
  write: {
    look: [0.6, 0.4],
    props: [
      r(16.4, 0.4, 4.8, 6, PAGE), // papelito
      r(17, 1.4, 3.6, 0.5, INK, 'ln ln1'),
      r(17, 2.8, 3.6, 0.5, INK, 'ln ln2'),
      r(17, 4.2, 3.6, 0.5, INK, 'ln ln3'),
    ].join(''),
  },
}

const ALT_TASK: Record<WorkTask, string> = {
  walk: 'Clawd caminando',
  think: 'Clawd pensando',
  read: 'Clawd buscando con una lupa',
  edit: 'Clawd martillando',
  shell: 'Clawd tecleando en su pantallita',
  write: 'Clawd escribiendo en un papelito',
}

export const workerAlt = (task: WorkTask) => ALT_TASK[task]

/** El Clawd del chat con lo que está haciendo: 24×15 unidades, con sitio para su herramienta. */
export function workerSvg(task: WorkTask, scale = 1.6): string {
  const { look, props } = TASKS[task]
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -5 24 15" width="${24 * scale}" height="${15 * scale}" shape-rendering="crispEdges" class="${task}">`,
    `<style>${STYLE}</style>`,
    parts(look, props),
    '</svg>',
  ].join('')
}

const READS = /^(Read|Grep|Glob|LS|NotebookRead|WebFetch|WebSearch|ToolSearch)$/
const EDITS = /^(Edit|MultiEdit|Write|NotebookEdit)$/
const SHELLS = /^(Bash|PowerShell|BashOutput|KillShell)$|terminal/i

/** Qué hace Clawd según el momento del turno y la herramienta en curso. */
export function taskFor(mode: string, tool?: string): WorkTask {
  if (mode === 'thinking' || mode === 'requesting') return 'think'
  if (mode === 'responding') return 'write'
  if (!tool) return 'walk'
  if (READS.test(tool) || /^mcp__.*(read|get|list|search|find|fetch|query)/i.test(tool)) return 'read'
  if (EDITS.test(tool)) return 'edit'
  if (SHELLS.test(tool)) return 'shell'
  return 'walk'
}

export type ClawdPlace = {
  /**
   * Píxeles desde el centro de la ventana hasta el borde izquierdo de Clawd
   * (positivo, a la derecha). La barra del prompt va centrada, así que anclar al
   * centro la sigue aunque la ventana cambie de ancho.
   */
  dx: number
  /** Píxeles desde el borde inferior de la ventana hasta las patas de Clawd. */
  bottom: number
  /** Píxeles de pantalla por unidad de la rejilla. */
  scale: number
}

// Medido en la app (ventana maximizada, barra lateral abierta): las patas sobre el
// borde superior de la barra del prompt y Clawd metido un poco desde su esquina derecha.
// Al 80% (escala 2.4) con el borde derecho en el mismo sitio, y 4 px más arriba.
export const DEFAULT_PLACE: ClawdPlace = { dx: 429, bottom: 86, scale: 2.4 }

/**
 * La escena del fondo: transparente, con Clawd anclado abajo y al centro a un
 * tamaño fijo en píxeles, sea cual sea el tamaño de la ventana. Como el fondo
 * queda detrás de la barra del prompt, bajar a Clawd lo esconde tras ella.
 */
export type SceneOptions = {
  /** Efecto de una sola vez. */
  effect?: ClawdEffect
  /** Píxeles extra hacia arriba: lo que creció la barra del prompt. */
  lift?: number
  /** Mientras escribes, hacia dónde miran los ojos (0 a 3, ver GAZE). */
  gaze?: number
  /** Lo que lleva según la hora. */
  accessory?: Accessory
}

export function sceneSvg(mode: Exclude<ClawdMode, 'walk'>, place: ClawdPlace, opts: SceneOptions = {}): string {
  const h = CLAWD_H * place.scale
  const lift = opts.lift ?? 0
  const wear = opts.accessory ?? 'none'
  const classes = [mode, opts.effect, wear === 'none' ? undefined : wear].filter(Boolean).join(' ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="${classes}">`,
    `<style>${STYLE}</style>`,
    // ancla abajo en el centro; Clawd se dibuja hacia arriba, a dx del centro
    '<svg x="50%" y="100%" overflow="visible">',
    `<g transform="translate(${place.dx} ${-(place.bottom + lift + h)}) scale(${place.scale})" shape-rendering="crispEdges">`,
    parts(mode === 'typing' ? GAZE[Math.max(0, Math.min(GAZE.length - 1, opts.gaze ?? 0))] : undefined, '', wear),
    '</g></svg></svg>',
  ].join('')
}

/** El accesorio de una hora del día (0 a 23, hora local). */
export function accessoryFor(hour: number): Accessory {
  if (hour >= 6 && hour < 12) return 'coffee'
  if (hour >= 12 && hour < 18) return 'none'
  return 'nightcap'
}

/** Milisegundos hasta el próximo cambio de accesorio (6:00, 12:00 o 18:00 locales). */
export function msToNextChange(now: Date): number {
  const next = new Date(now)
  const h = now.getHours()
  const target = h < 6 ? 6 : h < 12 ? 12 : h < 18 ? 18 : 30 // 30 = las 6:00 de mañana
  next.setHours(target, 0, 0, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}

// La barra del prompt crece con el texto: ~22 px por renglón extra, hasta ~10
// renglones (después hace scroll). Para saber cuándo crece, simulamos cómo corta
// los renglones: por palabras completas y con el ancho de cada letra (en "em", la
// unidad de la fuente). Medido en la app (dos muestras dan 15.5 px por em, y el
// modelo acierta el corte real de un renglón): el texto de la barra tiene ~679 px,
// o sea ~43.8 em por renglón. `/clawd ancho` lo afina en %.
export const LINE_EM = 43.8
export const LINE_PX = 22
export const MAX_LINES = 10

/** Ancho aproximado de una letra, en em, para una fuente sans como la de la app. */
export function charEm(ch: string): number {
  if (ch === ' ') return 0.27
  if (ch === '\t') return 1.08
  if ("il.,:;'|!¡".includes(ch)) return 0.25
  if ('frtj()[]{}/\\"-'.includes(ch)) return 0.34
  if (ch === 'm' || ch === 'w') return 0.78
  if (ch === 'M' || ch === 'W') return 0.88
  if (ch === 'I') return 0.3
  if (/[0-9]/.test(ch)) return 0.55
  if (/[A-ZÁÉÍÓÚÑÜ]/.test(ch)) return 0.62
  if (/[a-záéíóúñü]/.test(ch)) return 0.5
  if ((ch.codePointAt(0) ?? 0) > 0x2000) return 1 // emojis y otros símbolos anchos
  return 0.55
}

export function textWidthEm(text: string): number {
  let w = 0
  for (const ch of text) w += charEm(ch)
  return w
}

export const lineEm = (widthPct = 100) => (LINE_EM * widthPct) / 100

export type VisualLine = { start: number; end: number }

/**
 * Corta el texto en renglones como la barra: en cada salto de línea y, cuando una
 * palabra no cabe, la pasa entera al renglón siguiente (los espacios del final no
 * cuentan). Una palabra más ancha que el renglón se parte donde haga falta.
 */
export function wrapLines(text: string, widthPct = 100): VisualLine[] {
  const max = lineEm(widthPct)
  const lines: VisualLine[] = []
  let offset = 0
  for (const para of text.split('\n')) {
    let start = offset
    let width = 0
    // palabras con sus espacios detrás: "hola " "mundo"
    for (const m of para.matchAll(/[^ ]+ *| +/g)) {
      const token = m[0]
      const at = offset + (m.index ?? 0)
      const word = token.replace(/ +$/, '')
      const wordW = textWidthEm(word)
      if (width > 0 && width + wordW > max) {
        lines.push({ start, end: at })
        start = at
        width = 0
      }
      if (wordW > max) {
        // palabra larguísima: se parte por letras
        let i = 0
        for (const ch of word) {
          const cw = charEm(ch)
          if (width > 0 && width + cw > max) {
            lines.push({ start, end: at + i })
            start = at + i
            width = 0
          }
          width += cw
          i += ch.length
        }
        width += textWidthEm(token.slice(word.length))
      } else {
        width += textWidthEm(token)
      }
    }
    lines.push({ start, end: offset + para.length })
    offset += para.length + 1
  }
  return lines
}

/** Cuántos renglones ocupa el borrador en la barra. */
export function promptLines(text: string, widthPct = 100): number {
  return Math.min(MAX_LINES, Math.max(1, wrapLines(text, widthPct).length))
}

/** Cuánto sube Clawd para seguir parado sobre la barra. */
export function liftFor(lines: number): number {
  return (Math.min(MAX_LINES, Math.max(1, lines)) - 1) * LINE_PX
}
