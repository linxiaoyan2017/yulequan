import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as echarts from 'echarts'
import type { GraphData, StarNode, DramaEdge, HighlightState } from '../types'

interface GraphCanvasProps {
  data: GraphData
  highlight: HighlightState
  onNodeClick: (nodeId: string) => void
  onCanvasClick: () => void
}

export interface GraphCanvasRef {
  focusNode: (nodeId: string) => void
  resetLayout: () => void
}

// ── 节点色板（8色，与深色背景搭配）─────────────────
const NODE_PALETTE = [
  '#F72585',  // 玫红
  '#7209B7',  // 深紫
  '#4361EE',  // 蓝紫
  '#4CC9F0',  // 天蓝
  '#F77F00',  // 橙
  '#06D6A0',  // 青绿
  '#FFD166',  // 金黄
  '#EF233C',  // 红
]

// 给节点按权重顺序分配颜色，返回 nodeId → color 的 Map
function buildNodeColorMap(nodes: StarNode[]): Map<string, string> {
  const map = new Map<string, string>()
  // nodes 已按 weight 降序排列，直接按顺序循环分配
  nodes.forEach((n, i) => {
    map.set(n.id, NODE_PALETTE[i % NODE_PALETTE.length])
  })
  return map
}

// 边宽度仅按合作剧数决定（粗细传达信息，颜色传达美感）
function edgeWidthByWeight(count: number): number {
  if (count >= 3) return 3.5
  if (count === 2) return 2
  return 1
}

// 构造 ECharts 渐变色对象（source节点色 → target节点色）
function makeGradientColor(sourceColor: string, targetColor: string) {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    colorStops: [
      { offset: 0, color: sourceColor + 'CC' },   // 80% 透明度
      { offset: 1, color: targetColor + 'CC' },
    ],
  }
}

function buildEChartsOption(data: GraphData, highlight: HighlightState) {
  const { nodes, edges } = data
  const { mode, focusedNodeId, highlightedNodeIds, pathNodeIds, pathEdgeIds } = highlight
  const isHighlighting = mode !== 'none'

  // 构建节点颜色映射（按权重顺序循环分配色板）
  const nodeColorMap = buildNodeColorMap(nodes)

  const eNodes = nodes.map((n: StarNode) => {
    const isFocused = n.id === focusedNodeId
    const isHighlighted = highlightedNodeIds?.has(n.id)
    const isOnPath = pathNodeIds?.includes(n.id)

    let opacity = 1
    let symbolSize = 48
    let borderColor = 'rgba(0,229,255,0.6)'
    let borderWidth = 2
    let shadowBlur = 8
    let shadowColor = 'rgba(0,229,255,0.4)'
    let labelColor = '#94A3B8'

    if (isHighlighting) {
      if (isFocused) {
        opacity = 1; symbolSize = 64; borderColor = '#00E5FF'
        borderWidth = 3; shadowBlur = 24; shadowColor = 'rgba(0,229,255,0.8)'; labelColor = '#00E5FF'
      } else if (isOnPath) {
        opacity = 1; symbolSize = 58; borderColor = '#F72585'
        borderWidth = 3; shadowBlur = 20; shadowColor = 'rgba(247,37,133,0.7)'; labelColor = '#F72585'
      } else if (isHighlighted) {
        opacity = 1; symbolSize = 52; borderColor = '#A855F7'
        borderWidth = 2; shadowBlur = 14; shadowColor = 'rgba(168,85,247,0.6)'; labelColor = '#C4B5FD'
      } else {
        opacity = 0.08; shadowBlur = 0
      }
    }

    return {
      id: n.id, name: n.name,
      symbol: `image://${n.avatar}`,
      symbolSize,
      label: {
        show: true, position: 'bottom', fontSize: 11, color: labelColor,
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        textShadowBlur: isHighlighting && (isFocused || isOnPath || isHighlighted) ? 6 : 0,
        textShadowColor: labelColor,
      },
      itemStyle: { borderColor, borderWidth, opacity, shadowBlur, shadowColor },
      draggable: true,
      value: n.centrality,
    }
  })

  const eEdges = edges.map((e: DramaEdge) => {
    const edgeKey = `${e.source}-${e.target}`
    const isOnPath = pathEdgeIds?.includes(edgeKey) || pathEdgeIds?.includes(`${e.target}-${e.source}`)
    const isConnectedToFocus =
      e.source === focusedNodeId || e.target === focusedNodeId ||
      highlightedNodeIds?.has(e.source) || highlightedNodeIds?.has(e.target)

    // ── 宽度按合作剧数，颜色按节点渐变
    const baseWidth = edgeWidthByWeight(e.dramas.length)
    const srcColor = nodeColorMap.get(e.source) ?? '#4CC9F0'
    const tgtColor = nodeColorMap.get(e.target) ?? '#4CC9F0'
    const gradientColor = makeGradientColor(srcColor, tgtColor)

    const dramaLabels = e.dramas.map(d => `《${d}》`).join('\n')

    if (isHighlighting) {
      if (isOnPath) {
        return {
          source: e.source, target: e.target,
          lineStyle: {
            color: '#F72585', width: 3, opacity: 1,
            curveness: 0.32, shadowBlur: 16, shadowColor: 'rgba(247,37,133,0.6)',
          },
          tooltip: { formatter: dramaLabels },
        }
      } else if (isConnectedToFocus && (mode === 'search' || mode === 'node')) {
        return {
          source: e.source, target: e.target,
          lineStyle: {
            color: gradientColor, width: Math.max(baseWidth, 2), opacity: 1,
            curveness: 0.32, shadowBlur: 10, shadowColor: srcColor + '99',
          },
          tooltip: { formatter: dramaLabels },
        }
      } else {
        return {
          source: e.source, target: e.target,
          lineStyle: { color: gradientColor, width: baseWidth, opacity: 0.04, curveness: 0.32 },
          tooltip: { formatter: dramaLabels },
        }
      }
    }

    return {
      source: e.source, target: e.target,
      lineStyle: {
        color: gradientColor, width: baseWidth, opacity: 1,
        curveness: 0.32, shadowBlur: 4, shadowColor: srcColor + '55',
      },
      tooltip: { formatter: dramaLabels },
    }
  })

  return {
    backgroundColor: '#080B14',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13,18,32,0.95)',
      borderColor: 'rgba(0,229,255,0.4)',
      borderWidth: 1,
      textStyle: { color: '#E2E8F0', fontSize: 12 },
      extraCssText: 'box-shadow:0 0 20px rgba(0,229,255,0.2);border-radius:8px;padding:8px 12px;backdrop-filter:blur(8px);',
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: eNodes,
      edges: eEdges,
      roam: true,
      draggable: true,
      scaleLimit: { min: 0.3, max: 5 },
      force: {
        repulsion: 260,
        gravity: 0.08,
        edgeLength: [110, 230],
        layoutAnimation: true,
        friction: 0.65,
      },
      lineStyle: { color: 'rgba(0,229,255,0.28)', width: 1, curveness: 0.32 },
      emphasis: { focus: 'none', lineStyle: { width: 2, color: '#00E5FF' } },
      label: { show: true, position: 'bottom', fontSize: 11, color: '#94A3B8' },
    }],
  }
}

// ── 缩放控件组件 ─────────────────────────────────
interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

function ZoomControls({ onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  const btnBase: React.CSSProperties = {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'color 0.2s, text-shadow 0.2s',
  }
  const divider: React.CSSProperties = {
    height: '1px',
    background: 'rgba(0,229,255,0.12)',
    margin: '0 8px',
  }

  function hoverOn(e: React.MouseEvent<HTMLButtonElement>) {
    const el = e.currentTarget
    el.style.color = '#00E5FF'
    el.style.textShadow = '0 0 10px rgba(0,229,255,0.8)'
  }
  function hoverOff(e: React.MouseEvent<HTMLButtonElement>) {
    const el = e.currentTarget
    el.style.color = '#64748B'
    el.style.textShadow = 'none'
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: '16px',
        bottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(8,11,20,0.88)',
        border: '1px solid rgba(0,229,255,0.2)',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 12px rgba(0,229,255,0.06)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <button style={btnBase} title="放大" onClick={onZoomIn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>＋</button>
      <div style={divider} />
      <button style={btnBase} title="缩小" onClick={onZoomOut} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>－</button>
      <div style={divider} />
      <button style={{ ...btnBase, fontSize: '11px', flexDirection: 'column', gap: '1px' } as React.CSSProperties}
        title="重置视角" onClick={onReset} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }}>⊙</span>
        <span style={{ fontSize: '9px', letterSpacing: '0.5px' }}>重置</span>
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────
const GraphCanvas = forwardRef<GraphCanvasRef, GraphCanvasProps>(
  ({ data, highlight, onNodeClick, onCanvasClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<echarts.ECharts | null>(null)

    const onNodeClickRef = useRef(onNodeClick)
    const onCanvasClickRef = useRef(onCanvasClick)
    useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
    useEffect(() => { onCanvasClickRef.current = onCanvasClick }, [onCanvasClick])

    // 初始化 ECharts（只跑一次）
    useEffect(() => {
      if (!containerRef.current) return
      const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' })
      chartRef.current = chart

      chart.on('click', (params) => {
        if (params.dataType === 'node' && params.data && typeof params.data === 'object') {
          onNodeClickRef.current((params.data as { id: string }).id)
        } else {
          onCanvasClickRef.current()
        }
      })

      const handleResize = () => chart.resize()
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        chart.dispose()
      }
    }, [])

    // 数据/高亮变化时更新图表
    useEffect(() => {
      if (!chartRef.current || !data) return
      const option = buildEChartsOption(data, highlight)
      chartRef.current.setOption(option, { notMerge: false })
    }, [data, highlight])

    function resetLayout() {
      if (!chartRef.current || !data) return
      chartRef.current.setOption(buildEChartsOption(data, { mode: 'none' }), { notMerge: true })
    }

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string) {
        chartRef.current?.dispatchAction({ type: 'focusNodeAdjacency', dataIndex: nodeId })
      },
      resetLayout,
    }))

    function handleZoomIn() {
      if (!chartRef.current) return
      const opt = chartRef.current.getOption() as { series: Array<{ zoom?: number }> }
      const cur = opt.series?.[0]?.zoom ?? 1
      chartRef.current.setOption({ series: [{ zoom: cur * 1.3 }] })
    }
    function handleZoomOut() {
      if (!chartRef.current) return
      const opt = chartRef.current.getOption() as { series: Array<{ zoom?: number }> }
      const cur = opt.series?.[0]?.zoom ?? 1
      chartRef.current.setOption({ series: [{ zoom: Math.max(cur * 0.77, 0.1) }] })
    }

    return (
      <div className="w-full h-full relative" style={{ background: '#080B14' }}>
        <div ref={containerRef} className="w-full h-full" />
        <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={resetLayout} />
      </div>
    )
  }
)

GraphCanvas.displayName = 'GraphCanvas'
export default GraphCanvas