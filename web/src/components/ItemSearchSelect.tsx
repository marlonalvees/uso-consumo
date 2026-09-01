import { useEffect, useRef, useState } from 'react'
import type { Item } from '../types'
import { normalizeText } from '../lib/text'
import { CloseIcon, SearchIcon } from './icons'

interface ItemSearchSelectProps {
  items: Item[]
  value: string
  onChange: (itemId: string) => void
  placeholder?: string
}

export default function ItemSearchSelect({ items, value, onChange, placeholder }: ItemSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedItem = items.find((item) => item.id === value) ?? null

  useEffect(() => {
    setQuery(selectedItem ? selectedItem.name : '')
  }, [selectedItem])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selectedItem ? selectedItem.name : '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, selectedItem])

  const normalizedQuery = normalizeText(query)
  const filteredItems =
    normalizedQuery && normalizedQuery !== normalizeText(selectedItem?.name ?? '')
      ? items.filter((item) => normalizeText(item.name).includes(normalizedQuery))
      : items

  function handleSelect(item: Item) {
    onChange(item.id)
    setQuery(item.name)
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setQuery('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
        <SearchIcon className="h-4 w-4" />
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (value) onChange('')
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Buscar produto...'}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
      />
      {(query || value) && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar"
          className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filteredItems.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum produto encontrado</li>
          ) : (
            filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-novamix-teal/10 ${
                    item.id === value ? 'bg-novamix-teal/5 font-medium text-novamix-teal-dark' : 'text-gray-900'
                  }`}
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    estoque: {item.stockQuantity} {item.packaging.name}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
