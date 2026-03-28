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
  revealPath: (nodeIds: string[]) => void
  clearOverlay: () => void
}

function buildEChartsOption(data: GraphData, highlight: HighlightState) {
  const { nodes, edges } = data
  const { mode, focusedNodeId, highlightedNodeIds, pathNodeIds, pathEdgeIds } = highlight
  const isHighlighting = mode !== 'none'

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

    const baseWidth = Math.min(1 + (e.dramas.length - 1) * 1.5, 5)
    let lineColor = 'rgba(0,229,255,0.3)'
    let lineWidth = baseWidth
    let opacity = 1
    let shadowBlur = 2
    let shadowColor = 'rgba(0,229,255,0.2)'

    if (isHighlighting) {
      if (isOnPath) {
        // path 边由 overlay canvas 动画绘制，这里降低 ECharts 边透明度作为底色
        lineColor = 'rgba(247,37,133,0.25)'
        lineWidth = Math.max(baseWidth, 2)
        shadowBlur = 0; opacity = 0.5
      } else if (isConnectedToFocus && (mode === 'search' || mode === 'node')) {
        lineColor = '#00E5FF'; lineWidth = Math.max(baseWidth, 2)
        shadowBlur = 10; shadowColor = 'rgba(0,229,255,0.6)'; opacity = 1
      } else {
        opacity = 0.03; shadowBlur = 0
      }
    }

    const dramaLabels = e.dramas.map(d => `《${d}》`).join('\n')
    return {
      source: e.source, target: e.target,
      lineStyle: {
        color: lineColor, width: lineWidth, opacity,
        curveness: 0.32,  // 更平滑的曲线
        shadowBlur, shadowColor,
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
      force: {
        repulsion: 260,
        gravity: 0.08,
        edgeLength: [110, 230],
        layoutAnimation: true,
        friction: 0.65,
      },
      // 默认边样式（非高亮时）
      lineStyle: { color: 'rgba(0,229,255,0.28)', width: 1, curveness: 0.32 },
      emphasis: { focus: 'none', lineStyle: { width: 2, color: '#00E5FF' } },
      label: { show: true, position: 'bottom', fontSize: 11, color: '#94A3B8' },
    }],
  }
}

// ── 笔触描线动画辅助 ──────────────────────────────
function getPointAlongPath(
  points: { x: number; y: number }[],
  segLengths: number[],
  totalLen: number,
  t: number
): { x: number; y: number } {
  const target = totalLen * t
  let acc = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (acc + segLengths[i] >= target) {
      const frac = (target - acc) / segLengths[i]
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * frac,
        y: points[i].y + (points[i + 1].y - points[i].y) * frac,
      }
    }
    acc += segLengths[i]
  }
  return points[points.length - 1]
}

// ─────────────────────────────────────────────────
const GraphCanvas = forwardRef<GraphCanvasRef, GraphCanvasProps>(
  ({ data, highlight, onNodeClick, onCanvasClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const chartRef = useRef<echarts.ECharts | null>(null)
    const animFrameRef = useRef<number>(0)
    const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    // 用 ref 追踪最新 data，供内部函数安全访问
    const dataRef = useRef<GraphData | null>(null)

    const onNodeClickRef = useRef(onNodeClick)
    const onCanvasClickRef = useRef(onCanvasClick)
    useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
    useEffect(() => { onCanvasClickRef.current = onCanvasClick }, [onCanvasClick])
    useEffect(() => { dataRef.current = data }, [data])

    /**
     * 捕获节点像素坐标
     * ECharts force 布局把坐标存在 node.x / node.y 上（而非 getLayout()）
     * 按优先级依次尝试：node.x → getLayout() → dataItem.layout → getItemLayout(idx)
     */
    // 只做一次诊断，找到坐标真实存储位置
    const _diagnosed = useRef(false)

    function capturePositions(chart: echarts.ECharts) {
      try {
        const model = (chart as any).getModel()
        if (!model) return
        const seriesModel = model.getSeriesByIndex(0)
        if (!seriesModel) return

        const gData = seriesModel.getData()

        // ── 诊断日志（只打一次，找到坐标到底在哪）
        if (!_diagnosed.current) {
          _diagnosed.current = true
          console.group('[ECharts Diagnosis]')
          console.log('seriesModel type:', seriesModel.type)
          console.log('getGraph exists:', typeof seriesModel.getGraph)
          if (typeof seriesModel.getGraph === 'function') {
            const g = seriesModel.getGraph()
            const firstNode = g?.nodes?.[0]
            if (firstNode) {
              console.log('node keys:', Object.keys(firstNode))
              console.log('node.id:', firstNode.id)
              console.log('node.x:', firstNode.x, 'node.y:', firstNode.y)
              console.log('node.getLayout():', typeof firstNode.getLayout === 'function' ? firstNode.getLayout() : 'no method')
              console.log('node.dataItem:', firstNode.dataItem)
              console.log('node.hostGraph:', !!firstNode.hostGraph)
            } else {
              console.log('graph nodes:', g?.nodes)
            }
          }
          console.log('gData.count():', gData.count())
          if (gData.count() > 0) {
            console.log('getItemLayout(0):', gData.getItemLayout(0))
            const raw = gData.getRawDataItem(0)
            console.log('getRawDataItem(0).id:', (raw as any)?.id)
          }
          console.groupEnd()
        }

        // ── 核心修复：layout 是数组 [x, y]，不是对象 {x, y}
        let count = 0
        if (typeof seriesModel.getGraph === 'function') {
          seriesModel.getGraph().eachNode((node: any) => {
            const id = node.id
            if (id == null) return
            const layout = typeof node.getLayout === 'function' ? node.getLayout() : null
            // ECharts graph 的 layout 是 [x, y] 数组
            if (Array.isArray(layout) && layout[0] != null) {
              nodePositionsRef.current.set(String(id), { x: layout[0], y: layout[1] })
              count++
            }
          })
        }

        // 索引兜底（layout 也是数组格式）
        if (count === 0 && dataRef.current) {
          dataRef.current.nodes.forEach((node, idx) => {
            const layout = gData.getItemLayout(idx)
            if (Array.isArray(layout) && layout[0] != null) {
              nodePositionsRef.current.set(node.id, { x: layout[0], y: layout[1] })
              count++
            }
          })
        }
      } catch (e) {
        console.error('[capturePositions] error:', e)
      }
    }

    // 清除 overlay 画布
    function clearOverlay() {
      cancelAnimationFrame(animFrameRef.current)
      const overlay = overlayRef.current
      if (!overlay) return
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
    }

    // 笔触生成动画：从起点到终点连续描绘
    function revealPath(nodeIds: string[]) {
      clearOverlay()
      const overlay = overlayRef.current
      const container = containerRef.current
      if (!overlay || !container) return

      // 同步 overlay 尺寸
      overlay.width = container.clientWidth
      overlay.height = container.clientHeight

      console.log('[RevealPath] called, nodeIds:', nodeIds)
      console.log('[RevealPath] overlay size:', overlay.width, 'x', overlay.height)

      // 等 ECharts 渲染后捕获坐标，重试最多 4 次（每次间隔 200ms）
      let attempts = 0
      const tryStart = () => {
        attempts++
        if (chartRef.current) capturePositions(chartRef.current)

        console.log(`[RevealPath] attempt ${attempts}, nodePositionsRef size:`, nodePositionsRef.current.size)
        nodeIds.forEach(id => console.log(`  node "${id}":`, nodePositionsRef.current.get(id)))

        const points = nodeIds
          .map(id => nodePositionsRef.current.get(id))
          .filter((p): p is { x: number; y: number } => !!p)

        console.log(`[RevealPath] points found: ${points.length}/${nodeIds.length}`)

        if (points.length < nodeIds.length && attempts < 4) {
          setTimeout(tryStart, 200)
          return
        }
        if (points.length < 2) {
          console.warn('[RevealPath] Not enough points, giving up. Map keys:', [...nodePositionsRef.current.keys()])
          return
        }

        console.log('[RevealPath] Starting animation with points:', points)
        startAnimation(points)
      }

      const startAnimation = (points: { x: number; y: number }[]) => {
        const segLengths = points.slice(1).map((p, i) =>
          Math.hypot(p.x - points[i].x, p.y - points[i].y)
        )
        const totalLength = segLengths.reduce((a, b) => a + b, 0)
        const DURATION = Math.max((nodeIds.length - 1) * 620, 900) // ms

        const ctx = overlay!.getContext('2d')!
        const startTime = performance.now()

        function animate(now: number) {
          const raw = Math.min((now - startTime) / DURATION, 1)
          const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
          const drawLen = totalLength * t

          ctx.clearRect(0, 0, overlay!.width, overlay!.height)

          // ── 外发光阴影层
          ctx.save()
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'
          ctx.shadowBlur = 24; ctx.shadowColor = '#F72585'
          ctx.strokeStyle = 'rgba(247,37,133,0.35)'; ctx.lineWidth = 10
          _drawProgress(ctx, points, segLengths, drawLen)
          ctx.stroke()
          // ── 核心亮线
          ctx.shadowBlur = 14; ctx.shadowColor = '#FF6EB4'
          ctx.strokeStyle = '#F72585'; ctx.lineWidth = 2.5
          _drawProgress(ctx, points, segLengths, drawLen)
          ctx.stroke()
          ctx.restore()

          // ── 前进光点
          if (raw < 0.98) {
            const leader = getPointAlongPath(points, segLengths, totalLength, t)
            ctx.save()
            ctx.shadowBlur = 28; ctx.shadowColor = '#00E5FF'
            ctx.fillStyle = '#00E5FF'
            ctx.beginPath(); ctx.arc(leader.x, leader.y, 5, 0, Math.PI * 2); ctx.fill()
            ctx.strokeStyle = 'rgba(0,229,255,0.4)'; ctx.lineWidth = 2
            ctx.beginPath(); ctx.arc(leader.x, leader.y, 9 + 4 * Math.sin(now / 120), 0, Math.PI * 2); ctx.stroke()
            ctx.restore()
          }

          if (raw < 1) {
            animFrameRef.current = requestAnimationFrame(animate)
          }
          // 动画完成后线条保留在 overlay 上，直到用户重置或重新寻路
        }
        animFrameRef.current = requestAnimationFrame(animate)
      }

      setTimeout(tryStart, 150)
    }

    // 工具：按已绘长度描线路径（不调用 stroke）
    function _drawProgress(
      ctx: CanvasRenderingContext2D,
      points: { x: number; y: number }[],
      segLengths: number[],
      drawLen: number
    ) {
      let acc = 0
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 0; i < segLengths.length; i++) {
        if (acc + segLengths[i] <= drawLen) {
          ctx.lineTo(points[i + 1].x, points[i + 1].y)
          acc += segLengths[i]
        } else {
          const frac = (drawLen - acc) / segLengths[i]
          ctx.lineTo(
            points[i].x + (points[i + 1].x - points[i].x) * frac,
            points[i].y + (points[i + 1].y - points[i].y) * frac
          )
          break
        }
      }
    }

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

      // 每次渲染后捕获节点坐标
      chart.on('rendered', () => capturePositions(chart))

      const handleResize = () => {
        chart.resize()
        if (overlayRef.current && containerRef.current) {
          overlayRef.current.width = containerRef.current.clientWidth
          overlayRef.current.height = containerRef.current.clientHeight
        }
      }
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

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string) {
        chartRef.current?.dispatchAction({ type: 'focusNodeAdjacency', dataIndex: nodeId })
      },
      resetLayout() {
        clearOverlay()
        if (!chartRef.current || !data) return
        chartRef.current.setOption(buildEChartsOption(data, { mode: 'none' }), { notMerge: true })
      },
      revealPath,
      clearOverlay,
    }))

    return (
      <div className="w-full h-full relative" style={{ background: '#080B14' }}>
        <div ref={containerRef} className="w-full h-full" />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  }
)

GraphCanvas.displayName = 'GraphCanvas'
export default GraphCanvas