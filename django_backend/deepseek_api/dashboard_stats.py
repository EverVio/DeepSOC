import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator


RISK_LEVEL_ORDER = ["Critical", "High", "Medium", "Low", "Info"]
DB_TYPE_LABELS = {
    "ioc": "IOC",
    "cve": "CVE",
    "web_attack": "WebAttack",
    "strategy": "Strategy",
    "case": "Case",
}


def _default_log_root() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "log"


def _normalize_risk_level(raw_value: Any) -> str:
    lowered = str(raw_value or "").strip().lower()
    mapping = {
        "critical": "Critical",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
        "info": "Info",
    }
    return mapping.get(lowered, "Info")


def _normalize_db_type(raw_value: Any) -> str:
    value = str(raw_value or "").strip().lower()
    return value if value else "unknown"


def _normalize_tags(raw_tags: Any) -> list[str]:
    if raw_tags is None:
        return []
    if isinstance(raw_tags, list):
        return [str(tag).strip() for tag in raw_tags if str(tag).strip()]
    if isinstance(raw_tags, str):
        return [item.strip() for item in raw_tags.split(",") if item.strip()]
    return []


def _iter_jsonl_files(log_root: Path) -> list[Path]:
    if not log_root.exists():
        return []
    return sorted(log_root.rglob("*.jsonl"))


def _iter_jsonl_records(file_path: Path) -> Iterator[Dict[str, Any]]:
    with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            data = json.loads(stripped)
            if isinstance(data, dict):
                yield data


def _build_topology(db_type_counts, tag_counts_by_db_type):
    nodes = [
        {
            "id": "core",
            "name": "DeepSOC Core",
            "type": "core",
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "value": 1,
        }
    ]
    links = []

    db_types = sorted(db_type_counts.items(), key=lambda item: item[1], reverse=True)
    if not db_types:
        return {"nodes": nodes, "links": links}

    category_radius = 34.0
    source_ring_radius = 12.0
    node_ids = {"core"}

    for idx, (db_type, count) in enumerate(db_types):
        angle = (2 * math.pi * idx) / max(1, len(db_types))
        cx = category_radius * math.cos(angle)
        cz = category_radius * math.sin(angle)
        cy = (idx % 3 - 1) * 4.0

        category_name = DB_TYPE_LABELS.get(db_type, db_type)
        category_id = f"db_type:{db_type}"
        nodes.append(
            {
                "id": category_id,
                "name": category_name,
                "type": "db_type",
                "x": round(cx, 3),
                "y": round(cy, 3),
                "z": round(cz, 3),
                "value": int(count),
            }
        )
        node_ids.add(category_id)

        links.append(
            {
                "source": "core",
                "target": category_id,
                "weight": int(count),
                "severity": "medium",
            }
        )

        tag_items = sorted(
            tag_counts_by_db_type[db_type].items(),
            key=lambda item: item[1],
            reverse=True,
        )[:8]

        for s_idx, (tag, tag_count) in enumerate(tag_items):
            source_angle = (2 * math.pi * s_idx) / max(1, len(tag_items))
            sx = cx + source_ring_radius * math.cos(source_angle)
            sz = cz + source_ring_radius * math.sin(source_angle)
            sy = cy + ((s_idx % 2) * 3 - 1.5)

            tag_id = f"tag:{tag}"
            if tag_id not in node_ids:
                nodes.append(
                    {
                        "id": tag_id,
                        "name": tag,
                        "type": "tag",
                        "x": round(sx, 3),
                        "y": round(sy, 3),
                        "z": round(sz, 3),
                        "value": int(tag_count),
                    }
                )
                node_ids.add(tag_id)

            severity = "low"
            if tag_count >= 40:
                severity = "high"
            elif tag_count >= 15:
                severity = "medium"

            links.append(
                {
                    "source": category_id,
                    "target": tag_id,
                    "weight": int(tag_count),
                    "severity": severity,
                }
            )

    return {"nodes": nodes, "links": links}


def build_dashboard_stats(log_root: Path | None = None) -> dict:
    root = log_root or _default_log_root()

    source_counts = defaultdict(int)
    db_type_counts = defaultdict(int)
    risk_counts = defaultdict(int)
    tag_counts_by_db_type = defaultdict(lambda: defaultdict(int))
    timeline = []

    for jsonl_file in _iter_jsonl_files(root):
        file_count = 0
        file_latest_ts = int(jsonl_file.stat().st_mtime)

        for record in _iter_jsonl_records(jsonl_file):
            file_count += 1

            db_type = _normalize_db_type(record.get("db_type"))
            risk_level = _normalize_risk_level(record.get("risk_level"))
            source = str(record.get("source") or "unknown")
            tags = _normalize_tags(record.get("tags"))

            source_counts[source] += 1
            db_type_counts[db_type] += 1
            risk_counts[risk_level] += 1

            for tag in tags[:20]:
                tag_counts_by_db_type[db_type][tag] += 1

            fetched_at = str(record.get("fetched_at") or "").strip()
            if fetched_at:
                normalized = fetched_at.replace("Z", "+00:00")
                try:
                    ts = int(datetime.fromisoformat(normalized).timestamp())
                    file_latest_ts = max(file_latest_ts, ts)
                except ValueError:
                    pass

        if file_count == 0:
            continue

        timeline.append(
            {
                "label": jsonl_file.parent.name,
                "file": jsonl_file.name,
                "value": file_count,
                "updated_at": file_latest_ts,
                "updated_text": datetime.fromtimestamp(file_latest_ts).strftime("%m-%d %H:%M"),
            }
        )

    source_series = [
        {"name": key, "value": value}
        for key, value in sorted(source_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    category_series = [
        {"name": DB_TYPE_LABELS.get(key, key), "value": value}
        for key, value in sorted(db_type_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    threat_series = [
        {"name": level, "level": level.lower(), "value": int(risk_counts.get(level, 0))}
        for level in RISK_LEVEL_ORDER
    ]

    latest_timeline = sorted(timeline, key=lambda item: item["updated_at"])[-12:]
    topology = _build_topology(db_type_counts, tag_counts_by_db_type)

    return {
        "summary": {
            "total_records": int(sum(source_counts.values())),
            "total_sources": int(len(source_counts)),
            "total_categories": int(len(db_type_counts)),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        "source_counts": source_series,
        "category_counts": category_series,
        "threat_distribution": threat_series,
        "timeline": latest_timeline,
        "topology": topology,
    }
