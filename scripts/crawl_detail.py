"""
crawl_detail.py
读取 drama_ids.json，通过豆瓣 rexxar API 获取剧集详情和主演信息
无需浏览器，无需登录
输出：data/raw/drama_details.json
"""

import json
import time
import random
import requests
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
INPUT_FILE = SCRIPT_DIR / "data" / "raw" / "drama_ids.json"
OUTPUT_FILE = SCRIPT_DIR / "data" / "raw" / "drama_details.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    ),
    "Referer": "https://movie.douban.com/",
    "Accept": "application/json",
}

MAINLAND_KEYWORDS = ["中国大陆", "内地"]
MIN_SCORE = 6.0


def get_celebrities(douban_id: str) -> list[dict] | None:
    """通过 rexxar celebrities 接口获取主演列表（含 celebrity ID）"""
    url = f"https://m.douban.com/rexxar/api/v2/tv/{douban_id}/celebrities"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        actors = data.get("actors", [])
        result = []
        for actor in actors[:2]:  # 只取前2位主演
            cid = str(actor.get("id", ""))
            name = actor.get("name", "")
            avatar = (actor.get("avatar") or {}).get("normal", "")
            if cid and name:
                result.append({
                    "celebrity_id": cid,
                    "name": name,
                    "avatar_url": avatar,
                })
        return result if len(result) >= 2 else None
    except Exception as e:
        print(f"  [celebrities error] {douban_id}: {e}")
        return None


def get_drama_detail(drama: dict) -> dict | None:
    """通过 rexxar API 获取剧集详情，过滤非大陆 / 低分"""
    douban_id = drama["douban_id"]
    url = f"https://m.douban.com/rexxar/api/v2/tv/{douban_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()

        # 地区过滤
        countries = data.get("countries", [])
        subtitle = data.get("card_subtitle", "")
        is_mainland = (
            any(k in countries for k in MAINLAND_KEYWORDS)
            or any(k in subtitle for k in MAINLAND_KEYWORDS)
        )
        if not is_mainland:
            return None

        # 评分
        score = float((data.get("rating") or {}).get("value", 0) or 0)
        if score > 0 and score < MIN_SCORE:
            return None

        # 年份
        year = drama.get("year") or int(data.get("year", 0) or 0)

        return {
            "douban_id": douban_id,
            "title": drama["title"],
            "year": year,
            "score": score,
        }
    except Exception as e:
        print(f"  [detail error] {douban_id}: {e}")
        return None


def main():
    if not INPUT_FILE.exists():
        print(f"❌ 找不到 {INPUT_FILE}，请先运行 crawl_list.py")
        return

    with open(INPUT_FILE, encoding="utf-8") as f:
        dramas: list[dict] = json.load(f)

    # 加载已有详情（增量）
    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            existing = {d["douban_id"]: d for d in json.load(f)}
        print(f"[resume] 已有详情 {len(existing)} 条")

    pending = [d for d in dramas if d["douban_id"] not in existing]
    print(f"[plan] 待爬取 {len(pending)} 部剧（共 {len(dramas)} 部）")

    results: dict[str, dict] = dict(existing)

    for i, drama in enumerate(pending):
        douban_id = drama["douban_id"]
        print(f"[{i+1}/{len(pending)}] {drama['title']} ({douban_id})")

        # Step 1: 获取剧集详情（过滤）
        detail = get_drama_detail(drama)
        if not detail:
            print(f"  ✗ 跳过（非大陆/评分不足）")
            time.sleep(random.uniform(0.5, 1.0))
            continue

        # Step 2: 获取主演 celebrity ID
        time.sleep(random.uniform(0.5, 1.2))
        cast = get_celebrities(douban_id)
        if not cast:
            print(f"  ✗ 跳过（主演信息不足）")
            time.sleep(random.uniform(0.5, 1.0))
            continue

        detail["cast"] = cast
        results[douban_id] = detail
        print(f"  ✓ 评分{detail['score']} | 主演: {[c['name'] for c in cast]}")

        # 每10条保存一次
        if (i + 1) % 10 == 0:
            _save(results)
            print(f"  [checkpoint] 已保存 {len(results)} 条")

        time.sleep(random.uniform(1.0, 2.5))

    _save(results)
    print(f"\n✅ 详情爬取完成，共 {len(results)} 部 → {OUTPUT_FILE}")
    print("下一步：python3 crawl_star.py")


def _save(data: dict[str, dict]):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(list(data.values()), f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()