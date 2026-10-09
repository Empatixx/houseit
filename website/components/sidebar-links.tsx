import { ExternalLink } from 'lucide-react'
import { GithubStars } from './github-stars'

const links = [
  { text: 'Releases', href: 'https://github.com/Empatixx/houseit/releases' },
  { text: 'Issues', href: 'https://github.com/Empatixx/houseit/issues' },
  { text: 'llms.txt', href: '/houseit/llms.txt' },
]

export function SidebarLinks() {
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <GithubStars className="w-full justify-center" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-fd-muted-foreground">
        {links.map((link) => (
          <a
            key={link.text}
            href={link.href}
            target={link.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 hover:text-fd-foreground"
          >
            {link.text}
            {link.href.startsWith('http') && <ExternalLink className="size-3" />}
          </a>
        ))}
      </div>
    </div>
  )
}
