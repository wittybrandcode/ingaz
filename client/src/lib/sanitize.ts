import DOMPurify from 'dompurify'

export function sanitizeHTML(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'p', 'strong', 'em', 'img', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}
