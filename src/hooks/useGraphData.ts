import { useState, useEffect } from 'react'
import type { GraphData, MetaInfo } from '../types'

interface UseGraphDataReturn {
  data: GraphData | null
  meta: MetaInfo | null
  loading: boolean
  error: string | null
}

export function useGraphData(): UseGraphDataReturn {
  const [data, setData] = useState<GraphData | null>(null)
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [nodesRes, edgesRes, metaRes] = await Promise.all([
          fetch('/data/nodes.json'),
          fetch('/data/edges.json'),
          fetch('/data/meta.json'),
        ])
        // nodes.json 和 edges.json 直接是数组
        const nodes = await nodesRes.json()
        const edges = await edgesRes.json()
        const metaJson: MetaInfo = await metaRes.json()

        setData({ nodes, edges })
        setMeta(metaJson)
      } catch (e) {
        setError('数据加载失败，请刷新重试')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { data, meta, loading, error }
}