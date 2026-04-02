"""
seed_ids.py
手动维护的种子剧集列表（2020-2025年高分国产剧豆瓣ID）
用于补充 recent_hot 接口无法覆盖的历史数据
运行后将这些 ID 合并进 drama_ids.json
"""

import json
import time
import random
import requests
from pathlib import Path

OUTPUT_FILE = Path(__file__).parent / "data" / "raw" / "drama_ids.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    ),
    "Referer": "https://movie.douban.com/",
    "Accept": "application/json",
}

# 2020-2025 高分/高热度国产剧豆瓣ID（手动整理）
SEED_IDS = [
    # 2025
    "36382628",  # 海市蜃楼
    "35559998",  # 骄阳似我
    "36686673",  # 玉茗茶骨
    "35748834",  # 国色芳华
    "36566542",  # 惜花芷
    "35879792",  # 永夜星河
    "36176780",  # 追风者
    "36154853",  # 与凤行
    "35923662",  # 庆余年 第二季
    "36480108",  # 墨雨云间
    "36726251",  # 白月梵星
    "36542090",  # 春色寄情人
    "35883833",  # 狐妖小红娘月红篇
    "36119053",  # 长相思 第二季
    "36565561",  # 大奉打更人

    # 2024
    "35231822",  # 繁花
    "36078016",  # 甜蜜暴击
    "35586545",  # 玫瑰的故事
    "35589278",  # 承欢记
    "35726662",  # 南来北往
    "35764986",  # 与凤行
    "36206364",  # 好团圆
    "35989250",  # 边水往事
    "36112345",  # 哈尔滨一九四四
    "35778223",  # 猎冰
    "35898017",  # 惜花芷
    "36032493",  # 围城
    "36042771",  # 烟火人家
    "35921219",  # 城中之城
    "36059587",  # 我的阿勒泰
    "35677016",  # 度华年
    "36264648",  # 熟年

    # 2023
    "35227851",  # 漫长的季节
    "35723760",  # 一念关山
    "35715692",  # 古相思曲
    "35500734",  # 狂飙
    "35611467",  # 三体
    "35547645",  # 去有风的地方
    "35689728",  # 长相思
    "35776066",  # 莲花楼
    "35561416",  # 宁安如梦
    "35799198",  # 云之羽
    "35487108",  # 显微镜下的大明
    "35677015",  # 照亮你
    "35559127",  # 他是谁
    "35792798",  # 许你万丈光芒好
    "35881000",  # 我们的日子

    # 2022
    "35267752",  # 开端
    "35252655",  # 苍兰诀
    "35261785",  # 梦华录
    "35418116",  # 沙漠之王
    "35053165",  # 风起洛阳
    "35238082",  # 人世间
    "34935502",  # 山河令
    "35309663",  # 二十不惑2
    "35312405",  # 卿卿日常
    "35231516",  # 传闻中的陈芊芊
    "35420023",  # 星汉灿烂
    "35463082",  # 与君初相识
    "35430965",  # 沉香如屑
    "35233529",  # 天才基本法
    "35396815",  # 对你的爱很美

    # 2021
    "33459952",  # 山海情
    "34867492",  # 觉醒年代
    "33441694",  # 扫黑风暴
    "34472135",  # 理想之城
    "34956872",  # 锦心似玉
    "34973476",  # 你是我的城池营垒
    "33404425",  # 大宋少年志2
    "34813671",  # 赘婿
    "30465307",  # 司藤
    "34427245",  # 流金岁月
    "35063699",  # 御赐小仵作
    "34787574",  # 有翡
    "35070656",  # 我是余欢水

    # 2020
    "30180436",  # 清平乐
    "30479068",  # 安家
    "33377779",  # 龙岭迷窟
    "34703534",  # 隐秘的角落
    "33432656",  # 沉默的真相
    "30476949",  # 大江大河2
    "33387227",  # 传闻中的陈芊芊
    "30468940",  # 亲爱的自己
    "33380802",  # 以家人之名
    "34867492",  # 觉醒年代
]


def fetch_basic_info(douban_id: str) -> dict | None:
    """从 rexxar API 获取剧集基本信息"""
    url = f"https://m.douban.com/rexxar/api/v2/tv/{douban_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        d = resp.json()
        title = d.get("title", "")
        year = int(d.get("year", 0) or 0)
        score = float((d.get("rating") or {}).get("value", 0) or 0)
        subtitle = d.get("card_subtitle", "")
        countries = d.get("countries", [])
        is_mainland = (
            "中国大陆" in countries or "内地" in countries
            or "中国大陆" in subtitle or "内地" in subtitle
        )
        if not is_mainland:
            print(f"  ✗ {title} 非大陆剧，跳过")
            return None
        print(f"  ✓ {title} ({year}) 评分{score}")
        return {
            "douban_id": douban_id,
            "title": title,
            "year": year,
            "score": score,
            "cover": (d.get("pic") or {}).get("normal", ""),
        }
    except Exception as e:
        print(f"  [error] {douban_id}: {e}")
        return None


def main():
    # 加载已有数据
    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            existing = {d["douban_id"]: d for d in json.load(f)}
    print(f"[resume] 已有 {len(existing)} 条")

    pending = [sid for sid in SEED_IDS if sid not in existing]
    print(f"[plan] 需新增 {len(pending)} 部种子剧集\n")

    results = dict(existing)
    for i, sid in enumerate(pending):
        print(f"[{i+1}/{len(pending)}] ID={sid}")
        info = fetch_basic_info(sid)
        if info:
            results[sid] = info
        time.sleep(random.uniform(0.6, 1.2))

    all_list = list(results.values())
    all_list.sort(key=lambda x: (-x["score"], -x["year"]))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_list, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 共 {len(all_list)} 部剧 → {OUTPUT_FILE}")
    print("下一步：python3 crawl_detail.py")


if __name__ == "__main__":
    main()
