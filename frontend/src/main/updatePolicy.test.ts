import { describe, expect, it } from 'vitest'
import { canDownloadUpdate, installOnStartup } from './updatePolicy'

describe('updatePolicy', () => {
  it('não baixa durante chamada (o upload do servidor é o mesmo da mídia)', () => {
    expect(canDownloadUpdate(true)).toBe(false)
    expect(canDownloadUpdate(false)).toBe(true)
  })

  it('instala direto quando a atualização já estava baixada ao abrir', () => {
    expect(installOnStartup({ msSinceStart: 5_000, inCall: false })).toBe(true)
  })

  it('com o app em uso há um tempo, só avisa (não reinicia sozinho)', () => {
    expect(installOnStartup({ msSinceStart: 10 * 60_000, inCall: false })).toBe(false)
  })

  it('nunca reinicia sozinho em chamada', () => {
    expect(installOnStartup({ msSinceStart: 1_000, inCall: true })).toBe(false)
  })
})
