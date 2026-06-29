from __future__ import annotations

import os
import sys
from concurrent import futures
from pathlib import Path

import grpc
from grpc_tools import protoc

from .patterns import Kline, backend_name, normalize_patterns, scan_latest, to_public_pattern


ROOT = Path(__file__).resolve().parents[4]
PROTO_DIR = ROOT / "protos"
GENERATED_DIR = Path(__file__).resolve().parent / "_generated"
PROTO_FILE = PROTO_DIR / "candlestick_pattern.proto"


def generate_proto() -> None:
    GENERATED_DIR.mkdir(exist_ok=True)
    result = protoc.main(
        [
            "grpc_tools.protoc",
            f"-I{PROTO_DIR}",
            f"--python_out={GENERATED_DIR}",
            f"--grpc_python_out={GENERATED_DIR}",
            str(PROTO_FILE),
        ]
    )
    if result != 0:
        raise RuntimeError(f"protoc failed with exit code {result}")
    if str(GENERATED_DIR) not in sys.path:
        sys.path.insert(0, str(GENERATED_DIR))


generate_proto()

import candlestick_pattern_pb2 as pb2  # noqa: E402
import candlestick_pattern_pb2_grpc as pb2_grpc  # noqa: E402


class CandlestickPatternServicer(pb2_grpc.CandlestickPatternServiceServicer):
    def HealthCheck(self, request, context):
        return pb2.HealthCheckResponse(ok=True, backend=backend_name())

    def ScanPatterns(self, request, context):
        try:
            internal_patterns = normalize_patterns(request.patterns)
        except ValueError as exc:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))

        results = []
        for symbol_payload in request.symbols:
            klines = [
                Kline(
                    timestamp=item.timestamp,
                    open=item.open,
                    high=item.high,
                    low=item.low,
                    close=item.close,
                    volume=item.volume,
                )
                for item in symbol_payload.klines
            ]
            try:
                signal_time, values = scan_latest(klines, internal_patterns)
            except Exception as exc:
                context.abort(grpc.StatusCode.INTERNAL, str(exc))

            results.append(
                pb2.SymbolPatternResult(
                    symbol=symbol_payload.symbol,
                    timeframe=request.timeframe,
                    signal_time=signal_time,
                    signals=[
                        pb2.PatternSignal(pattern=to_public_pattern(pattern), value=value)
                        for pattern, value in values.items()
                    ],
                )
            )

        return pb2.ScanPatternsResponse(results=results)


def serve() -> None:
    host = os.getenv("PATTERN_GRPC_HOST", "127.0.0.1")
    port = int(os.getenv("PATTERN_GRPC_PORT", "50051"))
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    pb2_grpc.add_CandlestickPatternServiceServicer_to_server(
        CandlestickPatternServicer(), server
    )
    address = f"{host}:{port}"
    server.add_insecure_port(address)
    server.start()
    print(f"[pattern-service] ready on {address} backend={backend_name()}", flush=True)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
