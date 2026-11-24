import { darkTheme, lightTheme } from '@/src/shared/config/themes'
import { fieldSurface } from '@/src/shared/ui/atoms/TextField.styles'
import { switchColors } from '@/src/shared/ui/molecules/ToggleRow'

// The failure this guards: a token change (Switch track, disabled opacity, a
// field edge) silently drops a control below the WCAG 1.4.11 3:1 non-text
// floor in one theme. Read from the real themes and the real mappings; glass
// is approximated as its tint over `background` (no ambient gradient).

type Rgba = [number, number, number, number]

function parse(color: string): Rgba {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16)
    const alpha = hex.length === 8 ? channel(6) / 255 : 1
    return [channel(0), channel(2), channel(4), alpha]
  }
  const parts = color
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .map(Number)
  return [parts[0], parts[1], parts[2], parts[3] ?? 1]
}

/** `top` drawn at `opacity` over an opaque `bottom`. */
function over(top: string, bottom: string, opacity = 1): string {
  const [r, g, b, a] = parse(top)
  const [br, bg, bb] = parse(bottom)
  const k = a * opacity
  const mix = (x: number, y: number) => Math.round(x * k + y * (1 - k))
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex(mix(r, br))}${hex(mix(g, bg))}${hex(mix(b, bb))}`
}

function luminance(color: string): number {
  const [r, g, b] = parse(color).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('%s theme', (_name, theme) => {
  const card = over(theme.glass.card, theme.colors.background)

  it('draws both Switch states at 3:1 or better (STYLE-1)', () => {
    const off = switchColors(theme, false)
    const on = switchColors(theme, true)
    expect(contrast(off.trackColor.false, card)).toBeGreaterThanOrEqual(3)
    expect(contrast(on.trackColor.true, card)).toBeGreaterThanOrEqual(3)
    expect(
      contrast(off.thumbColor, off.trackColor.false),
    ).toBeGreaterThanOrEqual(3)
    expect(contrast(on.thumbColor, on.trackColor.true)).toBeGreaterThanOrEqual(
      3,
    )
  })

  it('keeps disabled link labels at 3:1 or better (STYLE-2)', () => {
    for (const label of [
      theme.colors.muted,
      theme.colors.accent,
      theme.colors.danger,
    ]) {
      const dimmed = over(label, card, theme.opacity.disabled)
      expect(contrast(dimmed, card)).toBeGreaterThanOrEqual(3)
    }
  })

  it('edges input-shaped controls at 3:1 or better (STYLE-6)', () => {
    const edge = fieldSurface(theme).borderColor
    expect(contrast(edge, theme.colors.surfaceAlt)).toBeGreaterThanOrEqual(3)
    expect(contrast(edge, card)).toBeGreaterThanOrEqual(3)
  })
})
