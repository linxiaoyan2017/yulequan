"""
build_graph.py
合并爬取数据，构建图谱 JSON：
  - public/data/nodes.json  (明星节点)
  - public/data/edges.json  (合作边)

头像直接使用豆瓣 CDN URL，不做本地下载。
"""

import json
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DRAMA_DETAILS = SCRIPT_DIR / "data" / "raw" / "drama_details.json"
OVERRIDES_FILE = SCRIPT_DIR / "overrides.json"
OUT_DIR = SCRIPT_DIR.parent / "public" / "data"

MIN_DRAMA_COUNT = 1  # 出演 ≥ 1 部即可入图（数据量少时降低门槛）


def load_json(path: Path) -> list | dict:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    dramas: list[dict] = load_json(DRAMA_DETAILS)
    overrides: dict = load_json(OVERRIDES_FILE) if OVERRIDES_FILE.exists() else {}

    # ── 1. 从 drama_details 中直接提取明星信息 ──
    # cast 里已有 celebrity_id、name、avatar_url，无需单独的 stars.json
    star_info: dict[str, dict] = {}   # cid → {name, avatar_url}
    star_dramas: dict[str, list[dict]] = defaultdict(list)

    for drama in dramas:
        for actor in drama.get("cast", []):
            cid = actor["celebrity_id"]
            star_dramas[cid].append(drama)
            if cid not in star_info:
                star_info[cid] = {
                    "name": actor["name"],
                    "avatar": actor.get("avatar_url", ""),
                }

    # 应用 overrides.exclude
    exclude_ids: set[str] = set(overrides.get("exclude", []))

    active_stars = {
        cid for cid, d_list in star_dramas.items()
        if len(d_list) >= MIN_DRAMA_COUNT and cid not in exclude_ids
    }
    print(f"[nodes] 明星 {len(active_stars)} 位")

    # ── 2. 构建边 ──
    edge_dramas: dict[tuple[str, str], list[str]] = defaultdict(list)
    for drama in dramas:
        cast = drama.get("cast", [])
        if len(cast) < 2:
            continue
        a, b = cast[0]["celebrity_id"], cast[1]["celebrity_id"]
        if a not in active_stars or b not in active_stars or a == b:
            continue
        key = (min(a, b), max(a, b))
        edge_dramas[key].append(drama["title"])

    print(f"[edges] 合作关系 {len(edge_dramas)} 条")

    # ── 3. 节点权重 ──
    node_weight: dict[str, int] = defaultdict(int)
    for (a, b), d_list in edge_dramas.items():
        node_weight[a] += len(d_list)
        node_weight[b] += len(d_list)

    node_patches: dict = overrides.get("node_patches", {})

    nodes = []
    for cid in active_stars:
        info = star_info.get(cid, {})
        node = {
            "id": cid,
            "name": info.get("name", cid),
            "avatar": info.get("avatar", ""),   # 豆瓣 CDN URL
            "drama_count": len(star_dramas[cid]),
            "weight": node_weight.get(cid, 0),
        }
        if cid in node_patches:
            node.update(node_patches[cid])
        nodes.append(node)

    nodes.sort(key=lambda n: n["weight"], reverse=True)

    # ── 4. 边 ──
    edges = []
    for (a, b), d_list in edge_dramas.items():
        edges.append({
            "source": a,
            "target": b,
            "weight": len(d_list),
            "dramas": d_list,
        })
    edges.sort(key=lambda e: e["weight"], reverse=True)

    # ── 5. 写出 ──
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "nodes.json", "w", encoding="utf-8") as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "edges.json", "w", encoding="utf-8") as f:
        json.dump(edges, f, ensure_ascii=False, indent=2)

    print(f"✅ nodes.json → {len(nodes)} 节点")
    print(f"✅ edges.json → {len(edges)} 边")
    # 打印前几个节点预览
    print("\n--- 节点预览（Top 10）---")
    for n in nodes[:10]:
        print(f"  {n['name']}  合作{n['drama_count']}部  权重{n['weight']}")


if __name__ == "__main__":
    main()