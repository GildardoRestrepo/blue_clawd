import type { EngineInterface, Register, ThemeColors, ThemeSetArgs } from 'claude-code'

import {
  accessoryFor,
  DEFAULT_PLACE,
  msToNextChange,
  type Accessory,
  gazeFor,
  liftFor,
  promptLines,
  sceneSvg,
  taskFor,
  workerAlt,
  workerSvg,
  type ClawdEffect,
  type ClawdPlace,
  type WorkTask,
} from './clawd'
import { makeColors } from './make-colors.js'

// Solo el acento pasa a azul: los grises (tema oscuro incluido) siguen siendo los de la app.
const { theme } = makeColors({ label: 'Azul', roles: { accent: '#2f7cf6' } })

const accentOnly = (mode: 'light' | 'dark') =>
  Object.fromEntries(Object.entries(theme.inputs[mode] ?? {}).filter(([k]) => k.startsWith('role-accent')))

export const COLORS: ThemeColors = { ...theme, inputs: { light: accentOnly('light'), dark: accentOnly('dark') } }
export const SCENE = 'clawd'
// Clawd vive en el fondo (sin contenedor) y el fondo queda transparente, sin velo.
const LOOK: ThemeSetArgs = { colors: COLORS, backdrop: { scene: SCENE, glass: false } }

// Cada pose del Clawd del chat, dibujada una sola vez.
const WORKER: Record<WorkTask, string> = {
  walk: workerSvg('walk'),
  think: workerSvg('think'),
  read: workerSvg('read'),
  edit: workerSvg('edit'),
  shell: workerSvg('shell'),
  write: workerSvg('write'),
}
// v3: Clawd al 80% y un poco más arriba. v2 (desde el centro, tamaño entero) se migra.
const PLACE_KEY = 'place-v3'
const LEGACY_KEY = 'place-v2'
const LIMITS = { dx: [-3000, 3000], bottom: [0, 2000], scale: [1, 8] } as const

export function clampPlace(p: Partial<ClawdPlace>): ClawdPlace {
  const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number, digits = 0) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, Math.round(v * 10 ** digits) / 10 ** digits))
      : d
  return {
    dx: clamp(p.dx, LIMITS.dx, DEFAULT_PLACE.dx),
    bottom: clamp(p.bottom, LIMITS.bottom, DEFAULT_PLACE.bottom),
    scale: clamp(p.scale, LIMITS.scale, DEFAULT_PLACE.scale, 1), // admite un decimal: 2.4
  }
}

/** De v2 a v3: 80% del tamaño con el borde derecho en su sitio, y 4 px más arriba. */
export function migrateV2(p: ClawdPlace): ClawdPlace {
  const scale = Math.round(p.scale * 0.8 * 10) / 10
  return clampPlace({ dx: p.dx + 16 * (p.scale - scale), bottom: p.bottom + 4, scale })
}

const asPlace = (v: unknown) => (typeof v === 'object' && v !== null ? clampPlace(v as Partial<ClawdPlace>) : undefined)

async function readPlace($: EngineInterface): Promise<ClawdPlace> {
  const current = asPlace(await $.store.get(PLACE_KEY))
  if (current) return current
  // Una posición ajustada a mano con la versión anterior se conserva, ya migrada.
  const legacy = asPlace(await $.store.get(LEGACY_KEY))
  if (!legacy) return DEFAULT_PLACE
  const migrated = migrateV2(legacy)
  await $.store.set(PLACE_KEY, migrated)
  return migrated
}

const USAGE =
  'Uso: /clawd hola  ·  /clawd accesorio cafe|gorro|nada|auto  ·  /clawd arriba|abajo|izquierda|derecha <px>  ·  /clawd tamaño <1-8, admite decimales>  ·  /clawd ancho <70-130> (% del renglón: menos = sube antes)  ·  /clawd reset  ·  /clawd (muestra la posición)'

// Ancho del renglón que usa la simulación de la barra, en % de lo medido.
const WRAP_KEY = 'wrap-pct'
export const clampWrap = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(130, Math.max(70, Math.round(v))) : 100

// Accesorio: "auto" sigue la hora; /clawd accesorio cafe|gorro|nada lo fija.
const WEAR_KEY = 'accessory'
export type WearChoice = Accessory | 'auto'
const WEAR_WORDS: Record<string, WearChoice> = {
  auto: 'auto',
  cafe: 'coffee',
  café: 'coffee',
  gorro: 'nightcap',
  nada: 'none',
}
export const parseWear = (word: string): WearChoice | undefined => WEAR_WORDS[word.trim().toLowerCase()]
const isWear = (v: unknown): v is WearChoice => v === 'auto' || v === 'coffee' || v === 'none' || v === 'nightcap'
const WEAR_NAME: Record<Accessory, string> = { coffee: 'su café', none: 'nada', nightcap: 'su gorro de dormir' }

/** El ancho guardado; si no se puede leer, el medido (nunca impide poner el tema). */
async function readWrap($: EngineInterface): Promise<number> {
  try {
    return clampWrap(await $.store.get(WRAP_KEY))
  } catch {
    return 100
  }
}

/** Aplica los argumentos de /clawd a una posición. Devuelve undefined si no los entiende. */
export function movePlace(place: ClawdPlace, args: string): ClawdPlace | undefined {
  const [verb = '', amount] = args.trim().toLowerCase().split(/\s+/)
  const n = amount === undefined ? 10 : Number(amount)
  if (verb === 'reset') return DEFAULT_PLACE
  if (!Number.isFinite(n)) return undefined
  switch (verb) {
    case 'arriba':
      return clampPlace({ ...place, bottom: place.bottom + n })
    case 'abajo':
      return clampPlace({ ...place, bottom: place.bottom - n })
    case 'izquierda':
      return clampPlace({ ...place, dx: place.dx - n })
    case 'derecha':
      return clampPlace({ ...place, dx: place.dx + n })
    case 'tamaño':
    case 'tamano':
      return amount === undefined ? undefined : clampPlace({ ...place, scale: n })
    default:
      return undefined
  }
}

const describe = (p: ClawdPlace) =>
  `Clawd está a ${p.dx}px a la derecha del centro y ${p.bottom}px del borde inferior, tamaño ${p.scale}.`

export type BarMode = 'idle' | 'typing' | 'hide'

/** Qué hace el Clawd de la barra: se esconde mientras Claude trabaja; si no, te mira escribir o espera. */
export function barMode(working: boolean, typing: boolean): BarMode {
  return working ? 'hide' : typing ? 'typing' : 'idle'
}

const ALT: Record<BarMode, string> = {
  idle: 'Clawd esperando junto a la barra del prompt',
  typing: 'Clawd mirando lo que escribes',
  hide: 'Clawd escondido tras la barra mientras Claude trabaja',
}

// Estado del módulo (vuelve a empezar en cada recarga del mod).
let working = false // Claude trabaja en el hilo principal
let typing = false // hay un borrador en la caja del prompt
let lastDrawn: BarMode = 'hide' // al cargar, Clawd se asoma
let pending: ClawdEffect | undefined // efecto de una sola vez para el próximo dibujo
let lines = 1 // renglones del borrador: la barra crece con ellos
let gaze = 0 // hacia dónde mira mientras escribes (sigue al cursor, 0 a 3)
let wrapPct = 100 // ancho del renglón simulado (/clawd ancho)
let tool: string | undefined // la herramienta que Claude está usando ahora
let wearChoice: WearChoice = 'auto' // accesorio fijado a mano, o según la hora
let wearTimer: { cancel: () => void } | undefined // aviso del próximo cambio de hora

/** El accesorio que toca ahora: el fijado, o el de la hora local. */
async function currentWear($: EngineInterface): Promise<Accessory> {
  if (wearChoice !== 'auto') return wearChoice
  try {
    return accessoryFor(new Date(await $.clock.now()).getHours())
  } catch {
    return 'none' // sin reloj, Clawd tal cual
  }
}

/** Programa un redibujo justo al próximo cambio (6:00, 12:00, 18:00) y vuelve a programar. */
async function scheduleWearChange($: EngineInterface): Promise<void> {
  wearTimer?.cancel()
  const ms = msToNextChange(new Date(await $.clock.now()))
  wearTimer = $.clock.after(ms + 500, () => {
    $.ui.invalidate('ui.render')
    void scheduleWearChange($)
  })
}

type Change = Partial<{ working: boolean; typing: boolean; lines: number; gaze: number }>
const seen = () => `${barMode(working, typing)}:${lines}:${typing ? gaze : '-'}`

/** Redibuja el fondo solo cuando cambia algo que se ve, no en cada tecla. */
function setState($: EngineInterface, change: Change): void {
  const before = seen()
  working = change.working ?? working
  typing = change.typing ?? typing
  lines = change.lines ?? lines
  gaze = change.gaze ?? gaze
  if (seen() !== before) $.ui.invalidate('ui.render')
}

/** El borrador cambió: ¿hay texto?, ¿cuántos renglones ocupa? y ¿dónde está el cursor? */
function onDraft($: EngineInterface, text: string, cursor: number): void {
  setState($, {
    typing: text.trim() !== '',
    lines: promptLines(text, wrapPct),
    gaze: gazeFor(text, cursor, wrapPct),
  })
}

/** Qué efecto lleva el próximo dibujo: el pendiente, o asomarse si venía de esconderse. */
export function nextEffect(
  mode: BarMode,
  previous: BarMode,
  wanted: ClawdEffect | undefined,
): ClawdEffect | undefined {
  if (mode === 'hide') return undefined
  if (wanted === 'celebrate') return 'celebrate' // ya incluye asomarse
  if (previous === 'hide') return 'pop'
  return wanted
}

export const register: Register = on => {
  working = false
  typing = false
  lastDrawn = 'hide'
  pending = undefined
  lines = 1
  gaze = 0
  wrapPct = 100
  tool = undefined
  wearChoice = 'auto'
  wearTimer = undefined

  // Qué herramienta usa Claude, para que el Clawd del chat haga lo mismo.
  // Solo observa: siempre deja pasar la llamada tal cual.
  on('tool.call', async ($, e, next) => {
    const before = tool
    tool = e.tool
    if (before !== tool) $.ui.invalidate('ui.render')
    const result = await next(e)
    if (tool === e.tool) {
      tool = undefined
      $.ui.invalidate('ui.render')
    }
    return result
  }).catch(($, e, next) => next(e)) // un fallo de la animación nunca frena una herramienta

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'clawd', description: 'Mueve o redimensiona a Clawd (skin-azul)' })
    const set = await $.theme.set(LOOK)
    wrapPct = await readWrap($)
    try {
      const saved = await $.store.get(WEAR_KEY)
      wearChoice = isWear(saved) ? saved : 'auto'
      await scheduleWearChange($)
    } catch {
      // sin tienda o sin reloj: Clawd sigue la hora en cada dibujo, sin aviso programado
    }
    if (!set.isDrawn) $.ui.status(`skin-azul: ${set.reason}`)
    return next(e)
  })

  on('command.run', { command: 'clawd' }, async ($, e) => {
    const current = await readPlace($)
    if (e.args.trim() === '') return { text: `${describe(current)} Renglón al ${wrapPct}%.\n${USAGE}` }
    const acc = /^accesorio(?:\s+(\S+))?$/i.exec(e.args.trim())
    if (acc) {
      const choice = acc[1] === undefined ? undefined : parseWear(acc[1])
      if (!choice) return { text: 'Uso: /clawd accesorio cafe|gorro|nada|auto (auto: café de 6 a 12, nada de 12 a 18, gorro de 18 a 6)' }
      wearChoice = choice
      await $.store.set(WEAR_KEY, choice)
      $.ui.invalidate('ui.render')
      const now = await currentWear($)
      return { text: choice === 'auto' ? `Accesorio según la hora: ahora lleva ${WEAR_NAME[now]}.` : `Clawd lleva ${WEAR_NAME[now]} (fijo; /clawd accesorio auto para volver a la hora).` }
    }
    const ancho = /^ancho\s+(\S+)$/i.exec(e.args.trim())
    if (ancho) {
      wrapPct = clampWrap(Number(ancho[1]))
      await $.store.set(WRAP_KEY, wrapPct)
      return { text: `Renglón al ${wrapPct}%: Clawd subirá ${wrapPct < 100 ? 'antes' : wrapPct > 100 ? 'después' : 'según lo medido'}.` }
    }
    if (/^(hola|hi|saluda)$/i.test(e.args.trim())) {
      // la app no pasa los clics al fondo, así que el saludo va por comando
      if (working) return { text: 'Clawd está escondido mientras trabajo; salúdalo cuando termine.' }
      pending = 'poke'
      $.ui.invalidate('ui.render')
      return { text: 'Clawd te saluda 👋' }
    }
    const moved = movePlace(current, e.args)
    if (!moved) return { text: USAGE }
    await $.store.set(PLACE_KEY, moved)
    $.ui.invalidate('ui.render')
    return { text: describe(moved) }
  })

  on('turn.start', async ($, e, next) => {
    // al enviar, la caja queda vacía: ya no estás escribiendo
    if (e.agentId === undefined) setState($, { working: true, typing: false, lines: 1 })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      // terminé: Clawd celebra al asomarse (no si interrumpiste el turno)
      if (!e.isAborted) pending = 'celebrate'
      setState($, { working: false })
    }
    return done
  })

  // Escribes en la caja del prompt: Clawd sigue tu cursor mientras haya borrador.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    onDraft($, box.text, box.cursor)
    return box
  })

  on('prompt.change', async ($, e, next) => {
    onDraft($, e.text, e.cursor)
    return next(e)
  })

  // El fondo: solo Clawd, sobre la esquina superior derecha de la barra del prompt.
  // Mientras Claude trabaja se esconde tras la barra; al volver, se asoma.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) return next(e)
    const { Svg } = $.ui.resolve(e)
    const place = await readPlace($)
    const mode = barMode(working, typing)
    const effect = nextEffect(mode, lastDrawn, pending)
    lastDrawn = mode
    pending = undefined // cada efecto se ve una sola vez
    const accessory = await currentWear($)
    return <Svg source={sceneSvg(mode, place, { effect, lift: liftFor(lines), gaze, accessory })} alt={ALT[mode]} />
  })

  // La marca animada del turno, en azul: Clawd caminando junto a lo que hace Claude.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const { Box, Svg, Text } = $.ui.resolve(e)
    const words = e.props.message ?? e.props.word
    const task = taskFor(e.props.mode, tool)
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg source={WORKER[task]} alt={workerAlt(task)} width={38} height={24} />
        <Text>{`${words}${words.endsWith('…') ? '' : e.props.suffix}`}</Text>
      </Box>
    )
  })
}
