import { useState, useRef, useCallback, useMemo } from 'react'
import { useGraphData } from './hooks/useGraphData'
import { useGraphology } from './hooks/useGraphology'
import GraphCanvas, { type GraphCanvasRef } from './components/GraphCanvas'
import SearchBar from './components/SearchBar'
import StarDetailCard from './components/StarDetailCard'
import DestinyBanner from './components/DestinyBanner'
import CentralityRank from './components/CentralityRank'
import type { HighlightState } from './types'

export default function App() {
  const { data, meta, loading, error } = useGraphData()
  const graph = useGraphology(data)
  const canvasRef = useRef<GraphCanvasRef>(null)

  const [highlight, setHighlight] = useState<HighlightState>({ mode: 'none' })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchSelectedId, setSearchSelectedId] = useState<string | undefined>()

  // 排行榜排名映射
  const centralityRankMap = useMemo(() => {
    if (!data) return new Map<string, number>()
    const sorted = [...data.nodes].sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
    return new Map(sorted.map((n, i) => [n.id, i + 1]))
  }, [data])

  // 搜索选中某明星 → 高亮其所有直连关系
  const handleSearchSelect = useCallback((nodeId: string) => {
    if (!data) return
    setSearchSelectedId(nodeId)
    const connectedNodes = new Set<string>([nodeId])
    data.edges.forEach(e => {
      if (e.source === nodeId || e.target === nodeId) {
        connectedNodes.add(e.source)
        connectedNodes.add(e.target)
      }
    })
    setHighlight({
      mode: 'search',
      focusedNodeId: nodeId,
      highlightedNodeIds: connectedNodes,
    })
    setSelectedNodeId(null)
  }, [data])

  // 清除搜索
  const handleSearchClear = useCallback(() => {
    setSearchSelectedId(undefined)
    setHighlight({ mode: 'none' })
  }, [])

  // 点击节点 → 打开详情卡片，同时高亮
  const handleNodeClick = useCallback((nodeId: string) => {
    if (!data) return
    setSelectedNodeId(nodeId)
    setSearchSelectedId(nodeId)
    const connectedNodes = new Set<string>([nodeId])
    data.edges.forEach(e => {
      if (e.source === nodeId || e.target === nodeId) {
        connectedNodes.add(e.source)
        connectedNodes.add(e.target)
      }
    })
    setHighlight({ mode: 'node', focusedNodeId: nodeId, highlightedNodeIds: connectedNodes })
  }, [data])

  // 点击画布空白 → 关闭卡片
  const handleCanvasClick = useCallback(() => {
    setSelectedNodeId(null)
    setSearchSelectedId(undefined)
    setHighlight({ mode: 'none' })
  }, [])

  // 路径找到（DestinyBanner 回调）→ 起点点亮 + Canvas 笔触描线 + 沿途节点随描线逐步点亮
  const handlePathFound = useCallback((result: { nodeIds: string[]; edgeKeys: string[] } | null) => {
    if (!result) {
      canvasRef.current?.clearOverlay()
      setHighlight({ mode: 'none' })
      return
    }
    const { nodeIds, edgeKeys } = result
    const STEP_MS = Math.max((nodeIds.length - 1) * 620, 900) / (nodeIds.length - 1) // 每段时长

    // 第 0 步：只点亮起点，其余全暗
    setHighlight({
      mode: 'path',
      pathNodeIds: [nodeIds[0]],
      pathEdgeIds: [],
      highlightedNodeIds: new Set([nodeIds[0]]),
    })

    // 随笔触描线到达每个中间/终点节点时，追加点亮（180ms 为 revealPath 内部启动延迟）
    nodeIds.slice(1).forEach((_, i) => {
      setTimeout(() => {
        setHighlight({
          mode: 'path',
          pathNodeIds: nodeIds.slice(0, i + 2),
          pathEdgeIds: edgeKeys.slice(0, i + 1),
          highlightedNodeIds: new Set(nodeIds.slice(0, i + 2)),
        })
      }, 180 + STEP_MS * (i + 1))
    })

    // 触发笔触描线动画（与节点逐步点亮同步运行）
    canvasRef.current?.revealPath(nodeIds)
  }, [])

  // 重置图谱
  const handleReset = useCallback(() => {
    canvasRef.current?.clearOverlay()
    setHighlight({ mode: 'none' })
    setSelectedNodeId(null)
    setSearchSelectedId(undefined)
    canvasRef.current?.resetLayout()
  }, [])

  // Loading 骨架屏
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: '#080B14' }}>
        <div className="text-5xl mb-5 animate-pulse">⚡</div>
        <p className="text-lg font-semibold" style={{ color: '#00E5FF', textShadow: '0 0 12px rgba(0,229,255,0.7)' }}>
          明星关系图谱加载中...
        </p>
        <p className="text-sm mt-2" style={{ color: '#64748B' }}>正在构建关系网络</p>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full animate-bounce"
              style={{ background: '#00E5FF', boxShadow: '0 0 8px rgba(0,229,255,0.8)', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: '#080B14' }}>
        <div className="text-4xl mb-4">⚠️</div>
        <p style={{ color: '#F72585' }}>{error || '数据加载失败'}</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#080B14' }}>
      {/* ── 顶部导航栏 ── */}
      <header
        className="shrink-0 flex items-center gap-4 px-5 py-3 z-20"
        style={{
          background: 'rgba(13,18,32,0.95)',
          borderBottom: '1px solid rgba(0,229,255,0.15)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xl">⚡</span>
          <div>
            <h1 className="text-sm font-bold leading-tight tracking-wide"
              style={{ color: '#00E5FF', textShadow: '0 0 10px rgba(0,229,255,0.6)' }}>
              明星关系图谱
            </h1>
            <p className="text-[10px] leading-tight"
              style={{ color: '#64748B' }}>国产近5年热播剧合作网络</p>
          </div>
        </div>

        <div className="h-5 w-px mx-1" style={{ background: 'rgba(0,229,255,0.2)' }} />

        <div className="flex-1 max-w-xs">
          <SearchBar nodes={data.nodes} onSelect={handleSearchSelect}
            onClear={handleSearchClear} selectedId={searchSelectedId} />
        </div>

        <div className="ml-auto">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-all duration-200"
            style={{ background: 'transparent', color: '#64748B', borderColor: 'rgba(100,116,139,0.3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,255,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(100,116,139,0.3)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">重置</span>
          </button>
        </div>
      </header>

      {/* ── 主体区域 ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <CentralityRank nodes={data.nodes} edges={data.edges} onStarClick={handleNodeClick} />

        {/* 图谱列：命运横幅 + 画布 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 z-10">
            <DestinyBanner
              nodes={data.nodes}
              edges={data.edges}
              graph={graph}
              onPathFound={handlePathFound}
              onClear={() => {
                canvasRef.current?.clearOverlay()
                setHighlight({ mode: 'none' })
              }}
            />
          </div>

          <div className="flex-1 relative overflow-hidden">
            <GraphCanvas
              ref={canvasRef}
              data={data}
              highlight={highlight}
              onNodeClick={handleNodeClick}
              onCanvasClick={handleCanvasClick}
            />

            {/* 右侧明星详情卡片 */}
            {selectedNodeId && (
              <StarDetailCard
                nodeId={selectedNodeId}
                nodes={data.nodes}
                edges={data.edges}
                centralityRank={centralityRankMap.get(selectedNodeId) ?? 0}
                onClose={() => { setSelectedNodeId(null); setHighlight({ mode: 'none' }) }}
                onPartnerClick={handleNodeClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 底部 meta 信息栏 ── */}
      <footer
        className="shrink-0 flex items-center justify-center gap-4 px-5 py-2 text-xs"
        style={{
          background: 'rgba(13,18,32,0.95)',
          borderTop: '1px solid rgba(0,229,255,0.1)',
          color: '#64748B',
        }}
      >
        <span style={{ color: '#00E5FF' }}>⚡ {meta?.node_count ?? data.nodes.length}</span>
        <span>位明星</span>
        <span style={{ color: 'rgba(0,229,255,0.15)' }}>|</span>
        <span style={{ color: '#A855F7' }}>◈ {meta?.edge_count ?? data.edges.length}</span>
        <span>条合作关系</span>
        <span style={{ color: 'rgba(0,229,255,0.15)' }}>|</span>
        <span>🎬 {meta?.drama_count ?? 0} 部剧集</span>
        <span style={{ color: 'rgba(0,229,255,0.15)' }}>|</span>
        <span>更新于 {meta ? new Date(meta.last_updated).toLocaleDateString('zh-CN') : '-'}</span>
        <span style={{ color: 'rgba(0,229,255,0.15)' }}>|</span>
        <span>数据来源：豆瓣</span>
      </footer>
    </div>
  )
}