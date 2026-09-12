import { createContext, useContext } from 'react'

const PlainContext = createContext(false)

export const Plain = PlainContext.Provider

export const usePlain = (): boolean => useContext(PlainContext)
