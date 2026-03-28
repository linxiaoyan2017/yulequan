"""
crawl_list.py
爬取豆瓣近年高评分大陆剧列表
策略：利用豆瓣 /rexxar/api/v2/subject/recent_hot/tv 接口（无需登录）
      按 type=tv_domestic（国产剧）翻页，过滤年份和评分
输出：data/raw/drama_ids.json
"""

import asyncio
import json
import re
import random
from pathlib import Path
from playwright.async_api import async_playwright

OUTPUT_DIR = Path(__file__).parent / "data" / "raw"
OUTPUT_FILE = OUTPUT_DIR / "drama_ids.json"

MIN_SCORE = 6.0
YEARS = list(range(2021, 2027))
PAGE_SIZE = 20
MAX_PAGES = 30  # 最多爬 30 页 × 20 = 600 条

BASE_API = (
    "https://m.douban.com/rexxar/api/v2/subject/recent_hot/{type}"
    "?start={start}&limit={page_size}"
)

# 国产剧 + 综合两个 type 都爬，确保覆盖全
TYPES = ["tv_domestic", "tv"]

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def parse_subtitle(subtitle: str) -> tuple[int | None, bool]:
    """
    解析 card_subtitle，如：'2024 / 中国大陆 / 剧情 爱情 / 导演 / 主演'
    返回 (year, is_mainland)
    """
    year = None
    m = re.search(r"(20\d{2})", subtitle)
    if m:
        year = int(m.group(1))
    is_mainland = "中国大陆" in subtitle or "内地" in subtitle
    return year, is_mainland


async def crawl_type(page, tv_type: str) -> list[dict]:
    results = []
    seen_ids = set()

    for p in range(MAX_PAGES):
        start = p * PAGE_SIZE
        url = BASE_API.format(type=tv_type, start=start, page_size=PAGE_SIZE)
        try:
            resp = await page.request.get(
                url,
                headers={
                    "User-Agent": UA,
                    "Referer": "https://movie.douban.com/",
                    "Accept": "application/json",
                },
            )
            if resp.status != 200:
                print(f"  [warn] type={tv_type} page={p}: status {resp.status}")
                break

            data = await resp.json()
            items = data.get("items", [])
            if not items:
                print(f"  [done] type={tv_type} 第 {p} 页无数据，停止")
                break

            added = 0
            for item in items:
                sid = str(item.get("id", ""))
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)

                subtitle = item.get("card_subtitle", "")
                year, is_mainland = parse_subtitle(subtitle)
                score = float((item.get("rating") or {}).get("value", 0) or 0)
                title = item.get("title", "")

                # 过滤条件
                if not is_mainland:
                    continue
                if year and year not in YEARS:
                    continue
                # score 可能为 0（评分人数不足），先收下，detail 阶段再过滤
                if score > 0 and score < MIN_SCORE:
                    continue

                results.append({
                    "douban_id": sid,
                    "title": title,
                    "year": year or 0,
                    "score": score,
                    "cover": (item.get("pic") or {}).get("normal", ""),
                })
                added += 1

            print(f"  [type={tv_type}] page={p}: +{added} 条符合，累计 {len(results)}")
            await asyncio.sleep(random.uniform(1.0, 2.5))

        except Exception as e:
            print(f"  [error] type={tv_type} page={p}: {e}")
            break

    return results


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 加载已有数据（增量）
    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            data = json.load(f)
            existing = {d["douban_id"]: d for d in data}
        print(f"[resume] 已有 {len(existing)} 条记录")

    all_results: dict[str, dict] = dict(existing)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(user_agent=UA, locale="zh-CN")
        # 先访问一次豆瓣主页，获得基础 Cookie
        page = await ctx.new_page()
        await page.goto("https://movie.douban.com/tv/", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        for tv_type in TYPES:
            print(f"\n[crawl] type={tv_type}")
            items = await crawl_type(page, tv_type)
            for item in items:
                if item["douban_id"] not in all_results:
                    all_results[item["douban_id"]] = item

        await browser.close()

    # 最终过滤 & 排序
    filtered = [
        v for v in all_results.values()
        if v["year"] in YEARS and (v["score"] == 0 or v["score"] >= MIN_SCORE)
    ]
    filtered.sort(key=lambda x: (-x["score"], -x["year"]))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 共 {len(filtered)} 部剧 → {OUTPUT_FILE}")
    print("下一步：python3 crawl_detail.py")


if __name__ == "__main__":
    asyncio.run(main())