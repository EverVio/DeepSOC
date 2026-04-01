import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path
from threading import RLock


LOG_ROOT = Path(__file__).resolve().parents[1] / "data" / "log"
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20
DEFAULT_FILENAME_PREFIX = "deepsoc_query"
AVAILABLE_EXPORT_FIELDS = [
    "record_id",
    "_id",
    "db_type",
    "risk_level",
    "source",
    "source_dataset",
    "source_url",
    "fetched_at",
    "confidence",
    "verified",
    "cve_id",
    "ioc_value",
    "affected_product",
    "payload",
    "tags",
    "mitre_attack_id",
    "raw_content_hash",
    "search_content",
    "record_file",
    "record_line",
    "details",
]
DEFAULT_EXPORT_FIELDS = [
    "record_id",
    "db_type",
    "risk_level",
    "source",
    "fetched_at",
    "confidence",
    "verified",
    "cve_id",
    "ioc_value",
    "affected_product",
    "payload",
    "tags",
    "mitre_attack_id",
    "raw_content_hash",
    "search_content",
]

_CACHE_LOCK = RLock()
_CACHE_SIGNATURE = None
_CACHE_RECORDS = []


def _iter_jsonl_files(log_root: Path) -> list[Path]:
    if not log_root.exists():
        return []
    return sorted(log_root.rglob("*.jsonl"))


def _build_signature(files: list[Path]) -> tuple:
    parts = []
    for file_path in files:
        stat = file_path.stat()
        parts.append((str(file_path), int(stat.st_mtime_ns), int(stat.st_size)))
    return tuple(parts)


def _parse_iso_to_ts(raw_value: str) -> int | None:
    text = str(raw_value or "").strip()
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")
    if " " in normalized and "T" not in normalized:
        normalized = normalized.replace(" ", "T")

    try:
        return int(datetime.fromisoformat(normalized).timestamp())
    except ValueError:
        return None


def _to_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ",".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def _sanitize_filename_prefix(raw_value: str) -> str:
    normalized = _to_text(raw_value)
    safe = re.sub(r"[^0-9A-Za-z._-]+", "_", normalized).strip("._")
    return safe or DEFAULT_FILENAME_PREFIX


def _to_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).replace(";", ",").split(",") if item.strip()]


def _normalize_record(record: dict, file_path: Path, line_no: int) -> dict:
    normalized = dict(record)
    normalized["_record_id"] = (
        _to_text(normalized.get("_id"))
        or _to_text(normalized.get("raw_content_hash"))
        or f"{file_path.name}:{line_no}"
    )
    normalized["_source_file"] = str(file_path)
    normalized["_line_no"] = line_no
    normalized["__fetched_ts"] = _parse_iso_to_ts(normalized.get("fetched_at"))
    normalized["risk_level"] = _to_text(normalized.get("risk_level")) or "Info"
    normalized["db_type"] = _to_text(normalized.get("db_type")) or "unknown"
    normalized["source"] = _to_text(normalized.get("source")) or "unknown"
    normalized["tags"] = _to_list(normalized.get("tags"))
    normalized["mitre_attack_id"] = _to_list(normalized.get("mitre_attack_id"))
    return normalized


def _load_records() -> list[dict]:
    global _CACHE_SIGNATURE, _CACHE_RECORDS
    files = _iter_jsonl_files(LOG_ROOT)
    signature = _build_signature(files)

    with _CACHE_LOCK:
        if signature == _CACHE_SIGNATURE:
            return _CACHE_RECORDS

        records = []
        for file_path in files:
            with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
                for line_no, raw_line in enumerate(handle, start=1):
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        parsed = json.loads(line)
                    except ValueError:
                        continue
                    if not isinstance(parsed, dict):
                        continue
                    records.append(_normalize_record(parsed, file_path, line_no))

        _CACHE_SIGNATURE = signature
        _CACHE_RECORDS = records
        return _CACHE_RECORDS


def _contains_value(actual: list[str], expected: str) -> bool:
    target = expected.strip().lower()
    if not target:
        return True
    return any(target == item.strip().lower() for item in actual)


def _match_record(record: dict, query: str, filters: dict, start_ts: int | None, end_ts: int | None) -> bool:
    if query:
        query_text = query.strip().lower()
        searchable = "\n".join(
            [
                _to_text(record.get("search_content")),
                _to_text(record.get("cve_id")),
                _to_text(record.get("ioc_value")),
                _to_text(record.get("payload")),
                _to_text(record.get("affected_product")),
                _to_text(record.get("source")),
                _to_text(record.get("db_type")),
                _to_text(record.get("risk_level")),
                ",".join(record.get("tags") or []),
                ",".join(record.get("mitre_attack_id") or []),
            ]
        ).lower()
        if query_text not in searchable:
            return False

    db_type = _to_text(filters.get("db_type"))
    if db_type and _to_text(record.get("db_type")).lower() != db_type.lower():
        return False

    risk_level = _to_text(filters.get("risk_level"))
    if risk_level and _to_text(record.get("risk_level")).lower() != risk_level.lower():
        return False

    source = _to_text(filters.get("source"))
    if source and _to_text(record.get("source")).lower() != source.lower():
        return False

    cve_id = _to_text(filters.get("cve_id"))
    if cve_id and _to_text(record.get("cve_id")).lower() != cve_id.lower():
        return False

    ioc_value = _to_text(filters.get("ioc_value"))
    if ioc_value and _to_text(record.get("ioc_value")).lower() != ioc_value.lower():
        return False

    tag = _to_text(filters.get("tag"))
    if tag and not _contains_value(record.get("tags") or [], tag):
        return False

    mitre_attack_id = _to_text(filters.get("mitre_attack_id"))
    if mitre_attack_id and not _contains_value(record.get("mitre_attack_id") or [], mitre_attack_id):
        return False

    fetched_ts = record.get("__fetched_ts")
    if start_ts is not None:
        if fetched_ts is None or fetched_ts < start_ts:
            return False

    if end_ts is not None:
        if fetched_ts is None or fetched_ts > end_ts:
            return False

    return True


def _sort_records(records: list[dict], sort_by: str, sort_order: str) -> list[dict]:
    sort_key = (sort_by or "fetched_at").strip().lower()
    descending = (sort_order or "desc").strip().lower() != "asc"

    risk_rank = {
        "critical": 5,
        "high": 4,
        "medium": 3,
        "low": 2,
        "info": 1,
    }

    def key_func(item: dict):
        if sort_key == "confidence":
            return float(item.get("confidence") or 0)
        if sort_key == "risk_level":
            return risk_rank.get(_to_text(item.get("risk_level")).lower(), 0)
        if sort_key == "source":
            return _to_text(item.get("source")).lower()
        if sort_key == "db_type":
            return _to_text(item.get("db_type")).lower()
        return int(item.get("__fetched_ts") or 0)

    return sorted(records, key=key_func, reverse=descending)


def _build_facets(records: list[dict]) -> dict:
    db_type_counts = {}
    risk_level_counts = {}
    source_counts = {}

    for item in records:
        db_type = _to_text(item.get("db_type")) or "unknown"
        risk_level = _to_text(item.get("risk_level")) or "Info"
        source = _to_text(item.get("source")) or "unknown"

        db_type_counts[db_type] = int(db_type_counts.get(db_type, 0)) + 1
        risk_level_counts[risk_level] = int(risk_level_counts.get(risk_level, 0)) + 1
        source_counts[source] = int(source_counts.get(source, 0)) + 1

    return {
        "db_type": [{"name": key, "count": value} for key, value in sorted(db_type_counts.items(), key=lambda x: x[1], reverse=True)],
        "risk_level": [{"name": key, "count": value} for key, value in sorted(risk_level_counts.items(), key=lambda x: x[1], reverse=True)],
        "source": [{"name": key, "count": value} for key, value in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)],
    }


def _to_list_item(record: dict) -> dict:
    text = _to_text(record.get("search_content"))
    summary = text if len(text) <= 180 else f"{text[:180]}..."
    return {
        "record_id": record.get("_record_id"),
        "_id": record.get("_id"),
        "db_type": record.get("db_type"),
        "risk_level": record.get("risk_level"),
        "source": record.get("source"),
        "fetched_at": record.get("fetched_at"),
        "confidence": record.get("confidence"),
        "verified": bool(record.get("verified", False)),
        "cve_id": record.get("cve_id"),
        "ioc_value": record.get("ioc_value"),
        "payload": record.get("payload"),
        "affected_product": record.get("affected_product"),
        "mitre_attack_id": record.get("mitre_attack_id") or [],
        "tags": record.get("tags") or [],
        "raw_content_hash": record.get("raw_content_hash"),
        "search_content": summary,
    }


def list_query_records(
    query: str,
    page: int,
    page_size: int,
    filters: dict,
    start_time: str,
    end_time: str,
    sort_by: str,
    sort_order: str,
) -> dict:
    normalized_page = max(int(page or 1), 1)
    normalized_page_size = int(page_size or DEFAULT_PAGE_SIZE)
    normalized_page_size = min(max(normalized_page_size, 1), MAX_PAGE_SIZE)

    start_ts = _parse_iso_to_ts(start_time)
    end_ts = _parse_iso_to_ts(end_time)

    records = _load_records()
    matched = [
        item
        for item in records
        if _match_record(item, query, filters, start_ts, end_ts)
    ]
    sorted_records = _sort_records(matched, sort_by, sort_order)

    total = len(sorted_records)
    start = (normalized_page - 1) * normalized_page_size
    end = start + normalized_page_size
    page_items = sorted_records[start:end]

    return {
        "items": [_to_list_item(item) for item in page_items],
        "total": total,
        "page": normalized_page,
        "page_size": normalized_page_size,
        "sort_by": (sort_by or "fetched_at").strip().lower(),
        "sort_order": (sort_order or "desc").strip().lower(),
        "facets": _build_facets(matched),
        "applied_filters": {
            "q": query,
            **{key: value for key, value in filters.items() if _to_text(value)},
            "start_time": start_time,
            "end_time": end_time,
        },
    }


def _get_filtered_sorted_records(
    query: str,
    filters: dict,
    start_time: str,
    end_time: str,
    sort_by: str,
    sort_order: str,
) -> list[dict]:
    start_ts = _parse_iso_to_ts(start_time)
    end_ts = _parse_iso_to_ts(end_time)
    records = _load_records()
    matched = [
        item
        for item in records
        if _match_record(item, query, filters, start_ts, end_ts)
    ]
    return _sort_records(matched, sort_by, sort_order)


def get_query_record_detail(record_id: str) -> dict | None:
    target = _to_text(record_id)
    if not target:
        return None

    for item in _load_records():
        if _to_text(item.get("_record_id")) == target:
            return {
                "record_id": item.get("_record_id"),
                "metadata": {
                    "_id": item.get("_id"),
                    "db_type": item.get("db_type"),
                    "risk_level": item.get("risk_level"),
                    "source": item.get("source"),
                    "source_dataset": item.get("source_dataset"),
                    "source_url": item.get("source_url"),
                    "fetched_at": item.get("fetched_at"),
                    "confidence": item.get("confidence"),
                    "verified": bool(item.get("verified", False)),
                    "cve_id": item.get("cve_id"),
                    "ioc_value": item.get("ioc_value"),
                    "payload": item.get("payload"),
                    "affected_product": item.get("affected_product"),
                    "mitre_attack_id": item.get("mitre_attack_id") or [],
                    "tags": item.get("tags") or [],
                    "raw_content_hash": item.get("raw_content_hash"),
                    "record_file": item.get("_source_file"),
                    "record_line": item.get("_line_no"),
                },
                "search_content": _to_text(item.get("search_content")),
                "details": item.get("details"),
            }
    return None


def get_query_facets(query: str, filters: dict, start_time: str, end_time: str) -> dict:
    matched = _get_filtered_sorted_records(
        query=query,
        filters=filters,
        start_time=start_time,
        end_time=end_time,
        sort_by="fetched_at",
        sort_order="desc",
    )
    return {
        "total": len(matched),
        "facets": _build_facets(matched),
    }


def _normalize_export_fields(selected_fields: list[str] | None, include_details: bool) -> list[str]:
    requested = []
    if selected_fields:
        requested = [
            field.strip()
            for field in selected_fields
            if field and field.strip() in AVAILABLE_EXPORT_FIELDS
        ]

    fields = requested or list(DEFAULT_EXPORT_FIELDS)
    if include_details and "details" not in fields:
        fields.append("details")
    if not include_details and "details" in fields:
        fields = [item for item in fields if item != "details"]
    return fields


def _to_export_row(record: dict, include_details: bool) -> dict:
    base = {
        "record_id": record.get("_record_id"),
        "_id": record.get("_id"),
        "db_type": record.get("db_type"),
        "risk_level": record.get("risk_level"),
        "source": record.get("source"),
        "source_dataset": record.get("source_dataset"),
        "source_url": record.get("source_url"),
        "fetched_at": record.get("fetched_at"),
        "confidence": record.get("confidence"),
        "verified": bool(record.get("verified", False)),
        "cve_id": record.get("cve_id"),
        "ioc_value": record.get("ioc_value"),
        "affected_product": record.get("affected_product"),
        "payload": record.get("payload"),
        "tags": record.get("tags") or [],
        "mitre_attack_id": record.get("mitre_attack_id") or [],
        "raw_content_hash": record.get("raw_content_hash"),
        "search_content": _to_text(record.get("search_content")),
        "record_file": record.get("_source_file"),
        "record_line": record.get("_line_no"),
        "details": record.get("details") if include_details else None,
    }
    return base


def export_query_records(
    export_format: str,
    query: str,
    filters: dict,
    start_time: str,
    end_time: str,
    sort_by: str,
    sort_order: str,
    export_scope: str = "all",
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    selected_fields: list[str] | None = None,
    include_details: bool = False,
    filename_prefix: str = DEFAULT_FILENAME_PREFIX,
) -> tuple[str, str, str]:
    sorted_records = _get_filtered_sorted_records(
        query=query,
        filters=filters,
        start_time=start_time,
        end_time=end_time,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    normalized_scope = (export_scope or "all").strip().lower()
    if normalized_scope == "current_page":
        normalized_page = max(int(page or 1), 1)
        normalized_page_size = min(max(int(page_size or DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
        start = (normalized_page - 1) * normalized_page_size
        end = start + normalized_page_size
        export_records = sorted_records[start:end]
    else:
        export_records = sorted_records

    fields = _normalize_export_fields(selected_fields, include_details)
    rows = [_to_export_row(item, include_details) for item in export_records]

    normalized_format = (export_format or "csv").strip().lower()
    safe_prefix = _sanitize_filename_prefix(filename_prefix)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if normalized_format == "json":
        payload_items = []
        for row in rows:
            payload_items.append({field: row.get(field) for field in fields})
        payload = json.dumps(payload_items, ensure_ascii=False, indent=2)
        return payload, "application/json; charset=utf-8", f"{safe_prefix}_{timestamp}.json"

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()

    for row in rows:
        csv_row = {}
        for field in fields:
            value = row.get(field)
            if isinstance(value, list):
                csv_row[field] = ",".join(str(item) for item in value)
            elif isinstance(value, dict):
                csv_row[field] = json.dumps(value, ensure_ascii=False)
            elif value is None:
                csv_row[field] = ""
            else:
                csv_row[field] = value
        writer.writerow(csv_row)

    return buffer.getvalue(), "text/csv; charset=utf-8", f"{safe_prefix}_{timestamp}.csv"