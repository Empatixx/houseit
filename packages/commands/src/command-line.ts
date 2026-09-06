export const quoted = (token: string) =>
  /[\s"'\\]/.test(token) || token === '' ? `"${token.replace(/(["\\])/g, '\\$1')}"` : token
