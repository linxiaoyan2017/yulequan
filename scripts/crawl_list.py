"""
crawl_list.py
爬取豆瓣近年高评分大陆剧列表
策略：使用豆瓣「选剧集→全部」页面的 recommend 接口
      URL: /rexxar/api/v2/tv/recommend?tags=中国大陆,{year}&sort=T
      无需登录，支持按年份+地区筛选，每年最多500条
输出：data/raw/drama_ids.json
"""

import json
import re
import time
import random
import requests
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "data" / "raw"
OUTPUT_FILE = OUTPUT_DIR / "drama_ids.json"

MIN_SCORE = 6.0  # 同步写入 score_range 参数，服务端直接过滤
_today = datetime.now()
CURRENT_YEAR = _today.year
# 近5年：从5年前的年份到今年（跨年份取整，确保完整覆盖）
START_YEAR = (_today.replace(year=_today.year - 5)).year  # 5年前的自然年
YEARS = list(range(START_YEAR, CURRENT_YEAR + 1))  # 动态滚动，永不写死
PAGE_SIZE = 20
BASE_URL = "https://m.douban.com/rexxar/api/v2/tv/recommend"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    ),
    "Referer": "https://movie.douban.com/tv/",
    "Accept": "application/json",
}


def crawl_year(session: requests.Session, year: int) -> list[dict]:
    """爬取指定年份的所有中国大陆电视剧（按热度排序，最多500条）"""
    results = []
    seen = set()
    start = 0

    while True:
        # 直接拼接 URL，避免 requests 对中文参数二次编码导致 500
        from urllib.parse import urlencode, quote
        raw_params = (
            f"refresh=0&start={start}&count={PAGE_SIZE}"
            f"&selected_categories=%7B%22%E7%B1%BB%E5%9E%8B%22%3A%22%22%2C%22%E5%BD%A2%E5%BC%8F%22%3A%22%E7%94%B5%E8%A7%86%E5%89%A7%22%7D"
            f"&uncollect=false"
            f"&score_range={int(MIN_SCORE)}%2C10"
            f"&tags={quote(f'中国大陆,电视剧,{year}')}"
        )
        url = f"{BASE_URL}?{raw_params}"
        try:
            resp = session.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                print(f"  [warn] year={year} start={start}: HTTP {resp.status_code}")
                break

            data = resp.json()
            items = data.get("items", [])
            total = data.get("total", 0)
            if not items:
                break

            added = 0
            for item in items:
                sid = str(item.get("id", ""))
                if not sid or sid in seen:
                    continue
                seen.add(sid)

                subtitle = item.get("card_subtitle", "")
                # 二次确认大陆剧
                if "中国大陆" not in subtitle and "内地" not in subtitle:
                    continue

                score = float((item.get("rating") or {}).get("value", 0) or 0)
                # score_range 已在服务端过滤，本地只做兜底（防止接口漏网）
                if score < MIN_SCORE:
                    continue

                m = re.search(r"(20\d{2})", subtitle)
                actual_year = int(m.group(1)) if m else year

                results.append({
                    "douban_id": sid,
                    "title": item.get("title", ""),
                    "year": actual_year,
                    "score": score,
                    "cover": (item.get("pic") or {}).get("normal", ""),
                })
                added += 1

            print(f"  {year} start={start}/{total}: +{added} 条，累计 {len(results)}")
            start += PAGE_SIZE
            time.sleep(random.uniform(0.6, 1.2))

            if start >= total:
                break

        except Exception as e:
            print(f"  [error] year={year} start={start}: {e}")
            break

    return results


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            existing = {d["douban_id"]: d for d in json.load(f)}
        print(f"[resume] 已有 {len(existing)} 条记录")

    all_results: dict[str, dict] = dict(existing)

    session = requests.Session()
    try:
        session.get("https://www.douban.com/", headers=HEADERS, timeout=10)
    except Exception:
        pass

    for year in YEARS:
        print(f"\n[爬取 {year} 年国产剧]")
        items = crawl_year(session, year)
        new = sum(1 for it in items if it["douban_id"] not in all_results)
        for it in items:
            all_results.setdefault(it["douban_id"], it)
        print(f"  → {year}年 新增 {new} 部，总计 {len(all_results)} 部")

    # 过滤掉窗口外的旧年份（近5年滚动，自动淘汰过期数据）
    filtered = [
        v for v in all_results.values()
        if START_YEAR <= v.get("year", 0) <= CURRENT_YEAR
    ]
    filtered = sorted(filtered, key=lambda x: (-x["score"], -x["year"]))

    dropped = len(all_results) - len(filtered)
    if dropped:
        print(f"[清理] 移除 {dropped} 部窗口外旧剧（{START_YEAR}年前）")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 共 {len(filtered)} 部剧 → {OUTPUT_FILE}")
    print("下一步：python3 crawl_detail.py")


if __name__ == "__main__":
    main()