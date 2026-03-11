import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (utils)', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', true && 'visible')).toBe('base visible')
  })

  it('merges tailwind classes with conflicting utilities', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('handles array of classes', () => {
    expect(cn(['a', 'b'])).toBe('a b')
  })

  it('handles object form', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c')
  })
})
