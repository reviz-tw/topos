#!/usr/bin/env python3
"""
Chunking and embedding preparation script for Topos debates.
Reads Markdown files from data/debates/sports_station/ and outputs:
1. Semantic text chunks in JSON Lines format: data/debates/sports_station_chunks.jsonl
2. Ready for Google Cloud Storage (GCS) upload and Vertex AI Search Data Store ingestion.
"""

import os
import re
import json

DEBATES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "debates", "sports_station")
OUTPUT_JSONL = os.path.join(os.path.dirname(__file__), "..", "data", "debates", "sports_station_chunks.jsonl")

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
            chunk_id = f"{filename}_{len(chunks)+1:03d}"
            chunks.append({
                "id": chunk_id,
                "topic": topic,
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
            # If buffer gets too long (over ~600 chars), split on paragraph break
            if len("".join(buffer)) > 700 and line.strip() == "":
                flush_chunk()
                
    flush_chunk()
    return chunks

def main():
    if not os.path.exists(DEBATES_DIR):
        print(f"Error: {DEBATES_DIR} not found.")
        return

    all_chunks = []
    for f in sorted(os.listdir(DEBATES_DIR)):
        if f.endswith(".md"):
            p = os.path.join(DEBATES_DIR, f)
            print(f"Chunking {f}...")
            chunks = chunk_markdown_file(p)
            print(f"  -> Generated {len(chunks)} chunks")
            all_chunks.extend(chunks)

    os.makedirs(os.path.dirname(OUTPUT_JSONL), exist_ok=True)
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as out:
        for c in all_chunks:
            out.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"\nTotal chunks generated: {len(all_chunks)}")
    print(f"Saved to: {OUTPUT_JSONL}")

if __name__ == "__main__":
    main()
