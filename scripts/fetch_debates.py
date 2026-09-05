#!/usr/bin/env python3
"""
Fetch the 5 debates of the 2021 Nuclear 4 Referendum from READr HackMD notes (CC0).
Saves them into data/debates/nuclear4/ as clean Markdown files.
"""

import os
import urllib.request

DEBATES = [
    {
        "filename": "01_20211113_huang_vs_tseng.md",
        "title": "第1場 11/13 正方黃士修 vs 反方曾文生 (經濟部政務次長)",
        "url": "https://hackmd.io/@readr/r1nXoeYPY/download",
    },
    {
        "filename": "02_20211118_huang_vs_hsu.md",
        "title": "第2場 11/18 正方黃士修 vs 反方許永輝 (台電核能發電處長)",
        "url": "https://hackmd.io/@55hwC9lVRf2xMfd5ca0b6w/ry-WdM5wK/download",
    },
    {
        "filename": "03_20211124_huang_vs_tsai.md",
        "title": "第3場 11/24 正方黃士修 vs 反方蔡中岳 (地球公民基金會副執行長)",
        "url": "https://hackmd.io/@55hwC9lVRf2xMfd5ca0b6w/HJbvdMqwt/download",
    },
    {
        "filename": "04_20211202_huang_vs_chiu.md",
        "title": "第4場 12/02 正方黃士修 vs 反方苗博雅 (台北市議員)",
        "url": "https://hackmd.io/@55hwC9lVRf2xMfd5ca0b6w/SkrouMcPt/download",
    },
    {
        "filename": "05_20211211_huang_vs_liang.md",
        "title": "第5場 12/11 正方黃士修 vs 反方邱威傑 (呱吉 / 台北市議員)",
        "url": "https://hackmd.io/@55hwC9lVRf2xMfd5ca0b6w/S1slFf5DK/download",
    },
]

def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "data", "debates", "nuclear4")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Fetching 5 debates into {output_dir}...")
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ToposDebateBot/1.0)"}

    import ssl
    ctx = ssl._create_unverified_context()

    for item in DEBATES:
        out_path = os.path.join(output_dir, item["filename"])
        print(f"Downloading: {item['title']} -> {item['filename']} ...")
        req = urllib.request.Request(item["url"], headers=headers)
        with urllib.request.urlopen(req, context=ctx) as resp:
            content = resp.read().decode("utf-8")
        
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Saved ({len(content)} chars)")

    print("All 5 debates downloaded successfully!")

if __name__ == "__main__":
    main()
