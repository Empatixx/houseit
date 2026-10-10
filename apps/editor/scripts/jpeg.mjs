const LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
]

const CHROMA = [
  17,
  18,
  24,
  47,
  99,
  99,
  99,
  99,
  18,
  21,
  26,
  66,
  99,
  99,
  99,
  99,
  24,
  26,
  56,
  99,
  99,
  99,
  99,
  99,
  47,
  66,
  99,
  99,
  99,
  99,
  99,
  99,
  ...Array(32).fill(99),
]

const ZIGZAG = (() => {
  const order = []
  for (let sum = 0; sum < 15; sum++) {
    const cells = []
    for (let y = 0; y < 8; y++) {
      const x = sum - y
      if (x >= 0 && x < 8) cells.push(y * 8 + x)
    }
    order.push(...(sum % 2 ? cells : cells.reverse()))
  }
  return order
})()

const COS = Array.from({ length: 64 }, (_, i) => {
  const u = i >> 3
  const x = i & 7
  return ((u === 0 ? Math.SQRT1_2 : 1) / 2) * Math.cos(((2 * x + 1) * u * Math.PI) / 16)
})

function scaled(table, quality) {
  const scale = quality < 50 ? 5000 / quality : 200 - quality * 2
  return table.map((t) => Math.max(1, Math.min(255, Math.floor((t * scale + 50) / 100))))
}

function dct(block, out) {
  const rows = new Float64Array(64)
  for (let y = 0; y < 8; y++) {
    for (let u = 0; u < 8; u++) {
      let sum = 0
      for (let x = 0; x < 8; x++) sum += COS[u * 8 + x] * block[y * 8 + x]
      rows[y * 8 + u] = sum
    }
  }
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0
      for (let y = 0; y < 8; y++) sum += COS[v * 8 + y] * rows[y * 8 + u]
      out[v * 8 + u] = sum
    }
  }
}

const category = (value) => {
  let size = 0
  let magnitude = Math.abs(value)
  while (magnitude) {
    size++
    magnitude >>= 1
  }
  return size
}

function huffman(frequencies) {
  const freq = [...frequencies, 1]
  if (!frequencies.some(Boolean)) freq[0] = 1
  const size = new Array(257).fill(0)
  const others = new Array(257).fill(-1)
  for (;;) {
    let v1 = -1
    let v2 = -1
    for (let i = 0; i < 257; i++) {
      if (freq[i] > 0 && (v1 < 0 || freq[i] <= freq[v1])) v1 = i
    }
    for (let i = 0; i < 257; i++) {
      if (i !== v1 && freq[i] > 0 && (v2 < 0 || freq[i] <= freq[v2])) v2 = i
    }
    if (v2 < 0) break
    freq[v1] += freq[v2]
    freq[v2] = 0
    size[v1]++
    while (others[v1] >= 0) {
      v1 = others[v1]
      size[v1]++
    }
    others[v1] = v2
    size[v2]++
    while (others[v2] >= 0) {
      v2 = others[v2]
      size[v2]++
    }
  }
  const bits = new Array(33).fill(0)
  for (let i = 0; i < 257; i++) if (size[i]) bits[size[i]]++
  for (let i = 32; i > 16; i--) {
    while (bits[i] > 0) {
      let j = i - 2
      while (bits[j] === 0) j--
      bits[i] -= 2
      bits[i - 1]++
      bits[j + 1] += 2
      bits[j]--
    }
  }
  let longest = 16
  while (bits[longest] === 0) longest--
  bits[longest]--
  const values = []
  for (let length = 1; length <= 32; length++) {
    for (let i = 0; i < 256; i++) if (size[i] === length) values.push(i)
  }
  return { bits: bits.slice(1, 17), values }
}

function canonical(table) {
  const codes = new Map()
  let code = 0
  let at = 0
  for (let length = 1; length <= 16; length++) {
    for (let n = 0; n < table.bits[length - 1]; n++) {
      codes.set(table.values[at++], { code, length })
      code++
    }
    code <<= 1
  }
  return { ...table, codes }
}

export function encodeJpeg(width, height, rgb, quality = 88) {
  const tables = [scaled(LUMA, quality), scaled(CHROMA, quality)]
  const across = Math.ceil(width / 8)
  const down = Math.ceil(height / 8)
  const blocks = []
  const sample = new Float64Array(64)
  const coeff = new Float64Array(64)
  const previous = [0, 0, 0]
  const counts = [
    new Array(256).fill(0),
    new Array(256).fill(0),
    new Array(256).fill(0),
    new Array(256).fill(0),
  ]

  for (let by = 0; by < down; by++) {
    for (let bx = 0; bx < across; bx++) {
      for (let c = 0; c < 3; c++) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const px = Math.min(width - 1, bx * 8 + x)
            const py = Math.min(height - 1, by * 8 + y)
            const i = (py * width + px) * 3
            const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]]
            const value =
              c === 0
                ? 0.299 * r + 0.587 * g + 0.114 * b
                : c === 1
                  ? -0.168736 * r - 0.331264 * g + 0.5 * b + 128
                  : 0.5 * r - 0.418688 * g - 0.081312 * b + 128
            sample[y * 8 + x] = value - 128
          }
        }
        dct(sample, coeff)
        const q = tables[c === 0 ? 0 : 1]
        const zz = new Int16Array(64)
        for (let k = 0; k < 64; k++) zz[k] = Math.round(coeff[ZIGZAG[k]] / q[ZIGZAG[k]])
        const dc = counts[c === 0 ? 0 : 1]
        const ac = counts[c === 0 ? 2 : 3]
        dc[category(zz[0] - previous[c])]++
        previous[c] = zz[0]
        let run = 0
        for (let k = 1; k < 64; k++) {
          if (zz[k] === 0) {
            run++
            continue
          }
          while (run > 15) {
            ac[0xf0]++
            run -= 16
          }
          ac[(run << 4) | category(zz[k])]++
          run = 0
        }
        if (run > 0) ac[0]++
        blocks.push(zz)
      }
    }
  }

  const huff = counts.map((frequencies) => canonical(huffman(frequencies)))
  const bytes = []
  const word = (n) => bytes.push((n >> 8) & 255, n & 255)
  word(0xffd8)
  word(0xffe0)
  word(16)
  bytes.push(0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0)
  word(1)
  word(1)
  bytes.push(0, 0)
  for (let t = 0; t < 2; t++) {
    word(0xffdb)
    word(67)
    bytes.push(t)
    for (let k = 0; k < 64; k++) bytes.push(tables[t][ZIGZAG[k]])
  }
  word(0xffc0)
  word(17)
  bytes.push(8)
  word(height)
  word(width)
  bytes.push(3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1)
  const classes = [0x00, 0x01, 0x10, 0x11]
  huff.forEach((table, t) => {
    word(0xffc4)
    word(19 + table.values.length)
    bytes.push(classes[t], ...table.bits, ...table.values)
  })
  word(0xffda)
  word(12)
  bytes.push(3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0)

  let buffer = 0
  let filled = 0
  const put = (code, length) => {
    for (let i = length - 1; i >= 0; i--) {
      buffer = (buffer << 1) | ((code >> i) & 1)
      filled++
      if (filled === 8) {
        bytes.push(buffer)
        if (buffer === 0xff) bytes.push(0)
        buffer = 0
        filled = 0
      }
    }
  }
  const emit = (table, symbol) => {
    const { code, length } = table.codes.get(symbol)
    put(code, length)
  }
  const extra = (value, size) => {
    if (size) put(value < 0 ? value + (1 << size) - 1 : value, size)
  }

  const last = [0, 0, 0]
  blocks.forEach((zz, n) => {
    const c = n % 3
    const dc = huff[c === 0 ? 0 : 1]
    const ac = huff[c === 0 ? 2 : 3]
    const diff = zz[0] - last[c]
    last[c] = zz[0]
    const size = category(diff)
    emit(dc, size)
    extra(diff, size)
    let run = 0
    for (let k = 1; k < 64; k++) {
      if (zz[k] === 0) {
        run++
        continue
      }
      while (run > 15) {
        emit(ac, 0xf0)
        run -= 16
      }
      const s = category(zz[k])
      emit(ac, (run << 4) | s)
      extra(zz[k], s)
      run = 0
    }
    if (run > 0) emit(ac, 0)
  })
  if (filled) put((1 << (8 - filled)) - 1, 8 - filled)
  word(0xffd9)
  return Buffer.from(bytes)
}
