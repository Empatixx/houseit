import { shaftsOn, shaftWallParts } from '@houseit/geometry/connections'
import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
import { MM } from './plan-coordinates'

export function Shafts() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {shaftsOn(doc, level).flatMap((s) =>
        shaftWallParts(s).map((p) => (
          <PlanBody
            key={`${s.id}-${p.x}-${p.y}`}
            id={`shaft:${s.id}:${p.x}:${p.y}`}
            category={p.door ? 'IFCDOOR' : 'IFCWALL'}
            input={{
              kind: 'primitive',
              body: { kind: 'box', width: p.width, height: 30, depth: p.depth },
            }}
            colour={p.door ? '#a3a7aa' : '#343638'}
            transform={new Matrix4().makeTranslation(p.x * MM, 3, -p.y * MM)}
          />
        )),
      )}
    </>
  )
}
