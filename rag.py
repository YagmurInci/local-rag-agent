#!/usr/bin/env python3
"""
Python RAG Module & CLI Tool for Software Architecture & API Assistant.
Provides Python support for searching local SQLite vector database (data/rag.db)
and retrieving contextual chunks for LLM inference.
"""
import os
import sys
import json
import math
import sqlite3
import re
from pathlib import Path

# Force UTF-8 output encoding for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Paths
ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "data" / "rag.db"


def tokenize(text: str) -> list[str]:
    """Tokenize and lowercase text, stripping punctuation."""
    words = re.findall(r"\b[a-zA-Z0-9_]{2,}\b", text.lower())
    return words


def compute_tf(tokens: list[str]) -> dict[str, float]:
    """Compute term frequency dict for tokens."""
    if not tokens:
        return {}
    tf = {}
    total = len(tokens)
    for token in tokens:
        tf[token] = tf.get(token, 0.0) + 1.0
    for k in tf:
        tf[k] = tf[k] / total
    return tf


def cosine_similarity(vec1: dict[str, float], vec2: dict[str, float]) -> float:
    """Compute cosine similarity between two TF vectors."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0

    dot_product = sum(vec1[k] * vec2[k] for k in intersection)
    mag1 = math.sqrt(sum(v ** 2 for v in vec1.values()))
    mag2 = math.sqrt(sum(v ** 2 for v in vec2.values()))

    if mag1 == 0.0 or mag2 == 0.0:
        return 0.0

    return dot_product / (mag1 * mag2)


class LocalRAG:
    """Python interface for local SQLite Vector Store."""

    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(
                f"Database file not found at {self.db_path}. Please run 'npm run ingest' first."
            )

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        """Search top-K relevant chunks in SQLite for a query."""
        tokens = tokenize(query)
        if not tokens:
            return []

        query_tf = compute_tf(tokens)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, doc_id, title, category, chunk_index, content, tf_json FROM chunks")
        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            chunk_id, doc_id, title, category, chunk_index, content, tf_json = row
            try:
                raw_tf = json.loads(tf_json)
                tf_map = dict(raw_tf) if isinstance(raw_tf, list) else (raw_tf if isinstance(raw_tf, dict) else {})
            except Exception:
                tf_map = {}

            score = cosine_similarity(query_tf, tf_map)
            if score > 0:
                results.append({
                    "id": chunk_id,
                    "doc_id": doc_id,
                    "title": title,
                    "category": category,
                    "chunk_index": chunk_index,
                    "content": content,
                    "score": round(score, 4)
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


def main():
    if len(sys.argv) < 2:
        print("Usage: python rag.py \"<your architectural or API question>\"")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    print(f"\n🔍 Searching local RAG database for: \"{query}\"\n")

    rag = LocalRAG()
    results = rag.search(query, top_k=3)

    if not results:
        print("❌ No relevant documents found.")
        sys.exit(0)

    print(f"✅ Found {len(results)} relevant chunks:\n")
    for i, res in enumerate(results, 1):
        print(f"--- Result {i}: {res['title']} [{res['category']}] (Score: %{int(res['score']*100)}) ---")
        print(f"{res['content'][:300]}...\n")


if __name__ == "__main__":
    main()
