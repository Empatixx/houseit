import { RootProvider } from 'fumadocs-ui/provider/next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './global.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    template: '%s | houseit',
    default: 'houseit — a floor plan editor you drive through a coding agent',
  },
  description:
    'Describe a house in plain language; a coding agent turns it into commands over MCP and the plan redraws in the browser, in 2D and in 3D.',
  openGraph: {
    images: ['https://empatixx.github.io/houseit/logo.svg'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <body className="overflow-x-hidden">
        <RootProvider search={{ options: { type: 'static', api: '/houseit/api/search' } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
