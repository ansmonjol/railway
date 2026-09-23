import { describe, expect, it } from 'vitest'
import { generateName, slugify } from './names'

describe('slugify', () => {
  it.each([
    ['My Cool App', 'my-cool-app'],
    ['  --Hello__World--  ', 'hello-world'],
    ['Crème brûlée!', 'creme-brulee'],
    ['already-fine-123', 'already-fine-123'],
    ['!!!', ''],
  ])('turns %j into %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('caps the name at 63 characters', () => {
    expect(slugify('a'.repeat(80))).toBe('a'.repeat(63))
  })

  it('never ends with a hyphen after truncation', () => {
    expect(slugify(`${'x'.repeat(62)} tail`)).toBe('x'.repeat(62))
  })
})

describe('generateName', () => {
  it('builds whoami-<adjective>-<animal>', () => {
    expect(generateName()).toMatch(/^whoami-[a-z]+-[a-z]+$/)
  })

  it('avoids names that are already taken', () => {
    const first = generateName(new Set(), () => 0)
    const next = generateName(new Set([first]), () => 0)
    expect(next).not.toBe(first)
    expect(slugify(next)).toBe(next)
  })
})
