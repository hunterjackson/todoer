import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../../../src/shared/utils/sanitizeHtml'

describe('sanitizeHtml', () => {
  it('should preserve safe formatting tags', () => {
    const html = '<p>Hello <strong>world</strong> <em>italic</em></p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('should preserve links with href', () => {
    const html = '<a href="https://example.com">Link</a>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('should preserve lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('should strip script tags and their content', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    expect(sanitizeHtml(html)).toBe('<p>Hello</p><p>World</p>')
  })

  it('should strip iframe tags and their content', () => {
    const html = '<p>Before</p><iframe src="evil.com">content</iframe><p>After</p>'
    expect(sanitizeHtml(html)).toBe('<p>Before</p><p>After</p>')
  })

  it('should strip event handler attributes', () => {
    const html = '<p onclick="alert(1)">Click me</p>'
    expect(sanitizeHtml(html)).toBe('<p>Click me</p>')
  })

  it('should strip onerror attributes', () => {
    const html = '<img onerror="alert(1)" src="x">'
    // img is not an allowed tag, so the whole tag is stripped
    expect(sanitizeHtml(html)).toBe('')
  })

  it('should strip javascript: URLs from href', () => {
    const html = '<a href="javascript:alert(1)">Click</a>'
    expect(sanitizeHtml(html)).toBe('<a href="">Click</a>')
  })

  it('should strip disallowed tags but keep text content', () => {
    const html = '<p>Hello <marquee>scrolling</marquee> world</p>'
    expect(sanitizeHtml(html)).toBe('<p>Hello scrolling world</p>')
  })

  it('should handle nested disallowed tags', () => {
    const html = '<form action="evil"><input type="text"><p>Safe</p></form>'
    // form is stripped including content, but the inner p might survive
    // Actually form stripping removes everything between form tags
    const result = sanitizeHtml(html)
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('should strip object and embed tags', () => {
    const html = '<object data="evil.swf">flash</object><embed src="evil.swf">'
    const result = sanitizeHtml(html)
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
  })

  it('should preserve class attributes on allowed tags', () => {
    const html = '<div class="rich-text"><p class="intro">Hello</p></div>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('should handle plain text without HTML', () => {
    const text = 'Just plain text with no tags'
    expect(sanitizeHtml(text)).toBe(text)
  })

  it('should handle empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('should strip multiple event handlers', () => {
    const html = '<p onmouseover="evil()" onload="bad()" onclick="worse()">Text</p>'
    expect(sanitizeHtml(html)).toBe('<p>Text</p>')
  })
})
