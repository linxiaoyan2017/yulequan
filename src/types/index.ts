// 明星节点
export interface StarNode {
  id: string           // 豆瓣 celebrity ID
  name: string         // 明星姓名
  avatar: string       // 头像 URL（豆瓣 CDN）
  drama_count: number  // 近5年作品数量
  weight: number       // 合作权重（用于节点大小）
  // 以下为前端运行时计算，不在 JSON 中
  centrality?: number
  top_partner?: string
}

// 合作关系边
export interface DramaEdge {
  source: string       // 明星 id
  target: string       // 明星 id
  weight: number       // 合作剧数量
  dramas: string[]     // 合作剧名列表
}

// 完整图数据
export interface GraphData {
  nodes: StarNode[]
  edges: DramaEdge[]
}

// 数据元信息
export interface MetaInfo {
  last_updated: string
  node_count: number
  edge_count: number
  drama_count?: number
}

// 图谱高亮状态
export type HighlightMode = 'none' | 'search' | 'path' | 'node'

export interface HighlightState {
  mode: HighlightMode
  focusedNodeId?: string
  highlightedNodeIds?: Set<string>
  highlightedEdgeIds?: Set<string>
  pathNodeIds?: string[]
  pathEdgeIds?: string[]
}