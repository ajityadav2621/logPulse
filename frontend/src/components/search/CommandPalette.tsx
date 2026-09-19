import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Boxes,
  Bookmark,
  CornerDownLeft,
  ScrollText,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { DOCS_URL, searchAll, type SearchGroup, type SearchItem } from '@/lib/api'
import { cn } from '@/lib/utils'

// ⌘K on Apple keyboards, Ctrl+K elsewhere — shown in the top-bar trigger.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
export const SEARCH_SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K'
export const SEARCH_SHORTCUT_ARIA = IS_MAC ? 'Meta+K' : 'Control+K'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 select-none items-center justify-center rounded border border-border bg-muted/40 px-1.5 font-sans text-[10px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  )
}

// Shown when the palette opens with no query typed — quick links first.
const SUGGESTIONS: { label: string; subtitle: string; href: string; external?: boolean; icon: LucideIcon }[] = [
  { label: 'Applications', subtitle: 'Registered apps and API keys', href: '/applications', icon: Boxes },
  { label: 'Incidents', subtitle: 'Open and resolved incidents', href: '/incidents', icon: AlertTriangle },
  { label: 'Alerts', subtitle: 'Threshold rules and trigger history', href: '/alerts', icon: Bell },
  { label: 'Saved Searches', subtitle: 'Your stored log queries', href: '/saved-searches', icon: Bookmark },
  { label: 'Developer Docs', subtitle: 'Guides, API reference, deployment', href: DOCS_URL, external: true, icon: BookOpen },
]

const KIND_ICONS: Record<SearchItem['kind'], LucideIcon> = {
  log: ScrollText,
  application: Boxes,
  incident: AlertTriangle,
  doc: BookOpen,
}

const LISTBOX_ID = 'command-palette-listbox'
const OPTION_PREFIX = 'command-palette-item-'
const SEARCH_DEBOUNCE_MS = 200

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const escButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function close() {
    onOpenChange(false)
  }

  // ---- open/close lifecycle: focus the input, restore the trigger on exit ----
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setGroups([])
      setHighlight(0)
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
    triggerRef.current?.focus?.()
    triggerRef.current = null
    return undefined
  }, [open])

  // ---- global trigger: ⌘K / Ctrl+K from anywhere in the app ----
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [open, onOpenChange])

  // ---- debounced search: 200ms, previous request cancelled on new input ----
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      abortRef.current?.abort()
      setGroups([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      searchAll(q, ctrl.signal)
        .then((res) => {
          if (ctrl.signal.aborted) return
          setGroups(res.groups)
          setHighlight(0)
          setLoading(false)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setGroups([])
          setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      // A newer keystroke supersedes whatever is in flight.
      abortRef.current?.abort()
    }
  }, [query, open])

  const hasQuery = query.trim() !== ''
  const rowCount = hasQuery ? groups.reduce((n, g) => n + g.items.length, 0) : SUGGESTIONS.length
  // Clamp so a stale highlight can never point past the list.
  const activeIndex = Math.min(highlight, Math.max(rowCount - 1, 0))

  // Running index of each group's first item, for flat keyboard navigation
  // across grouped rows.
  const groupOffsets = useMemo(() => {
    let acc = 0
    return groups.map((g) => {
      const offset = acc
      acc += g.items.length
      return offset
    })
  }, [groups])

  // Keep the highlighted row visible while arrowing through long lists.
  useEffect(() => {
    document.getElementById(OPTION_PREFIX + activeIndex)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, groups])

  function selectItem(item: SearchItem) {
    close()
    if (item.kind === 'doc') {
      // Docs live on the separate Docusaurus site.
      window.open(DOCS_URL + item.href, '_blank', 'noopener')
      return
    }
    if (item.kind === 'log') {
      // The log detail page renders from navigation state rather than a
      // per-log fetch — hand it the whole entry we already have.
      navigate(item.href, { state: item })
      return
    }
    navigate(item.href)
  }

  function selectSuggestion(suggestion: (typeof SUGGESTIONS)[number]) {
    close()
    if (suggestion.external) window.open(suggestion.href, '_blank', 'noopener')
    else navigate(suggestion.href)
  }

  function selectIndex(index: number) {
    if (!hasQuery) {
      const suggestion = SUGGESTIONS[index]
      if (suggestion) selectSuggestion(suggestion)
      return
    }
    let acc = 0
    for (const g of groups) {
      for (const item of g.items) {
        if (acc === index) {
          selectItem(item)
          return
        }
        acc++
      }
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, rowCount - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(Math.max(rowCount - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        selectIndex(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        // Focus trap: the input and the esc badge are the only tab stops.
        e.preventDefault()
        if (document.activeElement === inputRef.current) escButtonRef.current?.focus()
        else inputRef.current?.focus()
        break
    }
  }

  if (!open) return null

  return (
    // Backdrop: dims the entire app; clicking anywhere on it closes.
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onMouseDown={close} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        {/* Large input on top with the Esc badge in the corner */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim() === '') setHighlight(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="What are you searching for?"
            role="combobox"
            aria-expanded="true"
            aria-controls={LISTBOX_ID}
            aria-activedescendant={rowCount > 0 ? OPTION_PREFIX + activeIndex : undefined}
            aria-autocomplete="list"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
            className="h-12 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            ref={escButtonRef}
            type="button"
            onClick={close}
            aria-label="Close search"
            className="inline-flex h-5 items-center rounded border border-border bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            esc
          </button>
        </div>

        <div id={LISTBOX_ID} role="listbox" aria-label="Search results" className="scrollbar-thin max-h-[50vh] overflow-y-auto py-1">
          {!hasQuery ? (
            <div role="group" aria-label="Suggestions">
              <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Suggestions
              </p>
              {SUGGESTIONS.map((s, i) => (
                <Row
                  key={s.label}
                  id={OPTION_PREFIX + i}
                  icon={s.icon}
                  title={s.label}
                  subtitle={s.subtitle}
                  selected={i === activeIndex}
                  onSelect={() => selectSuggestion(s)}
                  onHover={() => setHighlight(i)}
                />
              ))}
            </div>
          ) : rowCount === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : `No results for “${query.trim()}”`}
            </p>
          ) : (
            groups.map((g, gi) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((item, ii) => {
                  const index = groupOffsets[gi] + ii
                  const Icon = KIND_ICONS[item.kind] ?? ScrollText
                  return (
                    <Row
                      key={item.kind + '-' + item.id}
                      id={OPTION_PREFIX + index}
                      icon={Icon}
                      title={item.title}
                      subtitle={item.subtitle}
                      selected={index === activeIndex}
                      onSelect={() => selectItem(item)}
                      onHover={() => setHighlight(index)}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> select
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

// One selectable row in the palette. onMouseDown preventDefault keeps focus
// on the input so the keyboard flow never breaks on hover-click.
function Row({
  id,
  icon: Icon,
  title,
  subtitle,
  selected,
  onSelect,
  onHover,
}: {
  id: string
  icon: LucideIcon
  title: string
  subtitle: string
  selected: boolean
  onSelect: () => void
  onHover: () => void
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm outline-none',
        selected ? 'bg-accent text-accent-foreground' : 'text-foreground'
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', selected ? 'text-accent-foreground' : 'text-muted-foreground')}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && (
          <div className={cn('truncate text-xs', selected ? 'text-accent-foreground/70' : 'text-muted-foreground')}>
            {subtitle}
          </div>
        )}
      </div>
      {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}
