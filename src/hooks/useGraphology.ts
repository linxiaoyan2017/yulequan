import { useMemo } from 'react'
import Graph from 'graphology'
import type { GraphData } from '../types'

export function useGraphology(data: GraphData | null) {
  const graph = useMemo(() => {
    if (!data) return null
    const g = new Graph({ multi: false, type: 'undirected' })

    for (const node of data.nodes) {
      g.addNode(node.id, { ...node })
    }

    for (const edge of data.edges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        if (!g.hasEdge(edge.source, edge.target)) {
          g.addEdge(edge.source, edge.target, { dramas: edge.dramas })
        }
      }
    }

    return g
  }, [data])

  return graph
}
