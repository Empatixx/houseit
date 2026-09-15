export const nestedEntityKey = (collection: string, parent: string, id: string) =>
  `${collection}:${JSON.stringify([parent, id])}`

export const geometryEntityKey = (category: string, owner: string) =>
  `geometry:${JSON.stringify([category, owner])}`

export const openingCategory = (kind: 'door' | 'window' | 'assembly') =>
  ({ door: 'IFCDOOR', window: 'IFCWINDOW', assembly: 'IFCBUILDINGELEMENTPROXY' })[kind]
