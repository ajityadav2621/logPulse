from __future__ import annotations

import json
import os
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from queue import Queue, Empty
from threading import Thread, Event

DEFAULT_BASE_URL = "http://localhost:8080"
DEFAULT_BUFFER_SIZE = 100
DEFAULT_FLUSH_INTERVAL = 5


@dataclass
class LogEntry:
    app_name: str
    level: str
    message: str
    meta: Optional[Dict[str, Any]] = field(default=None)
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class LogPulseClient:
    def __init__(
        self,
        api_key: str,
        app_name: str,
        base_url: str = DEFAULT_BASE_URL,
        buffer_size: int = DEFAULT_BUFFER_SIZE,
        flush_interval: int = DEFAULT_FLUSH_INTERVAL,
    ) -> None:
        self.api_key = api_key
        self.app_name = app_name
        self.base_url = base_url.rstrip("/")
        self.buffer: Queue = Queue(maxsize=buffer_size)
        self.buffer_size = buffer_size
        self.flush_interval = flush_interval
        self._stop = Event()
        self._worker: Optional[Thread] = Thread(target=self._flush_worker, daemon=True)
        self._worker.start()

    def _send_sync(self, entry: LogEntry) -> None:
        payload = json.dumps(entry.__dict__).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/logs",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status >= 400:
                    print(f"logpulse: ingest failed with status {resp.status}")
        except urllib.error.HTTPError as e:
            print(f"logpulse: ingest failed with status {e.code}: {e.reason}")
        except Exception as e:
            print(f"logpulse: ingest failed: {e}")

    def _flush_worker(self) -> None:
        while not self._stop.is_set():
            time.sleep(self.flush_interval)
            batch: List[LogEntry] = []
            while True:
                try:
                    batch.append(self.buffer.get_nowait())
                except Empty:
                    break
            for entry in batch:
                self._send_sync(entry)

    def _enqueue(self, entry: LogEntry) -> None:
        if self._stop.is_set():
            return
        try:
            self.buffer.put_nowait(entry)
        except Exception:
            self._send_sync(entry)

    def log(self, level: str, message: str, fields: Optional[Dict[str, Any]] = None) -> None:
        entry = LogEntry(
            app_name=self.app_name,
            level=level,
            message=message,
            meta=fields or {},
        )
        self._enqueue(entry)

    def info(self, message: str, fields: Optional[Dict[str, Any]] = None) -> None:
        self.log("info", message, fields)

    def warn(self, message: str, fields: Optional[Dict[str, Any]] = None) -> None:
        self.log("warn", message, fields)

    def error(self, message: str, fields: Optional[Dict[str, Any]] = None) -> None:
        self.log("error", message, fields)

    def flush(self) -> None:
        batch: List[LogEntry] = []
        while True:
            try:
                batch.append(self.buffer.get_nowait())
            except Empty:
                break
        for entry in batch:
            self._send_sync(entry)

    def close(self) -> None:
        self._stop.set()
        if self._worker.is_alive():
            self._worker.join(timeout=5)
        self.flush()


_global_client: Optional[LogPulseClient] = None


def init_global(api_key: str, app_name: str, **kwargs) -> None:
    global _global_client
    _global_client = LogPulseClient(api_key, app_name, **kwargs)


def get_global() -> Optional[LogPulseClient]:
    return _global_client


def global_info(message: str, fields: Optional[Dict[str, Any]] = None) -> None:
    if not _global_client:
        print("logpulse: global client not initialized")
        return
    _global_client.info(message, fields)


def global_warn(message: str, fields: Optional[Dict[str, Any]] = None) -> None:
    if not _global_client:
        print("logpulse: global client not initialized")
        return
    _global_client.warn(message, fields)


def global_error(message: str, fields: Optional[Dict[str, Any]] = None) -> None:
    if not _global_client:
        print("logpulse: global client not initialized")
        return
    _global_client.error(message, fields)
