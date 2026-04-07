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
MITRE_TACTIC_LABELS = {
    "TA0001": "Initial Access",
    "TA0002": "Execution",
    "TA0003": "Persistence",
    "TA0004": "Privilege Escalation",
    "TA0005": "Defense Evasion",
    "TA0006": "Credential Access",
    "TA0007": "Discovery",
    "TA0008": "Lateral Movement",
    "TA0009": "Collection",
    "TA0010": "Exfiltration",
    "TA0011": "Command and Control",
    "TA0040": "Impact",
}
MITRE_TECHNIQUE_TO_TACTIC = {
    "T1190": "Initial Access",
    "T1110": "Credential Access",
    "T1046": "Discovery",
    "T1008": "Command and Control",
    "T1071": "Command and Control",
    "T1105": "Command and Control",
    "T1505.003": "Persistence",
    "T1005": "Collection",
    "T1025": "Collection",
}
TOP_N_TAGS_PER_DB_TYPE = 3
TIMELINE_BUCKET_SECONDS = 3600
TIMELINE_WINDOW_SIZE = 16


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


def _normalize_mitre_ids(raw_ids: Any) -> list[str]:
    if raw_ids is None:
        return []
    if isinstance(raw_ids, list):
        return [str(item).strip() for item in raw_ids if str(item).strip()]
    if isinstance(raw_ids, str):
        return [item.strip() for item in raw_ids.replace(";", ",").split(",") if item.strip()]
    return []


def _normalize_confidence(raw_value: Any) -> float:
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return 0.0
    if value < 0:
        return 0.0
    if value > 100:
        return 100.0
    return value


def _normalize_verified(raw_value: Any) -> bool:
    if isinstance(raw_value, bool):
        return raw_value
    text = str(raw_value or "").strip().lower()
    return text in {"true", "1", "yes", "y"}


def _parse_record_timestamp(record: Dict[str, Any], fallback_ts: int) -> int:
    fetched_at = str(record.get("fetched_at") or "").strip()
    if not fetched_at:
        return fallback_ts

    normalized = fetched_at.replace("Z", "+00:00")
    try:
        return int(datetime.fromisoformat(normalized).timestamp())
    except ValueError:
        return fallback_ts


def _extract_tactic_label(mitre_id: str) -> str:
    if not mitre_id:
        return "Unknown"

    normalized = mitre_id.strip().upper()
    if normalized in MITRE_TACTIC_LABELS:
        return MITRE_TACTIC_LABELS[normalized]

    return MITRE_TECHNIQUE_TO_TACTIC.get(normalized, "Unknown")


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
    confidence_sum_by_db_type = defaultdict(float)
    confidence_count_by_db_type = defaultdict(int)
    tag_confidence_sum_by_db_type = defaultdict(lambda: defaultdict(float))
    tag_confidence_count_by_db_type = defaultdict(lambda: defaultdict(int))

    timeline_buckets = defaultdict(
        lambda: {
            "total": 0,
            "sources": defaultdict(int),
            "cve_counts": defaultdict(int),
            "ioc_counts": defaultdict(int),
            "updated_at": 0,
        }
    )

    tactic_total_counts = defaultdict(int)
    tactic_verified_counts = defaultdict(int)
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
            confidence = _normalize_confidence(record.get("confidence"))
            verified = _normalize_verified(record.get("verified"))
            cve_id = str(record.get("cve_id") or "").strip()
            ioc_value = str(record.get("ioc_value") or "").strip()
            mitre_ids = _normalize_mitre_ids(record.get("mitre_attack_id"))
            record_ts = _parse_record_timestamp(record, file_latest_ts)
            file_latest_ts = max(file_latest_ts, record_ts)
            bucket_ts = record_ts - (record_ts % TIMELINE_BUCKET_SECONDS)

            source_counts[source] += 1
            db_type_counts[db_type] += 1
            risk_counts[risk_level] += 1
            confidence_sum_by_db_type[db_type] += confidence
            confidence_count_by_db_type[db_type] += 1

            for tag in tags[:20]:
                tag_counts_by_db_type[db_type][tag] += 1
                tag_confidence_sum_by_db_type[db_type][tag] += confidence
                tag_confidence_count_by_db_type[db_type][tag] += 1

            bucket = timeline_buckets[bucket_ts]
            bucket["total"] += 1
            bucket["sources"][source] += 1
            bucket["updated_at"] = max(bucket["updated_at"], record_ts)
            if cve_id:
                bucket["cve_counts"][cve_id] += 1
            if ioc_value:
                bucket["ioc_counts"][ioc_value] += 1

            for mitre_id in mitre_ids:
                tactic_label = _extract_tactic_label(mitre_id)
                if tactic_label == "Unknown":
                    continue
                tactic_total_counts[tactic_label] += 1
                if verified or confidence >= 85:
                    tactic_verified_counts[tactic_label] += 1

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

    category_quality = []
    for db_type, total in sorted(db_type_counts.items(), key=lambda item: item[1], reverse=True):
        avg_confidence = 0.0
        if confidence_count_by_db_type[db_type] > 0:
            avg_confidence = confidence_sum_by_db_type[db_type] / confidence_count_by_db_type[db_type]

        top_tags = []
        for tag, count in sorted(
            tag_counts_by_db_type[db_type].items(),
            key=lambda item: item[1],
            reverse=True,
        )[:TOP_N_TAGS_PER_DB_TYPE]:
            tag_avg_confidence = 0.0
            if tag_confidence_count_by_db_type[db_type][tag] > 0:
                tag_avg_confidence = (
                    tag_confidence_sum_by_db_type[db_type][tag]
                    / tag_confidence_count_by_db_type[db_type][tag]
                )

            top_tags.append(
                {
                    "name": tag,
                    "value": int(count),
                    "avg_confidence": round(tag_avg_confidence, 1),
                }
            )

        category_quality.append(
            {
                "db_type": db_type,
                "name": DB_TYPE_LABELS.get(db_type, db_type),
                "value": int(total),
                "avg_confidence": round(avg_confidence, 1),
                "top_tags": top_tags,
            }
        )

    timeline_slices = []
    for bucket_ts, bucket_data in sorted(timeline_buckets.items(), key=lambda item: item[0])[-TIMELINE_WINDOW_SIZE:]:
        source_items = [
            {"name": source, "value": int(count)}
            for source, count in sorted(bucket_data["sources"].items(), key=lambda item: item[1], reverse=True)
        ]

        top_cve_id = ""
        top_ioc_value = ""
        top_cve_count = 0
        top_ioc_count = 0
        if bucket_data["cve_counts"]:
            top_cve_id, top_cve_count = max(bucket_data["cve_counts"].items(), key=lambda item: item[1])
        if bucket_data["ioc_counts"]:
            top_ioc_value, top_ioc_count = max(bucket_data["ioc_counts"].items(), key=lambda item: item[1])

        dominant_feature = ""
        if top_cve_count >= top_ioc_count and top_cve_count > 0:
            dominant_feature = f"突增归因：关联 {top_cve_id}"
        elif top_ioc_count > 0:
            dominant_feature = f"突增归因：恶意指标 {top_ioc_value}"

        timeline_slices.append(
            {
                "bucket": bucket_ts,
                "label": datetime.fromtimestamp(bucket_ts).strftime("%m-%d %H:%M"),
                "updated_at": int(bucket_data["updated_at"] or bucket_ts),
                "total": int(bucket_data["total"]),
                "sources": source_items,
                "top_cve_id": top_cve_id,
                "top_ioc_value": top_ioc_value,
                "dominant_feature": dominant_feature,
            }
        )

    tactic_items = [
        {
            "name": tactic,
            "total": int(total),
            "verified": int(tactic_verified_counts.get(tactic, 0)),
        }
        for tactic, total in sorted(tactic_total_counts.items(), key=lambda item: item[1], reverse=True)
        if tactic != "Unknown"
    ][:8]

    if not tactic_items:
        tactic_items = [
            {"name": "Initial Access", "total": int(risk_counts.get("High", 0) + risk_counts.get("Critical", 0)), "verified": int(risk_counts.get("Critical", 0))},
            {"name": "Execution", "total": int(risk_counts.get("Medium", 0) + risk_counts.get("High", 0)), "verified": int(risk_counts.get("High", 0))},
            {"name": "Command and Control", "total": int(risk_counts.get("Medium", 0) + risk_counts.get("Critical", 0)), "verified": int(risk_counts.get("Critical", 0))},
            {"name": "Discovery", "total": int(risk_counts.get("Medium", 0)), "verified": int(risk_counts.get("High", 0))},
            {"name": "Collection", "total": int(risk_counts.get("Low", 0) + risk_counts.get("Medium", 0)), "verified": int(risk_counts.get("Medium", 0))},
        ]

    radar_indicators = []
    radar_total_values = []
    radar_verified_values = []
    for item in tactic_items:
        max_value = max(item["total"], item["verified"], 1)
        radar_indicators.append(
            {
                "name": item["name"],
                "max": int(max_value),
            }
        )
        radar_total_values.append(int(item["total"]))
        radar_verified_values.append(int(item["verified"]))

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
        "category_quality": category_quality,
        "threat_distribution": threat_series,
        "timeline": latest_timeline,
        "timeline_slices": timeline_slices,
        "radar_tactics": {
            "indicators": radar_indicators,
            "total_values": radar_total_values,
            "verified_values": radar_verified_values,
            "items": tactic_items,
        },
        "topology": topology,
    }
