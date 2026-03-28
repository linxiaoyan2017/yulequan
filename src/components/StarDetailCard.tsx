import type { StarNode, DramaEdge } from '../types'

interface StarDetailCardProps {
  nodeId: string | null
  nodes: StarNode[]
  edges: DramaEdge[]
  centralityRank: number
  onClose: () => void
  onPartnerClick: (nodeId: string) => void
}

export default function StarDetailCard({
  nodeId,
  nodes,
  edges,
  centralityRank,
  onClose,
  onPartnerClick,
}: StarDetailCardProps) {
  const star = nodeId ? nodes.find(n => n.id === nodeId) : null
  if (!star) return null

  // 找出与该明星相关的所有边
  const relatedEdges = edges.filter(e => e.source === star.id || e.target === star.id)

  // 所有合作剧目，dramas 是剧名字符串数组
  const allDramas = relatedEdges
    .flatMap(e => e.dramas.map(title => ({
      title,
      partnerId: e.source === star.id ? e.target : e.source,
    })))

  // 合作最多的搭档
  const partnerMap = new Map<string, number>()
  relatedEdges.forEach(e => {
    const pid = e.source === star.id ? e.target : e.source
    partnerMap.set(pid, (partnerMap.get(pid) || 0) + e.dramas.length)
  })
  const topPartnerId = [...partnerMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topPartner = topPartnerId ? nodes.find(n => n.id === topPartnerId) : null
  const topPartnerCount = topPartnerId ? partnerMap.get(topPartnerId) : 0

  return (
    <div
      className="absolute right-0 top-0 h-full w-80 flex flex-col z-30 overflow-hidden"
      style={{
        background: 'rgba(10,14,25,0.97)',
        borderLeft: '1px solid rgba(0,229,255,0.18)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.7), -1px 0 0 rgba(0,229,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* 头部 */}
      <div
        className="relative p-5 pb-4"
        style={{ borderBottom: '1px solid rgba(0,229,255,0.1)', background: 'rgba(0,229,255,0.03)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-xl transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
        >
          ×
        </button>
        <div className="flex items-center gap-3">
          <div style={{ padding: '2px', background: 'linear-gradient(135deg, #00E5FF, #A855F7)', borderRadius: '50%' }}>
            <img
              src={star.avatar}
              alt={star.name}
              className="w-20 h-20 rounded-full object-cover"
              style={{ background: '#080B14' }}
              onError={e => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${star.name}&background=0D1220&color=00E5FF&size=80`
              }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: '#E2E8F0' }}>{star.name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}
              >
                ◈ 第 {centralityRank} 名
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: '#475569' }}>近5年 {star.drama_count} 部作品</p>
          </div>
        </div>

        {/* 合作最多搭档 */}
        {topPartner && (
          <div
            className="mt-3 flex items-center gap-2 rounded-xl p-2.5"
            style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)' }}
          >
            <span className="text-xs" style={{ color: '#64748B' }}>最默契搭档</span>
            <button
              className="flex items-center gap-1.5 ml-auto hover:opacity-80 transition-opacity"
              onClick={() => onPartnerClick(topPartner.id)}
            >
              <img
                src={topPartner.avatar}
                alt={topPartner.name}
                className="w-6 h-6 rounded-full object-cover"
                style={{ border: '1px solid rgba(168,85,247,0.4)' }}
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${topPartner.name}&background=0D1220&color=A855F7`
                }}
              />
              <span className="text-sm font-medium" style={{ color: '#A855F7' }}>{topPartner.name}</span>
              <span className="text-xs" style={{ color: '#475569' }}>×{topPartnerCount}</span>
            </button>
          </div>
        )}
      </div>

      {/* 作品列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>🎬 近5年作品</h4>
          {allDramas.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#475569' }}>暂无数据</p>
          ) : (
            <div className="flex flex-col gap-2">
              {allDramas.map((d, i) => {
                const partner = nodes.find(n => n.id === d.partnerId)
                return (
                  <div
                    key={i}
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(0,229,255,0.04)',
                      border: '1px solid rgba(0,229,255,0.1)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>《{d.title}》</p>
                    </div>
                    {partner && (
                      <button
                        className="mt-1.5 flex items-center gap-1 text-xs hover:underline transition-all"
                        style={{ color: '#00E5FF' }}
                        onClick={() => onPartnerClick(partner.id)}
                      >
                        <span>搭档：{partner.name}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部豆瓣链接 */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,229,255,0.1)' }}>
        <a
          href={`https://movie.douban.com/celebrity/${star.id}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#00E5FF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#475569' }}
        >
          <span>查看豆瓣主页</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  )
}