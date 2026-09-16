import { writeFile } from 'node:fs/promises'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
}

const fabric = new MeshStandardMaterial({ color: '#66696b', roughness: 0.95, metalness: 0 })
fabric.name = 'body'
const feet = new MeshStandardMaterial({ color: '#292623', roughness: 0.85 })
feet.name = 'feet'

function seating(width, depth, seats, chaise = false) {
  const upholstered = [],
    legs = []
  function rounded(name, w, h, d, x, base, z, radius, turn = 0, crown = 0, leg = false) {
    let geometry = new RoundedBoxGeometry(w, h, d, 3, radius)
    if (crown) {
      const points = geometry.getAttribute('position')
      for (let i = 0; i < points.count; i++) {
        const px = points.getX(i),
          py = points.getY(i),
          pz = points.getZ(i)
        const fullness = Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - (pz / (d / 2)) ** 2)
        points.setY(i, py + Math.sign(py) * crown * fullness)
      }
      geometry = mergeVertices(geometry)
      geometry.computeVertexNormals()
      geometry = geometry.toNonIndexed()
    }
    geometry.rotateX(turn)
    geometry.translate(x, base + h / 2, z)
    geometry.userData = { name }
    ;(leg ? legs : upholstered).push(geometry)
  }
  const arm = seats === 1 ? 0.16 : 0.225
  const run = Math.min(depth, 0.965)
  const back = depth / 2
  const front = back - run
  const centre = (back + front) / 2
  const inner = width - arm * 2
  const gap = 0.014
  const seatWidth = (inner - gap * (seats + 1)) / seats
  rounded('upholstered base', width - 0.025, 0.275, run - 0.025, 0, 0.055, centre, 0.035)
  rounded('back frame', inner, 0.67, 0.15, 0, 0.06, back - 0.085, 0.03)
  for (const side of [-1, 1]) {
    rounded('wide low arm', arm, 0.53, run, (side * (width - arm)) / 2, 0.055, centre, 0.032)
    for (const z of [front + 0.1, back - 0.1])
      rounded(
        'recessed foot',
        0.085,
        0.06,
        0.085,
        side * (width / 2 - 0.11),
        0,
        z,
        0.008,
        0,
        0,
        true,
      )
  }
  for (let i = 0; i < seats; i++) {
    const x = -inner / 2 + gap + seatWidth / 2 + i * (seatWidth + gap)
    const extended = chaise && i === 0
    const cushionDepth = extended ? depth - 0.245 : run - 0.245
    const cushionZ = back - 0.22 - cushionDepth / 2
    if (extended) {
      rounded(
        'chaise base',
        seatWidth + 0.012,
        0.275,
        depth - run + 0.1,
        x,
        0.055,
        -run / 2 + 0.05,
        0.032,
      )
      for (const side of [-1, 1])
        rounded(
          'chaise foot',
          0.085,
          0.06,
          0.085,
          x + side * (seatWidth / 2 - 0.08),
          0,
          -depth / 2 + 0.085,
          0.008,
          0,
          0,
          true,
        )
    }
    rounded('seat cushion', seatWidth, 0.135, cushionDepth, x, 0.339, cushionZ, 0.043, 0, 0.013)
    rounded('back cushion', seatWidth, 0.4, 0.165, x, 0.435, back - 0.205, 0.043, 0.14, 0.007)
  }
  const group = new Group()
  for (const [parts, material] of [
    [upholstered, fabric],
    [legs, feet],
  ]) {
    const geometry = mergeGeometries(parts)
    group.add(new Mesh(mergeVertices(geometry), material))
    for (const part of parts) part.dispose()
    geometry.dispose()
  }
  return group
}

for (const [file, width, depth, seats, chaise] of [
  ['sofa-classic-two.glb', 1.702, 0.94, 2, false],
  ['sofa-classic-three.glb', 2.388, 0.965, 3, false],
  ['sofa-classic-chaise.glb', 3.023, 1.829, 3, true],
  ['armchair-classic.glb', 0.94, 0.838, 1, false],
]) {
  const group = seating(width, depth, seats, chaise)
  group.name = 'Houseit classic upholstered seating'
  group.userData = {
    author: 'Houseit',
    description:
      'Original geometry; broad arms and loose cushions, inspired by the user’s KIVIK reference.',
  }
  const bytes = await new GLTFExporter().parseAsync(group, { binary: true })
  await writeFile(new URL(`../public/models/${file}`, import.meta.url), Buffer.from(bytes))
  const size = new Box3().setFromObject(group).getSize(new Vector3())
  console.log(
    `${file}: ${bytes.byteLength} bytes; ${size
      .toArray()
      .map((v) => v.toFixed(3))
      .join(' × ')} m`,
  )
  group.traverse((node) => node.geometry?.dispose())
}
