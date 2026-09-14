export const nestedEntityKey = (collection: string, parent: string, id: string) =>
  `${collection}:${JSON.stringify([parent, id])}`
