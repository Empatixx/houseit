import { Matrix4 } from 'three'
import { useDocument, usePlanDoc } from '../store/store'
import { PlanBody } from './plan-body'
import { MM } from './plan-coordinates'

export function Columns() {
  const doc = usePlanDoc()
  const level = useDocument((state) => state.level)
  return (
    <>
      {(doc.levels[level]?.columns ?? []).map((c) => (
        <PlanBody
          key={c.id}
          id={`column:${level}:${c.id}`}
          category="IFCCOLUMN"
          input={{
            kind: 'primitive',
            body: { kind: 'box', width: c.width, height: 30, depth: c.depth },
          }}
          colour="#343638"
          transform={new Matrix4().makeTranslation(c.x * MM, 3, -c.y * MM)}
        />
      ))}
    </>
  )
}
