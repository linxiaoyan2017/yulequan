import { useState } from 'react'
import Graph from 'graphology'
import { bidirectional } from 'graphology-shortest-path/unweighted'
import type { StarNode, DramaEdge } from '../types'

interface PathResult {
  nodeIds: string[]
  edgeKeys: string[]
  steps: Array<{ from: string; to: string; drama: string }>
}

interface PathFinderProps {
  nodes: StarNode[]
  edges: DramaEdge[]
  graph: Graph
  onPathFound: (result: PathResult | null) => void
  onClear: () => void
  visible: boolean
  onClose: () => void
}

export default function PathFinder({
  nodes,
  edges,
  graph,
  onPathFound,
  onClear,
  visible,
  onClose,
}: PathFinderProps) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [result, setResult] = useState<PathResult | null>(null)
  const [error, setError] = useState('')
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  if (!visible) return null

  const filteredFrom = fromQuery
    ? nodes.filter(n => n.name.includes(fromQuery)).slice(0, 8)
    : []
  const filteredTo = toQuery
    ? nodes.filter(n => n.name.includes(toQuery)).slice(0, 8)
    : []

  const fromNode = nodes.find(n => n.id === fromId)
  const toNode = nodes.find(n => n.id === toId)

  function getEdgeDrama(a: string, b: string): string {
    const edge = edges.find(e =>
      (e.source === a && e.target === b) || (e.source === b && e.target === a)
    )
    return edge ? `《${edge.dramas[0]}》` : ''
  }

  function handleFind() {
    setError('')
    setResult(null)
    if (!fromId || !toId) { setError('请选择两位明星'); return }
    if (fromId === toId) { setError('请选择不同的两位明星'); return }

    const path = bidirectional(graph, fromId, toId)
    if (!path || path.length === 0) {
      setError('暂无合作路径，他们还没有通过剧集相连 💔')
      onPathFound(null)
      return
    }

    const edgeKeys: string[] = []
    const steps: PathResult['steps'] = []
    for (let i = 0; i < path.length - 1; i++) {
      edgeKeys.push(`${path[i]}-${path[i + 1]}`)
      steps.push({
        from: path[i],
        to: path[i + 1],
        drama: getEdgeDrama(path[i], path[i + 1]),
      })
    }

    const r: PathResult = { nodeIds: path, edgeKeys, steps }
    setResult(r)
    onPathFound(r)
  }

  function handleClear() {
    setFromId(''); setToId('')
    setFromQuery(''); setToQuery('')
    setResult(null); setError('')
    onClear()
  }

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-2xl p-4 w-[580px] max-w-[calc(100vw-2rem)] z-40"
      style={{
        background: 'rgba(10,14,25,0.97)',
        border: '1px solid rgba(0,229,255,0.2)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(0,229,255,0.12)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: '#00E5FF', textShadow: '0 0 8px rgba(0,229,255,0.5)' }}>
          🔗 寻找剧缘
        </h3>
        <button
          onClick={onClose}
          className="text-xl transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
        >×</button>
      </div>

      <div className="flex items-center gap-2">
        {/* 起点选择 */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="起点明星..."
            value={fromQuery || fromNode?.name || ''}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'rgba(0,229,255,0.06)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#E2E8F0',
            }}
            onChange={e => { setFromQuery(e.target.value); setFromId(''); setFromOpen(true) }}
            onFocus={() => setFromOpen(true)}
          />
          {fromOpen && fromQuery && filteredFrom.length > 0 && (
            <div
              className="absolute bottom-full mb-1 left-0 right-0 rounded-xl overflow-hidden z-50"
              style={{
                background: 'rgba(10,14,25,0.97)',
                border: '1px solid rgba(0,229,255,0.18)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              {filteredFrom.map(n => (
                <button
                  key={n.id}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all"
                  style={{ color: '#CBD5E1' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,229,255,0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  onClick={() => { setFromId(n.id); setFromQuery(n.name); setFromOpen(false) }}>
                  <img src={n.avatar} alt={n.name} className="w-6 h-6 rounded-full object-cover"
                    style={{ border: '1px solid rgba(0,229,255,0.25)' }}
                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.name}&background=0D1220&color=00E5FF` }} />
                  {n.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="font-bold" style={{ color: '#A855F7' }}>──</div>

        {/* 终点选择 */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="终点明星..."
            value={toQuery || toNode?.name || ''}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'rgba(0,229,255,0.06)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#E2E8F0',
            }}
            onChange={e => { setToQuery(e.target.value); setToId(''); setToOpen(true) }}
            onFocus={() => setToOpen(true)}
          />
          {toOpen && toQuery && filteredTo.length > 0 && (
            <div
              className="absolute bottom-full mb-1 left-0 right-0 rounded-xl overflow-hidden z-50"
              style={{
                background: 'rgba(10,14,25,0.97)',
                border: '1px solid rgba(0,229,255,0.18)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              {filteredTo.map(n => (
                <button
                  key={n.id}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all"
                  style={{ color: '#CBD5E1' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,229,255,0.07)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  onClick={() => { setToId(n.id); setToQuery(n.name); setToOpen(false) }}>
                  <img src={n.avatar} alt={n.name} className="w-6 h-6 rounded-full object-cover"
                    style={{ border: '1px solid rgba(0,229,255,0.25)' }}
                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.name}&background=0D1220&color=00E5FF` }} />
                  {n.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleFind}
          className="shrink-0 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(168,85,247,0.2))',
            color: '#00E5FF',
            border: '1px solid rgba(0,229,255,0.4)',
            boxShadow: '0 0 12px rgba(0,229,255,0.2)',
          }}
        >
          寻找
        </button>
        {(fromId || toId || result) && (
          <button
            onClick={handleClear}
            className="shrink-0 text-xs px-2 transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
          >清除</button>
        )}
      </div>

      {/* 错误提示 */}
      {error && <p className="mt-2 text-xs text-center" style={{ color: '#F72585' }}>{error}</p>}

      {/* 路径结果 */}
      {result && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{
            background: 'rgba(0,229,255,0.05)',
            border: '1px solid rgba(0,229,255,0.18)',
          }}
        >
          <p className="text-xs mb-2" style={{ color: '#64748B' }}>
            相隔{' '}
            <span style={{ color: '#00E5FF', fontWeight: 700, textShadow: '0 0 6px rgba(0,229,255,0.6)' }}>
              {result.steps.length}
            </span>{' '}
            度
          </p>
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {result.steps.map((step, i) => {
              const fromStar = nodes.find(n => n.id === step.from)
              const toStar = nodes.find(n => n.id === step.to)
              return (
                <span key={i} className="flex items-center gap-1">
                  <span className="font-medium" style={{ color: '#E2E8F0' }}>{fromStar?.name}</span>
                  <span className="text-xs mx-0.5" style={{ color: '#A855F7' }}>{step.drama}</span>
                  <span style={{ color: '#00E5FF' }}>▶</span>
                  {i === result.steps.length - 1 && (
                    <span className="font-medium" style={{ color: '#E2E8F0' }}>{toStar?.name}</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}