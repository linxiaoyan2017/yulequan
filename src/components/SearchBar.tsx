import { useState, useRef, useEffect } from 'react'
import type { StarNode } from '../types'

interface SearchBarProps {
  nodes: StarNode[]
  onSelect: (nodeId: string) => void
  onClear: () => void
  selectedId?: string
}

export default function SearchBar({ nodes, onSelect, onClear, selectedId }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? nodes.filter(n => n.name.includes(query.trim())).slice(0, 10)
    : []

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 已选中时显示名字
  function handleSelect(node: StarNode) {
    setQuery(node.name)
    setOpen(false)
    onSelect(node.id)
  }

  function handleClear() {
    setQuery('')
    setOpen(false)
    onClear()
    inputRef.current?.focus()
  }

  function highlightMatch(name: string) {
    if (!query.trim()) return <span>{name}</span>
    const idx = name.indexOf(query.trim())
    if (idx === -1) return <span>{name}</span>
    return (
      <span>
        {name.slice(0, idx)}
        <span style={{ color: '#00E5FF', fontWeight: 600 }}>{name.slice(idx, idx + query.length)}</span>
        {name.slice(idx + query.length)}
      </span>
    )
  }

  return (
    <div className="relative">
      <div
        className="flex items-center rounded-lg px-3 py-1.5 gap-2 min-w-[200px]"
        style={{
          background: 'rgba(13,18,32,0.8)',
          border: '1px solid rgba(0,229,255,0.25)',
          boxShadow: '0 0 8px rgba(0,229,255,0.08)',
        }}
      >
        <svg className="w-4 h-4 shrink-0" style={{ color: '#00E5FF', opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="搜索明星..."
          className="flex-1 text-sm outline-none bg-transparent min-w-0"
          style={{ color: '#E2E8F0', caretColor: '#00E5FF' }}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
        />
        {(query || selectedId) && (
          <button
            onClick={handleClear}
            className="text-lg leading-none shrink-0 transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B' }}
          >
            ×
          </button>
        )}
      </div>

      {/* 下拉建议 */}
      {open && query.trim() && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 left-0 right-0 rounded-xl overflow-hidden z-50"
          style={{
            background: 'rgba(13,18,32,0.97)',
            border: '1px solid rgba(0,229,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,229,255,0.1)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {filtered.length > 0 ? (
            filtered.map(node => (
              <button
                key={node.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={{ color: '#CBD5E1' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,229,255,0.07)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                onClick={() => handleSelect(node)}
              >
                <img
                  src={node.avatar}
                  alt={node.name}
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: '1px solid rgba(0,229,255,0.3)' }}
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${node.name}&background=0D1220&color=00E5FF` }}
                />
                <span className="text-sm">{highlightMatch(node.name)}</span>
                <span className="ml-auto text-xs" style={{ color: '#475569' }}>{node.drama_count}部</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-center" style={{ color: '#475569' }}>未找到该明星</div>
          )}
        </div>
      )}

    </div>
  )
}