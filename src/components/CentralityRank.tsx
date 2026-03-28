import { useState } from 'react'
import type { StarNode, DramaEdge } from '../types'

interface CentralityRankProps {
  nodes: StarNode[]
  edges: DramaEdge[]
  onStarClick: (nodeId: string) => void
}

export default function CentralityRank({ nodes, edges, onStarClick }: CentralityRankProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // 计算每位明星的合作人数（度中心度）
  const degreeMap = new Map<string, Set<string>>()
  nodes.forEach(n => degreeMap.set(n.id, new Set()))
  edges.forEach(e => {
    degreeMap.get(e.source)?.add(e.target)
    degreeMap.get(e.target)?.add(e.source)
  })

  const ranked = [...nodes]
    .map(n => ({ ...n, degree: degreeMap.get(n.id)?.size ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 20)

  const maxDegree = ranked[0]?.degree ?? 1

  return (
    <div
      className={`flex flex-col transition-all duration-300 shrink-0 ${collapsed ? 'w-10' : 'w-60'}`}
      style={{
        background: 'rgba(13,18,32,0.95)',
        borderRight: '1px solid rgba(0,229,255,0.12)',
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-3 py-3"
        style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
      >
        {!collapsed && (
          <h3 className="text-sm font-semibold whitespace-nowrap" style={{ color: '#00E5FF', textShadow: '0 0 8px rgba(0,229,255,0.5)' }}>
            ◈ 剧缘中心榜
          </h3>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="p-1 rounded-lg ml-auto transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
          title={collapsed ? '展开排行榜' : '收起排行榜'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
      </div>

      {/* 列表 */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-2">
          {ranked.map((star, i) => (
            <button
              key={star.id}
              className="w-full flex items-center gap-2 px-3 py-2 transition-all relative"
              style={{ color: '#CBD5E1' }}
              onClick={() => onStarClick(star.id)}
              onMouseEnter={e => {
                setHoveredId(star.id)
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,229,255,0.06)'
              }}
              onMouseLeave={e => {
                setHoveredId(null)
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {/* 排行序号 */}
              <span
                className="text-xs font-bold w-5 text-center shrink-0"
                style={{ color: i < 3 ? '#00E5FF' : '#475569', textShadow: i < 3 ? '0 0 6px rgba(0,229,255,0.6)' : 'none' }}
              >
                {i < 3 ? ['①','②','③'][i] : i + 1}
              </span>

              {/* 头像 */}
              <img
                src={star.avatar}
                alt={star.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
                style={{ border: '1px solid rgba(0,229,255,0.3)' }}
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${star.name}&background=0D1220&color=00E5FF`
                }}
              />

              {/* 名字 + 进度条 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: '#E2E8F0' }}>{star.name}</p>
                <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,229,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(star.degree / maxDegree) * 100}%`,
                      background: i < 3
                        ? 'linear-gradient(90deg, rgba(0,229,255,0.6), #00E5FF)'
                        : 'linear-gradient(90deg, rgba(168,85,247,0.4), rgba(168,85,247,0.7))',
                    }}
                  />
                </div>
              </div>

              {/* 合作人数 */}
              <span className="text-xs shrink-0" style={{ color: '#475569' }}>{star.degree}人</span>

              {/* Tooltip */}
              {hoveredId === star.id && (
                <div
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 pointer-events-none"
                  style={{
                    background: 'rgba(13,18,32,0.95)',
                    border: '1px solid rgba(0,229,255,0.2)',
                    color: '#00E5FF',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(0,229,255,0.15)',
                  }}
                >
                  共与 {star.degree} 位演员合作过
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}