import { groundAsset } from './ground-appearance'

export type ArchiveAssetLoader = (url: string) => Promise<string>

const sources = new Map<string, Promise<string>>()
export const loadArchiveAsset: ArchiveAssetLoader = (url) => {
  if (url === 'houseit:ground') return Promise.resolve(groundAsset())
  if (url.startsWith('data:')) return Promise.resolve(url)
  const cached = sources.get(url)
  if (cached) return cached
  const result = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Archive asset ${url}: ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    return `data:${response.headers.get('content-type') ?? 'application/octet-stream'};base64,${btoa(binary)}`
  })
  sources.set(url, result)
  void result.catch(() => sources.delete(url))
  return result
}
