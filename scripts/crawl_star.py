"""
crawl_star.py
读取 drama_details.json，提取所有明星 celebrity_id，
通过豆瓣 rexxar API 获取明星信息，下载头像到 public/data/avatars/
无需浏览器，无需登录
输出：data/raw/stars.json
"""

import json
import time
import random
import requests
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
INPUT_FILE = SCRIPT_DIR / "data" / "raw" / "drama_details.json"
OUTPUT_FILE = SCRIPT_DIR / "data" / "raw" / "stars.json"
AVATAR_DIR = SCRIPT_DIR.parent / "public" / "data" / "avatars"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    ),
    "Referer": "https://movie.douban.com/",
    "Accept": "application/json",
}

IMG_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "Referer": "https://movie.douban.com/",
}


def download_avatar(url: str, save_path: Path) -> bool:
    if save_path.exists():
        return True
    if not url:
        return False
    try:
        resp = requests.get(url, headers=IMG_HEADERS, timeout=15)
        if resp.status_code == 200:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            save_path.write_bytes(resp.content)
            return True
        return False
    except Exception as e:
        print(f"  [avatar error] {url}: {e}")
        return False


def main():
    if not INPUT_FILE.exists():
        print(f"❌ 找不到 {INPUT_FILE}，请先运行 crawl_detail.py")
        return

    with open(INPUT_FILE, encoding="utf-8") as f:
        dramas: list[dict] = json.load(f)

    # 收集所有明星（从 drama_details 里的 cast 直接拿，已含头像URL）
    star_map: dict[str, dict] = {}
    for d in dramas:
        for c in d.get("cast", []):
            cid = c["celebrity_id"]
            if cid not in star_map:
                star_map[cid] = {
                    "celebrity_id": cid,
                    "name": c["name"],
                    "avatar_url": c.get("avatar_url", ""),
                    "avatar_local": "",
                }

    print(f"[plan] 共 {len(star_map)} 位明星需要处理")
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    # 加载已有数据
    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            existing = {s["celebrity_id"]: s for s in json.load(f)}
        print(f"[resume] 已有 {len(existing)} 位")

    results: dict[str, dict] = dict(existing)

    pending = [(cid, info) for cid, info in star_map.items() if cid not in existing]
    print(f"[plan] 待下载头像 {len(pending)} 位")

    for i, (cid, info) in enumerate(pending):
        print(f"[{i+1}/{len(pending)}] {info['name']} ({cid})")

        # 下载头像（URL 已经从 celebrities API 拿到了）
        avatar_local = ""
        if info["avatar_url"]:
            save_path = AVATAR_DIR / f"{cid}.jpg"
            ok = download_avatar(info["avatar_url"], save_path)
            if ok:
                avatar_local = f"/data/avatars/{cid}.jpg"
                print(f"  ✓ 头像已保存")
            else:
                print(f"  ✗ 头像下载失败")
        else:
            print(f"  - 无头像URL")

        results[cid] = {
            "celebrity_id": cid,
            "name": info["name"],
            "avatar_url": info["avatar_url"],
            "avatar_local": avatar_local,
        }

        if (i + 1) % 20 == 0:
            _save(results)
            print(f"  [checkpoint] 已保存 {len(results)} 位")

        time.sleep(random.uniform(0.3, 0.8))

    _save(results)
    print(f"\n✅ 明星信息完成，共 {len(results)} 位 → {OUTPUT_FILE}")
    print("下一步：python3 build_graph.py")


def _save(data: dict[str, dict]):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(list(data.values()), f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()