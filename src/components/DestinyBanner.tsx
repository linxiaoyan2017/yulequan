import { useState, useRef, useEffect, useCallback } from 'react'
import Graph from 'graphology'
import { bidirectional } from 'graphology-shortest-path/unweighted'
import type { StarNode, DramaEdge } from '../types'

export interface PathResult {
  nodeIds: string[]
  edgeKeys: string[]
  steps: Array<{ from: string; to: string; drama: string }>
}

interface StarSlotProps {
  label: string
  node: StarNode | null
  query: string
  open: boolean
  filtered: StarNode[]
  onQueryChange: (v: string) => void
  onSelect: (n: StarNode) => void
  onClear: () => void
  onFocus: () => void
  glowColor: 'cyan' | 'purple'
  pulsing: boolean // 是否在闪烁提示
}

function StarSlot({
  label, node, query, open, filtered,
  onQueryChange, onSelect, onClear, onFocus,
  glowColor, pulsing,
}: StarSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const cyan = '#00E5FF'
  const purple = '#A855F7'
  const color = glowColor === 'cyan' ? cyan : purple

  return (
    <div className="relative flex items-center gap-2 flex-1 min-w-0">
      {/* 头像圆圈 */}
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          border: `2px solid ${node ? color : 'rgba(255,255,255,0.15)'}`,
          boxShadow: node
            ? `0 0 12px ${color}88, 0 0 24px ${color}44`
            : pulsing
              ? `0 0 8px ${color}55`
              : 'none',
          animation: pulsing && !node ? 'destiny-pulse 1.4s ease-in-out infinite' : 'none',
          background: node ? 'transparent' : 'rgba(255,255,255,0.04)',
        }}
      >
        {node ? (
          <img
            src={node.avatar}
            alt={node.name}
            className="w-full h-full rounded-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${node.name}&background=0D1220&color=${glowColor === 'cyan' ? '00E5FF' : 'A855F7'}`
            }}
          />
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>✦</span>
        )}
      </div>

      {/* 输入框 / 已选名字 */}
      <div className="flex-1 min-w-0 relative">
        {node ? (
          <div
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color }}
          >
            <span className="truncate">{node.name}</span>
            <button
              onClick={onClear}
              className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-xs transition-all"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F72585' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)' }}
            >×</button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              placeholder={label}
              value={query}
              className="w-full text-sm outline-none bg-transparent truncate"
              style={{ color: '#CBD5E1', caretColor: color }}
              onChange={e => onQueryChange(e.target.value)}
              onFocus={onFocus}
            />
            {/* 下拉列表 */}
            {open && query && filtered.length > 0 && (
              <div
                ref={dropRef}
                className="absolute top-full mt-1 left-0 w-52 rounded-xl overflow-hidden z-50"
                style={{
                  background: 'rgba(10,14,25,0.98)',
                  border: `1px solid ${color}33`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 16px ${color}18`,
                  backdropFilter: 'blur(20px)',
                }}
              >
                {filtered.map(n => (
                  <button
                    key={n.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-all"
                    style={{ color: '#CBD5E1' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}12` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => onSelect(n)}
                  >
                    <img
                      src={n.avatar}
                      alt={n.name}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                      style={{ border: `1px solid ${color}44` }}
                      onError={e => {
                        (e.target as HTMLImageElement).src =
                          `https://ui-avatars.com/api/?name=${n.name}&background=0D1220&color=${glowColor === 'cyan' ? '00E5FF' : 'A855F7'}`
                      }}
                    />
                    <span className="truncate">{n.name}</span>
                  </button>
                ))}
              </div>
            )}
            {open && query && filtered.length === 0 && (
              <div
                className="absolute top-full mt-1 left-0 w-48 rounded-xl px-3 py-2 text-sm z-50"
                style={{
                  background: 'rgba(10,14,25,0.98)',
                  border: `1px solid ${color}22`,
                  color: '#475569',
                }}
              >
                未找到该明星
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// 中间连接线 SVG
function ConnectLine({ state }: { state: 'idle' | 'half' | 'active' | 'searching' | 'done' | 'notfound' }) {
  const lineId = 'destiny-line-grad'
  return (
    <div className="shrink-0 flex items-center" style={{ width: 120 }}>
      <svg width="120" height="24" viewBox="0 0 120 24" fill="none">
        <defs>
          <linearGradient id={lineId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        {state === 'idle' && (
          <line x1="8" y1="12" x2="112" y2="12"
            stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
            strokeDasharray="4 5"
            style={{ animation: 'destiny-dash-idle 2s linear infinite' }}
          />
        )}
        {state === 'half' && (
          <>
            <line x1="8" y1="12" x2="112" y2="12"
              stroke="rgba(0,229,255,0.4)" strokeWidth="2"
              strokeDasharray="6 4"
              style={{ animation: 'destiny-dash-flow 1s linear infinite' }}
            />
            <polygon points="106,8 114,12 106,16" fill="rgba(0,229,255,0.5)" />
          </>
        )}
        {(state === 'active' || state === 'searching') && (
          <>
            <line x1="8" y1="12" x2="112" y2="12"
              stroke={`url(#${lineId})`} strokeWidth="2.5"
              strokeDasharray="8 2"
              style={{ animation: 'destiny-dash-fast 0.4s linear infinite' }}
            />
            <polygon points="106,7 116,12 106,17" fill="#A855F7" />
            {state === 'searching' && (
              <circle cx="60" cy="12" r="4" fill="#00E5FF"
                style={{ animation: 'destiny-spark 0.6s ease-in-out infinite alternate' }}
              />
            )}
          </>
        )}
        {state === 'done' && (
          <>
            <line x1="8" y1="12" x2="112" y2="12"
              stroke={`url(#${lineId})`} strokeWidth="3"
              style={{ filter: 'drop-shadow(0 0 4px #00E5FF)' }}
            />
            <polygon points="106,7 116,12 106,17" fill="#A855F7"
              style={{ filter: 'drop-shadow(0 0 4px #A855F7)' }}
            />
          </>
        )}
        {state === 'notfound' && (
          <line x1="8" y1="12" x2="112" y2="12"
            stroke="rgba(247,37,133,0.5)" strokeWidth="1.5"
            strokeDasharray="3 6"
          />
        )}
      </svg>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────
interface DestinyBannerProps {
  nodes: StarNode[]
  edges: DramaEdge[]
  graph: Graph | null
  onPathFound: (result: PathResult | null) => void
  onClear: () => void
}

export default function DestinyBanner({
  nodes, edges, graph, onPathFound, onClear,
}: DestinyBannerProps) {
  const [fromNode, setFromNode] = useState<StarNode | null>(null)
  const [toNode, setToNode] = useState<StarNode | null>(null)
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)
  const [result, setResult] = useState<PathResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  // idle | half | active | searching | done | notfound
  const [lineState, setLineState] = useState<'idle' | 'half' | 'active' | 'searching' | 'done' | 'notfound'>('idle')
  const [resultVisible, setResultVisible] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  const filteredFrom = fromQuery ? nodes.filter(n => n.name.includes(fromQuery)).slice(0, 8) : []
  const filteredTo = toQuery ? nodes.filter(n => n.name.includes(toQuery)).slice(0, 8) : []

  // 关闭下拉（点击外部）
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bannerRef.current && !bannerRef.current.contains(e.target as Node)) {
        setFromOpen(false)
        setToOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 同步线条状态
  useEffect(() => {
    if (fromNode && toNode) {
      // 两人都选好了，保持当前运行状态（由 triggerSearch 控制）
    } else if (fromNode || toNode) {
      setLineState('half')
    } else {
      setLineState('idle')
      setResult(null)
      setResultVisible(false)
    }
  }, [fromNode, toNode])

  function getEdgeDrama(a: string, b: string): string {
    const edge = edges.find(e =>
      (e.source === a && e.target === b) || (e.source === b && e.target === a)
    )
    return edge && edge.dramas.length > 0 ? `《${edge.dramas[0]}》` : ''
  }

  const triggerSearch = useCallback((from: StarNode, to: StarNode) => {
    if (!graph) return
    setErrorMsg('')
    setResult(null)
    setResultVisible(false)
    setLineState('active')

    // 充能动画 800ms 后开始寻路
    setTimeout(() => {
      setLineState('searching')
      const path = bidirectional(graph, from.id, to.id)

      if (!path || path.length === 0) {
        setLineState('notfound')
        setErrorMsg(`暂无剧缘连接，${from.name} 与 ${to.name} 的世界还未相遇`)
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
      setLineState('done')
      onPathFound(r)

      // 结果面板延迟展开
      setTimeout(() => setResultVisible(true), 400)
    }, 800)
  }, [graph, edges, onPathFound])

  function handleFromSelect(n: StarNode) {
    setFromNode(n)
    setFromQuery('')
    setFromOpen(false)
    if (toNode) triggerSearch(n, toNode)
  }

  function handleToSelect(n: StarNode) {
    setToNode(n)
    setToQuery('')
    setToOpen(false)
    if (fromNode) triggerSearch(fromNode, n)
  }

  function handleClearFrom() {
    setFromNode(null)
    setFromQuery('')
    setResult(null)
    setResultVisible(false)
    setErrorMsg('')
    setLineState(toNode ? 'half' : 'idle')
    onClear()
  }

  function handleClearTo() {
    setToNode(null)
    setToQuery('')
    setResult(null)
    setResultVisible(false)
    setErrorMsg('')
    setLineState(fromNode ? 'half' : 'idle')
    onClear()
  }

  const isSearching = lineState === 'active' || lineState === 'searching'

  return (
    <div ref={bannerRef}>
      {/* ── 横幅主体 ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          background: lineState === 'done'
            ? 'rgba(0,229,255,0.05)'
            : lineState === 'notfound'
              ? 'rgba(247,37,133,0.04)'
              : 'rgba(13,18,32,0.7)',
          borderBottom: resultVisible
            ? '1px solid rgba(0,229,255,0.1)'
            : '1px solid rgba(0,229,255,0.08)',
          transition: 'background 0.5s ease',
        }}
      >
        {/* 标题 */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span style={{ color: '#00E5FF', fontSize: 14, filter: 'drop-shadow(0 0 4px #00E5FF)' }}>⚡</span>
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#00E5FF', opacity: 0.8 }}>
            寻找剧缘
          </span>
        </div>

        <div className="w-px h-4 shrink-0" style={{ background: 'rgba(0,229,255,0.15)' }} />

        {/* 起点 */}
        <StarSlot
          label="选起点明星..."
          node={fromNode}
          query={fromQuery}
          open={fromOpen}
          filtered={filteredFrom}
          onQueryChange={v => { setFromQuery(v); setFromOpen(true) }}
          onSelect={handleFromSelect}
          onClear={handleClearFrom}
          onFocus={() => setFromOpen(true)}
          glowColor="cyan"
          pulsing={!fromNode && !!(toNode)}
        />

        {/* 中间连接线 */}
        <ConnectLine state={lineState} />

        {/* 终点 */}
        <StarSlot
          label="选终点明星..."
          node={toNode}
          query={toQuery}
          open={toOpen}
          filtered={filteredTo}
          onQueryChange={v => { setToQuery(v); setToOpen(true) }}
          onSelect={handleToSelect}
          onClear={handleClearTo}
          onFocus={() => setToOpen(true)}
          glowColor="purple"
          pulsing={!toNode && !!(fromNode)}
        />

        {/* 搜索中 loading 指示 */}
        {isSearching && (
          <div className="shrink-0 flex gap-1 ml-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#00E5FF',
                  animation: `destiny-dot 0.8s ease-in-out ${i * 0.18}s infinite alternate`,
                }}
              />
            ))}
          </div>
        )}

        {/* 结果步数徽章 */}
        {result && !isSearching && (
          <div
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg ml-2"
            style={{
              background: 'rgba(0,229,255,0.1)',
              border: '1px solid rgba(0,229,255,0.25)',
            }}
          >
            <span className="text-xs" style={{ color: '#64748B' }}>相隔</span>
            <span
              className="text-sm font-bold"
              style={{ color: '#00E5FF', textShadow: '0 0 8px rgba(0,229,255,0.7)' }}
            >
              {result.steps.length}
            </span>
            <span className="text-xs" style={{ color: '#64748B' }}>步</span>
          </div>
        )}

        {/* 无路径提示 */}
        {lineState === 'notfound' && (
          <span className="text-xs ml-2 shrink-0" style={{ color: '#F72585' }}>
            ✗ 暂无连接
          </span>
        )}
      </div>

      {/* ── 结果展开区 ── */}
      <div
        style={{
          maxHeight: resultVisible && result ? '120px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1)',
          background: 'rgba(0,229,255,0.03)',
          borderBottom: resultVisible && result ? '1px solid rgba(0,229,255,0.08)' : 'none',
        }}
      >
        {result && (
          <div className="px-5 py-3 flex flex-wrap items-center gap-x-1 gap-y-1">
            {result.steps.map((step, i) => {
              const fromStar = nodes.find(n => n.id === step.from)
              const toStar = nodes.find(n => n.id === step.to)
              return (
                <span
                  key={i}
                  className="flex items-center gap-1 text-sm"
                  style={{
                    opacity: 0,
                    animation: `destiny-fade-in 0.4s ease forwards`,
                    animationDelay: `${i * 0.18}s`,
                  }}
                >
                  <span className="font-semibold" style={{ color: i === 0 ? '#00E5FF' : '#E2E8F0' }}>
                    {fromStar?.name}
                  </span>
                  {step.drama && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        color: '#A855F7',
                        background: 'rgba(168,85,247,0.1)',
                        border: '1px solid rgba(168,85,247,0.2)',
                      }}
                    >
                      {step.drama}
                    </span>
                  )}
                  <span style={{ color: '#00E5FF', fontSize: 12 }}>▶</span>
                  {i === result.steps.length - 1 && (
                    <span
                      className="font-semibold"
                      style={{ color: '#A855F7' }}
                    >
                      {toStar?.name}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 错误展开区 */}
      <div
        style={{
          maxHeight: errorMsg ? '48px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.4s ease',
          background: 'rgba(247,37,133,0.04)',
          borderBottom: errorMsg ? '1px solid rgba(247,37,133,0.1)' : 'none',
        }}
      >
        {errorMsg && (
          <p className="px-5 py-2.5 text-xs" style={{ color: 'rgba(247,37,133,0.8)' }}>
            ⚠ {errorMsg}
          </p>
        )}
      </div>
    </div>
  )
}
