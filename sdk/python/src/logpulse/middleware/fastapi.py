from __future__ import annotations

import time
from typing import Callable
from logpulse import LogPulseClient


def fastapi_middleware(client: LogPulseClient) -> Callable:
    async def middleware(request, call_next):
        start = time.time()
        response = await call_next(request)
        latency = (time.time() - start) * 1000
        fields = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "latency": f"{latency:.0f}ms",
            "client_ip": request.client.host if request.client else None,
        }

        if response.status_code >= 500:
            client.error("request failed", fields)
        elif response.status_code >= 400:
            client.warn("request failed", fields)
        else:
            client.info("request", fields)

        return response

    return middleware
