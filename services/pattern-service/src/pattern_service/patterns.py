from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

try:
    import pandas_ta_classic as ta  # noqa: F401
except Exception as exc:  # pragma: no cover - surfaced by health checks at runtime
    ta = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


PATTERN_MAP: dict[str, str] = {
    "DOJI": "doji",
    "HAMMER": "hammer",
    "INVERTED_HAMMER": "invertedhammer",
    "HANGING_MAN": "hangingman",
    "SHOOTING_STAR": "shootingstar",
    "ENGULFING": "engulfing",
    "MORNING_STAR": "morningstar",
    "EVENING_STAR": "eveningstar",
    "HARAMI": "harami",
    "PIERCING": "piercing",
    "DARK_CLOUD_COVER": "darkcloudcover",
    "THREE_WHITE_SOLDIERS": "3whitesoldiers",
    "THREE_BLACK_CROWS": "3blackcrows",
    "INSIDE": "inside",
}


@dataclass(frozen=True)
class Kline:
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


def backend_name() -> str:
    return "pandas-ta-classic"


def ensure_backend_ready() -> None:
    if _IMPORT_ERROR is not None:
        raise RuntimeError(f"pandas-ta-classic is unavailable: {_IMPORT_ERROR}")


def normalize_patterns(patterns: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    for pattern in patterns:
        key = pattern.strip().upper()
        if not key:
            continue
        mapped = PATTERN_MAP.get(key)
        if not mapped:
            raise ValueError(f"Unsupported candlestick pattern: {pattern}")
        if mapped not in normalized:
            normalized.append(mapped)
    return normalized


def _normalize_column_name(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def scan_latest(klines: list[Kline], patterns: list[str]) -> tuple[int, dict[str, int]]:
    ensure_backend_ready()
    if len(klines) == 0:
        return 0, {}

    df = pd.DataFrame(
        [
            {
                "open": item.open,
                "high": item.high,
                "low": item.low,
                "close": item.close,
                "volume": item.volume,
            }
            for item in klines
        ]
    )

    result = df.ta.cdl_pattern(name=patterns)
    if result is None:
        result = df

    last = result.iloc[-1]
    values: dict[str, int] = {}
    normalized_columns = {
        _normalize_column_name(str(column)): column for column in result.columns
    }

    for internal_name in patterns:
        column = None
        expected = _normalize_column_name(internal_name)
        for normalized, candidate in normalized_columns.items():
            if normalized.endswith(expected):
                column = candidate
                break

        raw_value = last[column] if column is not None else 0
        try:
            values[internal_name] = int(raw_value)
        except Exception:
            values[internal_name] = 0

    return int(klines[-1].timestamp), values


def to_public_pattern(internal_name: str) -> str:
    for public, mapped in PATTERN_MAP.items():
        if mapped == internal_name:
            return public
    return internal_name.upper()
