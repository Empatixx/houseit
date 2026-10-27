const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'

function words(key: string): number[] {
  return [0x811c9dc5, 0x01000193, 0x5bd1e995, 0x27d4eb2f].map((seed) => {
    let hash = seed >>> 0
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= hash >>> 13
    }
    return hash >>> 0
  })
}

export function ifcGuidOf(key: string): string {
  let bits = 0n
  for (const word of words(key)) bits = (bits << 32n) | BigInt(word)
  let text = ALPHABET[Number(bits >> 126n)]!
  for (let shift = 120n; shift >= 0n; shift -= 6n) text += ALPHABET[Number((bits >> shift) & 63n)]!
  return text
}
