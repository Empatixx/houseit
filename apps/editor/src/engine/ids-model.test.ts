// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runScript } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import * as OBC from '@thatopen/components'
import { SingleThreadedFragmentsModel } from '@thatopen/fragments'
import { expect, test } from 'vitest'
import { checkEntities, checkModel } from './ids-model'

const flat = () =>
  runScript(
    createEmptyDocument(),
    [
      'add-room --name byt --shape rectangle --width 9m --depth 7m --material natural-oak',
      'add-room --name ložnice --from byt --corner north-east --width 3.6m --depth 3.4m --material natural-oak --kind bedroom',
      'add-room --name wc --from byt --corner north-west --width 1.2m --depth 1.5m --material tile-white --kind half-bath',
      'add-opening --room ložnice --kind door --side south --width 800',
      'add-opening --room ložnice --kind window --side north --width 1200',
    ].join('\n'),
  )

test('every room and door becomes an IFC entity with the properties the norms ask about', () => {
  const entities = checkEntities(flat())
  const bedroom = entities.find((it) => it.name === 'ložnice')!
  expect(bedroom).toMatchObject({ category: 'IFCSPACE', set: 'Houseit_Space' })
  expect(bedroom.values).toMatchObject({ Kind: 'bedroom', Habitable: true, WindowCount: 1 })
  expect(entities.find((it) => it.name === 'wc')!.values.Habitable).toBe(false)
  const door = entities.find((it) => it.category === 'IFCDOOR')!
  expect(door.values.ClearWidth).toBe(800)
})

test('the check model links each entity to its property set the way IFC does', () => {
  const { buffer, owners } = checkModel(checkEntities(flat()))
  const model = new SingleThreadedFragmentsModel('ids', buffer, false)
  try {
    const [bedroom] = [...owners].find(([, owner]) => owner.name === 'ložnice')!
    const [item] = model.getItemsData([bedroom], {
      relations: { IsDefinedBy: { attributes: true, relations: true } },
    }) as Record<string, unknown>[]
    const set = (item!.IsDefinedBy as Record<string, { value: unknown }>[])[0]!
    expect(set.Name!.value).toBe('Houseit_Space')
  } finally {
    model.dispose()
  }
})

test('the Czech norms file is standard IDS the engine reads', () => {
  const xml = readFileSync(new URL('../../public/norms/cz-byty.ids', import.meta.url), 'utf8')
  const specifications = new OBC.Components().get(OBC.IDSSpecifications).load(xml)
  expect(specifications.map((it) => it.identifier)).toEqual([
    'CZ-OBYT-PLOCHA',
    'CZ-OBYT-VYSKA',
    'CZ-OBYT-OKNO',
    'CZ-DVERE-SIRKA',
  ])
})
