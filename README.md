# blue_clawd

Un mod para la **app de escritorio de Claude Code**: cambia el acento a azul y pone un **Clawd azul en pixel art**, dibujado a partir del logo de bloques que Claude Code muestra al iniciar, parado sobre la esquina superior derecha de la barra del prompt. Clawd reacciona a lo que pasa en la sesión.

## Qué hace Clawd

**En la barra del prompt**

| Momento | Clawd |
|---|---|
| Esperas | Respira, parpadea (a veces doble) y mira a los lados |
| 40 s sin cambios | Saca un librito y lee; pasa la página de vez en cuando |
| 5 min sin cambios | Guarda el libro y se duerme ("z z z") |
| Escribes | Sus ojos siguen tu cursor por el renglón, asiente y golpetea una pata |
| Tu prompt crece | Sube con la barra (simula el corte de renglones por palabras y ancho de letra) |
| Claude trabaja | Se esconde tras la barra y cada ~9 s se asoma por el borde |
| Claude termina | Sale de detrás de la barra, salta y suelta destellos |

**Según la hora** (local): de 6 a 12 tiene una taza de café humeante, de 12 a 18 va tal cual, y de 18 a 6 lleva un gorro de dormir.

**En el chat**, junto al estado del turno, Clawd hace lo mismo que Claude:

| Claude | Clawd |
|---|---|
| Piensa | Mira arriba con "…" |
| Lee o busca | Usa una lupa |
| Edita archivos | Martilla |
| Ejecuta comandos | Teclea en una pantallita `>_` |
| Escribe la respuesta | Escribe en un papelito |

Respeta "reducir movimiento" del sistema: Clawd queda quieto.

## Comandos

```
/clawd                                   posición actual y ayuda
/clawd hola                              Clawd salta y saluda
/clawd accesorio cafe|gorro|nada|auto    fija el accesorio o vuelve a la hora
/clawd arriba|abajo|izquierda|derecha N  mueve a Clawd N píxeles
/clawd tamaño N                          tamaño (1 a 8, admite decimales; por defecto 2.4)
/clawd ancho N                           afina cuándo sube con la barra (70–130 %)
/clawd reset                             vuelve a la posición medida
```

La posición por defecto está medida en una ventana maximizada con la barra lateral abierta y la pantalla al 150 %. Si en tu pantalla no queda justo sobre la barra, acomódalo con `/clawd`.

## Instalar

En una sesión de terminal de Claude Code:

```
/plugin install skin-azul --marketplace GildardoRestrepo/blue_clawd
```

Responde `y` para agregar el marketplace y elige el alcance de usuario.

Desde una shell:

```
claude plugin install skin-azul --marketplace GildardoRestrepo/blue_clawd
```

En la app de escritorio, donde `/plugin` no funciona: haz clic en **+** junto al cuadro de texto, luego **Plugins**, **Add marketplace** con `GildardoRestrepo/blue_clawd` y después **Add plugin**.

## Desarrollo

```
claude plugin validate .
claude plugin test .
```

El dibujo y las animaciones están en `hooks/clawd.ts` y la lógica en `hooks/register.tsx`. `hooks/make-colors.js` es el ayudante de paletas de Claude Code.

Licencia MIT.
