/**
 * Simple HTML sanitizer that strips dangerous elements and attributes
 * while preserving safe formatting tags.
 */

// Tags allowed in comment HTML (from TipTap rich text editor)
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'div', 'sub', 'sup', 'hr'
])

// Attributes allowed on specific tags
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set(['class', 'style']),
  div: new Set(['class']),
  code: new Set(['class']),
  pre: new Set(['class']),
  p: new Set(['class']),
  '*': new Set(['class'])
}

/**
 * Sanitize HTML string by removing dangerous tags and attributes.
 * Keeps safe formatting tags and text content.
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove iframe, object, embed, form tags and their content
  sanitized = sanitized.replace(/<(iframe|object|embed|form)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
  // Also remove self-closing versions
  sanitized = sanitized.replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, '')

  // Remove event handler attributes (on*)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove javascript: and data: URLs from href/src/action attributes
  sanitized = sanitized.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""')
  sanitized = sanitized.replace(/(href|src|action)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '$1=""')

  // Remove style attributes that could contain expressions
  sanitized = sanitized.replace(/style\s*=\s*(?:"[^"]*expression\s*\([^"]*"|'[^']*expression\s*\([^']*')/gi, '')

  // Strip disallowed tags but keep their text content
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (ALLOWED_TAGS.has(tag)) {
      // Tag is allowed - but strip disallowed attributes
      return stripDisallowedAttributes(match, tag)
    }
    // Tag not allowed - remove it but keep inner text
    return ''
  })

  return sanitized
}

function stripDisallowedAttributes(tag: string, tagName: string): string {
  // Closing tags - keep as is
  if (tag.startsWith('</')) return tag

  // Get allowed attrs for this tag
  const tagAttrs = ALLOWED_ATTRS[tagName] || new Set<string>()
  const globalAttrs = ALLOWED_ATTRS['*'] || new Set<string>()
  const allowed = new Set([...tagAttrs, ...globalAttrs])

  // Replace the tag, keeping only allowed attributes
  return tag.replace(/\s+([a-z][a-z0-9-]*)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attrMatch, attrName) => {
    if (allowed.has(attrName.toLowerCase())) {
      return attrMatch
    }
    return ''
  })
}
