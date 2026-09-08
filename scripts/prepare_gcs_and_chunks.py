#!/usr/bin/env python3
"""
Comprehensive Chunking and Embedding preparation script for Topos.
Processes BOTH:
1. Formal policy & debate Markdown documents (01 to 04)
2. Raw citizen Threads dataset (threads_dataset_raw.json)

Outputs:
- data/debates/sports_station_chunks.jsonl (Ready for Vertex AI Search Data Store / Vector Search)
"""

import os
import re
import json

BASE_DIR = os.path.dirname(__file__)
DEBATES_DIR = os.path.join(BASE_DIR, "..", "data", "debates", "sports_station")
RAW_THREADS_JSON = os.path.join(DEBATES_DIR, "threads_dataset_raw.json")
OUTPUT_JSONL = os.path.join(BASE_DIR, "..", "data", "debates", "sports_station_chunks.jsonl")

def chunk_markdown_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    filename = os.path.basename(file_path)
    topic = "sports-station"
    chunks = []
    
    current_h1 = ""
    current_h2 = ""
    current_h3 = ""
    buffer = []
    
    def flush_chunk():
        text = "".join(buffer).strip()
        if text and len(text) > 40:
            section_title = current_h3 or current_h2 or current_h1 or "概述"
            chunk_id = f"doc_{filename.split('.')[0]}_{len(chunks)+1:03d}"
            chunks.append({
                "id": chunk_id,
                "topic": topic,
                "sourceType": "formal_document",
                "source": filename,
                "documentTitle": current_h1 or filename,
                "section": section_title,
                "content": text,
                "charCount": len(text)
            })
        buffer.clear()

    for line in lines:
        if line.startswith("# "):
            flush_chunk()
            current_h1 = line.strip("# \n")
        elif line.startswith("## "):
            flush_chunk()
            current_h2 = line.strip("# \n")
            current_h3 = ""
        elif line.startswith("### "):
            flush_chunk()
            current_h3 = line.strip("# \n")
        elif line.startswith("---") and len(buffer) > 10:
            flush_chunk()
        else:
            buffer.append(line)
            if len("".join(buffer)) > 700 and line.strip() == "":
                flush_chunk()
                
    flush_chunk()
    return chunks

def chunk_threads_dataset(json_path):
    if not os.path.exists(json_path):
        print(f"Warning: {json_path} not found.")
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    seen_ids = set()
    chunks = []
    
    # Slogan filter
    slogan_pattern = re.compile(r"票投沈伯洋.*把樹種回來|阿中遺憾補起來")

    for item in data:
        pid = item.get("id")
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)
        
        text = item.get("text", "").strip()
        if len(text) < 35:
            continue
        if slogan_pattern.search(text):
            continue

        author = item.get("author", "anonymous")
        author_name = item.get("author_name", "")
        likes = item.get("like_count", 0)
        replies = item.get("reply_count", 0)
        url = item.get("url", "")
        
        # Determine thematic section
        section = "市民公眾討論"
        if any(w in text for w in ["偷拍", "性騷擾", "治安", "死角", "性暴力", "女性安全"]):
            section = "市民反映：治安與隱私顧慮"
        elif any(w in text for w in ["收起來", "浪費", "蚊子", "維護", "誰要", "大安森林公園", "現成", "虧損", "大灑幣"]):
            section = "市民反映：營運成本與永續性質疑"
        elif any(w in text for w in ["爬山", "四獸山", "象山", "山徑", "登山", "司機", "外送", "推車", "狗", "毛家庭", "更衣", "洗澡"]):
            section = "市民反映：多元生活與戶外需求"
        elif any(w in text for w in ["數據", "主計處", "75%", "頻率", "時間", "習慣"]):
            section = "市民反映：運動習慣與數據佐證"
        elif any(w in text for w in ["建議", "希望", "許願", "如果", "搭配", "結合"]):
            section = "市民反映：具體政策建議與配套"

        # Format content for embedding / search
        enriched_content = f"【Threads 市民發言】作者: {author_name} (@{author}) | 讚數: {likes}\n觀點焦點: {section}\n發言內容: {text}"

        chunks.append({
            "id": f"threads_{pid}",
            "topic": "sports-station",
            "sourceType": "citizen_voice_threads",
            "source": "threads_dataset_raw.json",
            "documentTitle": "Threads 市民公眾討論與意見回饋",
            "section": section,
            "author": author,
            "authorName": author_name,
            "likes": likes,
            "replies": replies,
            "url": url,
            "content": enriched_content,
            "charCount": len(enriched_content)
        })

    return chunks

def main():
    print(f"=== Topos Debate & Citizen Voice Ingestion ===")
    
    # 1. Process Markdown files
    all_chunks = []
    if os.path.exists(DEBATES_DIR):
        for f in sorted(os.listdir(DEBATES_DIR)):
            if f.endswith(".md"):
                p = os.path.join(DEBATES_DIR, f)
                print(f"Processing Markdown document: {f}...")
                doc_chunks = chunk_markdown_file(p)
                print(f"  -> Generated {len(doc_chunks)} chunks")
                all_chunks.extend(doc_chunks)

    # 2. Process Raw Threads dataset
    print(f"\nProcessing Raw Threads dataset: {os.path.basename(RAW_THREADS_JSON)}...")
    thread_chunks = chunk_threads_dataset(RAW_THREADS_JSON)
    print(f"  -> Extracted & structured {len(thread_chunks)} high-quality citizen voice chunks")
    all_chunks.extend(thread_chunks)

    # 3. Output to JSONL
    os.makedirs(os.path.dirname(OUTPUT_JSONL), exist_ok=True)
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as out:
        for c in all_chunks:
            out.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"\n=======================================================")
    print(f"SUCCESS: Total {len(all_chunks)} semantic chunks generated.")
    print(f"  - Formal Stakeholder Documents: {len(all_chunks) - len(thread_chunks)} chunks")
    print(f"  - Citizen Perspectives (Threads): {len(thread_chunks)} chunks")
    print(f"Output saved to: {OUTPUT_JSONL}")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
