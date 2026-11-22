import type { PromptEditInput } from 'claude-code'
import { expect, mock, test, type TestBody } from 'claude-code/testing'
import {
  accessoryFor,
  clawdSvg,
  msToNextChange,
  LINE_EM,
  DEFAULT_PLACE,
  GAZE,
  gazeFor,
  LINE_PX,
  liftFor,
  MAX_LINES,
  promptLines,
  READ_AFTER_S,
  sceneSvg,
  SLEEP_AFTER_S,
  taskFor,
  workerSvg,
  type WorkTask,
  wrapLines,
} from './clawd'
import { barMode, COLORS, migrateV2, movePlace, nextEffect, parseWear, SCENE } from './register'

const BACKDROP = {
  plugin: 'skin-azul',
  component: 'Backdrop',
  props: { scene: SCENE, plugin: 'skin-azul', glass: false },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const SPIN = {
  plugin: 'skin-azul',
  component: 'Spinner',
  props: { word: 'Creating notes.md', message: null, suffix: '…', mode: 'tool-use' },
} as const

// Lo que dibuja el motor cuando el mod pasa, y una tienda en memoria.
function engine(on: Parameters<TestBody>[1]) {
  const store = new Map<string, unknown>()
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>motor</Text>
  })
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  return store
}

test('el tema solo cambia el acento y pone el fondo de Clawd sin velo', async ($, on) => {
  for (const mode of ['light', 'dark'] as const) {
    const keys = Object.keys(COLORS.inputs[mode] ?? {})
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.every(k => k.startsWith('role-accent'))).toBe(true)
  }
  const sets: { backdrop?: unknown }[] = []
  on('theme.set', (_, e) => {
    sets.push(e)
    return { value: { isDrawn: true, requestId: 'tema' } }
  })
  on('command.register', () => ({ value: { command: 'clawd' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sets[0]?.backdrop).toEqual({ scene: SCENE, glass: false })
})

// Dibuja el fondo una vez y devuelve el alt y las clases de la escena.
async function drawBar($: Parameters<TestBody>[0]) {
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  await ui.unmount()
  const classes = /^<svg[^>]*class="([^"]*)"/.exec(String(svg?.props.source))?.[1]
  return { alt: svg?.props.alt, classes }
}

test('Clawd de la barra: se asoma, te mira escribir y se esconde mientras Claude trabaja', async ($, on) => {
  engine(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('prompt.edit', (_, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  // El kit levanta prompt.edit como una sesión aunque sus tipos no lo listen en $.prompt.
  const raise = ($.prompt as unknown as { edit: (e: PromptEditInput) => Promise<unknown> }).edit
  const type = (text: string, inputText: string) =>
    raise({ origin: { kind: 'composer' }, text, cursor: text.length, start: 0, end: text.length, inputText })

  // al cargar se asoma desde detrás de la barra, y luego espera sin repetirlo
  expect(await drawBar($)).toEqual({ alt: 'Clawd esperando junto a la barra del prompt', classes: 'idle pop' })
  expect((await drawBar($)).classes).toBe('idle')

  await type('', 'hola Clawd')
  expect(await drawBar($)).toEqual({ alt: 'Clawd mirando lo que escribes', classes: 'typing' })

  await type('hola Clawd', '')
  expect((await drawBar($)).classes).toBe('idle')

  await type('', 'arregla el bug')
  await $.turn.start({ text: 'arregla el bug', turnId: 't1' })
  expect(await drawBar($)).toEqual({ alt: 'Clawd escondido tras la barra mientras Claude trabaja', classes: 'hide' })

  const term = await $.ui.mount({ ...BACKDROP, surface: 'mobile' })
  expect((await term.find({ type: 'Text' }))?.text).toBe('motor')
  await term.unmount()
})

test('/clawd mueve a Clawd y la escena usa la nueva posición', async ($, on) => {
  engine(on)
  const moved = await $.command.run({ ...RUN, command: 'clawd', args: 'arriba 30' })
  expect(moved.text).toContain(`${DEFAULT_PLACE.bottom + 30}px del borde inferior`)

  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const h = 10 * DEFAULT_PLACE.scale
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('<svg x="50%" y="100%"')
  expect(source).toContain(`translate(${DEFAULT_PLACE.dx} ${-(DEFAULT_PLACE.bottom + 30 + h)})`)
  await ui.unmount()

  expect((await $.command.run({ ...RUN, command: 'clawd', args: 'volar' })).text).toContain('Uso:')
})

test('una posición ajustada con la versión anterior pasa al 80% y 4 px más arriba', async ($, on) => {
  const store = engine(on)
  store.set('place-v2', { dx: 400, bottom: 90, scale: 3 })
  const shown = await $.command.run({ ...RUN, command: 'clawd', args: '' })
  expect(shown.text).toContain('410px a la derecha del centro y 94px del borde inferior, tamaño 2.4')
  expect(store.get('place-v3')).toEqual({ dx: 410, bottom: 94, scale: 2.4 })
  // la posición por defecto es la medida en la app, ya migrada
  expect(migrateV2({ dx: 419, bottom: 82, scale: 3 })).toEqual(DEFAULT_PLACE)
})

test('nextEffect: celebrar al volver, asomarse, saludar', async () => {
  expect(nextEffect('idle', 'hide', 'celebrate')).toBe('celebrate')
  expect(nextEffect('idle', 'hide', undefined)).toBe('pop')
  expect(nextEffect('idle', 'idle', 'poke')).toBe('poke')
  expect(nextEffect('typing', 'idle', undefined)).toBeUndefined()
  expect(nextEffect('hide', 'idle', 'poke')).toBeUndefined()
})

test('renglones del borrador: saltos, ajuste de línea y tope', async () => {
  expect(promptLines('')).toBe(1)
  expect(promptLines('hola')).toBe(1)
  expect(promptLines('a\nb\nc')).toBe(3)
  expect(promptLines('x'.repeat(181))).toBe(3) // 'x' = 0.55 em: 99.6 em → 3 renglones
  expect(promptLines('\n'.repeat(50))).toBe(MAX_LINES)
  expect(liftFor(1)).toBe(0)
  expect(liftFor(3)).toBe(2 * LINE_PX)
})

test('wrapLines corta como la barra: palabras enteras, espacios finales y ancho de letra', async () => {
  const fill = 'a'.repeat(80) // 40 em
  // "abcdefgh" (4 em) no cabe tras 40 em + espacio: pasa entera al renglón siguiente
  const text = `${fill} abcdefgh`
  const lines = wrapLines(text)
  expect(lines.length).toBe(2)
  expect(text.slice(lines[1]!.start, lines[1]!.end)).toBe('abcdefgh')
  // los espacios al final no hacen crecer la barra
  expect(promptLines(`${'a'.repeat(87)}     `)).toBe(1)
  // las "i" son angostas y las "m" anchas: mismo número de letras, distinto renglón
  expect(promptLines('i'.repeat(150))).toBe(1)
  expect(promptLines('m'.repeat(150))).toBe(3)
  // la frase medida en la app: "eso" no cabía en un renglón de 593 px (38.26 em)
  const real = 'Me encanta el diseño pero sigue sin estar sobre la barra. Ajustemos la ubicación y con eso pasamos a las animaciones'
  const narrow = wrapLines(real, (100 * 38.26) / LINE_EM)
  expect(real.slice(narrow[1]!.start).startsWith('eso')).toBe(true)
  // /clawd ancho: un renglón más angosto hace subir antes
  expect(promptLines('a'.repeat(84), 90)).toBe(2)
  expect(promptLines('a'.repeat(84), 100)).toBe(1)
})

test('Clawd sube con la barra cuando el prompt pasa de un renglón', async ($, on) => {
  engine(on)
  on('prompt.edit', (_, e) => ({ text: e.inputText, cursor: e.inputText.length }))
  const raise = ($.prompt as unknown as { edit: (e: PromptEditInput) => Promise<unknown> }).edit
  const h = 10 * DEFAULT_PLACE.scale
  const translateOf = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    return /<g transform="translate\(([^)]*)\)/.exec(source)?.[1]
  }

  expect(await translateOf()).toBe(`${DEFAULT_PLACE.dx} ${-(DEFAULT_PLACE.bottom + h)}`)
  await raise({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'uno\ndos\ntres\ncuatro' })
  expect(await translateOf()).toBe(`${DEFAULT_PLACE.dx} ${-(DEFAULT_PLACE.bottom + 3 * LINE_PX + h)}`)
})

test('lectura, sueño y celebración están en la escena', async () => {
  const idle = sceneSvg('idle', DEFAULT_PLACE)
  expect(idle).toContain(`bookin 0.5s ease-out ${READ_AFTER_S}s forwards`)
  expect(idle).toContain('<g class="book">')
  expect(idle).toContain('class="flip"')
  expect(idle).toContain(`doze 1.2s ease-in ${SLEEP_AFTER_S}s forwards`)
  expect(idle.match(/class="z z[1-3]"/g)?.length).toBe(3)
  expect(idle.match(/class="spark s[1-6]"/g)?.length).toBe(6)
  expect(sceneSvg('idle', DEFAULT_PLACE, { effect: 'celebrate' })).toMatch(/^<svg[^>]*class="idle celebrate"/)
})

test('gazeFor: la mirada sigue la columna del cursor en su renglón', async () => {
  expect(gazeFor('', 0)).toBe(0)
  expect(gazeFor('hola', 4)).toBe(0)
  const line = 'a'.repeat(86) // 43 em: un renglón casi lleno
  expect(gazeFor(line, line.length)).toBe(GAZE.length - 1)
  expect(gazeFor(line, 46)).toBe(2) // un poco más de la mitad
  // al saltar de renglón vuelve a mirar a la izquierda
  expect(gazeFor(`${line}\nab`, line.length + 3)).toBe(0)
  // el ajuste de línea también reinicia la columna
  expect(gazeFor('a'.repeat(90), 90)).toBe(0)
})

test('mientras escribes, los ojos van hacia el cursor y /clawd hola lo hace saludar', async ($, on) => {
  engine(on)
  on('prompt.edit', (_, e) => ({ text: e.inputText, cursor: e.inputText.length }))
  const raise = ($.prompt as unknown as { edit: (e: PromptEditInput) => Promise<unknown> }).edit
  const eyesOf = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    return { classes: /^<svg[^>]*class="([^"]*)"/.exec(source)?.[1], eyes: /<g class="eyes"[^>]*>/.exec(source)?.[0] }
  }

  await eyesOf() // se asoma al cargar
  expect((await eyesOf()).eyes).toBe('<g class="eyes">') // esperando: mira con CSS

  await raise({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'hola' })
  expect((await eyesOf()).eyes).toBe(`<g class="eyes" transform="translate(${GAZE[0]![0]} ${GAZE[0]![1]})">`)

  const long = 'a'.repeat(86)
  await raise({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: long })
  expect((await eyesOf()).eyes).toBe(`<g class="eyes" transform="translate(${GAZE[3]![0]} ${GAZE[3]![1]})">`)

  await raise({ origin: { kind: 'composer' }, text: long, cursor: long.length, start: 0, end: long.length, inputText: '' })
  expect((await $.command.run({ ...RUN, command: 'clawd', args: 'hola' })).text).toContain('saluda')
  expect((await eyesOf()).classes).toBe('idle poke')
  expect((await eyesOf()).classes).toBe('idle')
})

test('barMode: trabajar manda sobre escribir', async () => {
  expect(barMode(false, false)).toBe('idle')
  expect(barMode(false, true)).toBe('typing')
  expect(barMode(true, true)).toBe('hide')
  expect(barMode(true, false)).toBe('hide')
})

test('movePlace: direcciones, tamaño, límites y reset', async () => {
  const p = DEFAULT_PLACE
  expect(movePlace(p, 'derecha 20')?.dx).toBe(p.dx + 20)
  expect(movePlace(p, 'izquierda')?.dx).toBe(p.dx - 10)
  expect(movePlace(p, 'izquierda 9000')?.dx).toBe(-3000)
  expect(movePlace(p, 'abajo 5000')?.bottom).toBe(0)
  expect(movePlace(p, 'tamaño 4')?.scale).toBe(4)
  expect(movePlace(p, 'tamaño 2.44')?.scale).toBe(2.4)
  expect(movePlace(p, 'tamaño 99')?.scale).toBe(8)
  expect(movePlace({ ...p, dx: 1 }, 'reset')).toEqual(DEFAULT_PLACE)
  expect(movePlace(p, 'arriba muchos')).toBeUndefined()
})

test('el spinner del escritorio muestra a Clawd y lo que hace Claude', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...SPIN, surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('Creating notes.md…')
  await ui.unmount()

  const term = await $.ui.mount({ ...SPIN, surface: 'terminal' })
  expect((await term.find({ type: 'Text' }))?.text).toBe('motor')
  await term.unmount()
})

test('taskFor: qué hace Clawd según el momento y la herramienta', async () => {
  expect(taskFor('thinking')).toBe('think')
  expect(taskFor('requesting')).toBe('think')
  expect(taskFor('responding')).toBe('write')
  expect(taskFor('tool-use', 'Read')).toBe('read')
  expect(taskFor('tool-use', 'Grep')).toBe('read')
  expect(taskFor('tool-use', 'WebFetch')).toBe('read')
  expect(taskFor('tool-use', 'mcp__drive__search_files')).toBe('read')
  expect(taskFor('tool-use', 'Edit')).toBe('edit')
  expect(taskFor('tool-use', 'Write')).toBe('edit')
  expect(taskFor('tool-use', 'Bash')).toBe('shell')
  expect(taskFor('tool-use', 'PowerShell')).toBe('shell')
  expect(taskFor('tool-use', 'mcp__terminal__run_in_terminal')).toBe('shell')
  expect(taskFor('tool-use', 'Agent')).toBe('walk')
  expect(taskFor('tool-use')).toBe('walk')
})

test('durante una herramienta, el Clawd del chat hace lo mismo; al terminar, vuelve a caminar', async ($, on) => {
  engine(on)
  const spinnerAlt = async (mode: 'thinking' | 'requesting' | 'responding' | 'tool-input' | 'tool-use') => {
    const ui = await $.ui.mount({ ...SPIN, props: { ...SPIN.props, mode }, surface: 'desktop' })
    const alt = (await ui.find({ type: 'Svg' }))?.props.alt
    await ui.unmount()
    return alt
  }
  const during: unknown[] = []
  on('tool.call', async () => {
    during.push(await spinnerAlt('tool-use'))
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(during).toEqual(['Clawd tecleando en su pantallita'])
  expect(await spinnerAlt('tool-use')).toBe('Clawd caminando')
  expect(await spinnerAlt('thinking')).toBe('Clawd pensando')
  expect(await spinnerAlt('responding')).toBe('Clawd escribiendo en un papelito')
})

test('mientras trabajo, Clawd se asoma cada tanto sobre el borde de la barra', async () => {
  const hidden = sceneSvg('hide', DEFAULT_PLACE)
  expect(hidden).toContain('.hide .all { animation: dive 0.35s ease-in forwards, peek 9s ease-in-out 2.5s infinite; }')
  // asoma lo justo: cabeza, ojos y pinzas (5 de 10 unidades), nunca entero
  expect(hidden).toContain('76%, 90% { transform: translateY(5px); opacity: 1; }')
})

test('las poses de trabajo: cada una con su herramienta, SVG puro', async () => {
  const marks: Record<WorkTask, string> = {
    walk: 'class="walk"',
    think: 'class="dot d3"',
    read: '<g class="lupa">',
    edit: '<g class="hammer">',
    shell: 'class="cur"',
    write: 'class="ln ln3"',
  }
  for (const [task, mark] of Object.entries(marks) as [WorkTask, string][]) {
    const svg = workerSvg(task)
    expect(svg).toContain(mark)
    expect(svg).toMatch(new RegExp(`^<svg[^>]*class="${task}"`))
    expect(svg).not.toMatch(/<image|<script|href|<!\[CDATA|\\/)
    expect(svg.length).toBeLessThan(131072)
  }
})

test('el dibujo sigue el logo: ojos pintados (sin máscara), brazos y 4 patas; SVG puro', async () => {
  for (const svg of [clawdSvg('idle'), workerSvg('walk'), sceneSvg('idle', DEFAULT_PLACE)]) {
    expect(svg.length).toBeLessThan(131072)
    expect(svg).not.toMatch(/<image|<script|href|<!\[CDATA|\\/)
    expect(svg).toContain('prefers-reduced-motion')
    expect(svg.match(/<rect class="eye" [^>]*fill="#262624"/g)?.length).toBe(2)
    expect(svg.match(/class="arm arm-[lr]"/g)?.length).toBe(2)
    expect(svg.match(/class="leg l[1-4]"/g)?.length).toBe(4)
    // las animaciones dentro de una máscara no siempre se repintan: ya no hay
    expect(svg).not.toContain('<mask')
    // parpadea de vez en cuando, con un doble parpadeo
    expect(svg).toContain('animation: blink 7s infinite')
    expect(svg).toContain('42%, 87.5%, 90.5% { transform: scaleY(0.1); }')
  }
})

test('accessoryFor: café de 6 a 12, nada de 12 a 18, gorro de 18 a 6', async () => {
  const at = (h: number) => accessoryFor(h)
  expect([5, 6, 11, 12, 17, 18, 23, 0].map(at)).toEqual([
    'nightcap',
    'coffee',
    'coffee',
    'none',
    'none',
    'nightcap',
    'nightcap',
    'nightcap',
  ])
  const ms = (h: number, m = 0) => msToNextChange(new Date(2026, 10, 22, h, m))
  expect(ms(5, 30)).toBe(30 * 60_000) // a las 6:00
  expect(ms(11)).toBe(60 * 60_000) // a las 12:00
  expect(ms(17, 59)).toBe(60_000) // a las 18:00
  expect(ms(20)).toBe(10 * 60 * 60_000) // a las 6:00 de mañana
})

test('la taza y el gorro se dibujan, y Clawd cambia solo al llegar las 12:00', async ($, on) => {
  engine(on)
  on('command.register', () => ({ value: { command: 'clawd' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'tema' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const clock = mock.clock(on, { now: new Date(2026, 10, 22, 11, 59, 30).getTime() })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const draw = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    return source
  }
  const morning = await draw()
  expect(morning).toMatch(/^<svg[^>]*class="idle pop coffee"/)
  expect(morning).toContain('<g class="mug">')

  await clock.advance(31_000) // pasan las 12:00
  const noon = await draw()
  expect(noon).toMatch(/^<svg[^>]*class="idle"/)
  expect(noon).not.toContain('<g class="mug">')

  await clock.set(new Date(2026, 10, 22, 18, 0, 1).getTime())
  expect(await draw()).toContain('class="pom"')
})

test('/clawd accesorio fija la taza o el gorro, y auto vuelve a la hora', async ($, on) => {
  const store = engine(on)
  mock.clock(on, { now: new Date(2026, 10, 22, 14, 0).getTime() }) // tarde: nada
  const run = (args: string) => $.command.run({ ...RUN, command: 'clawd', args })

  expect((await run('accesorio gorro')).text).toContain('gorro de dormir')
  expect(store.get('accessory')).toBe('nightcap')
  expect((await run('accesorio café')).text).toContain('su café')
  expect((await run('accesorio auto')).text).toContain('ahora lleva nada')
  expect((await run('accesorio sombrero')).text).toContain('Uso: /clawd accesorio')
  expect(parseWear('NADA')).toBe('none')
})
