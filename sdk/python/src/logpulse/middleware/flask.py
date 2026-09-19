import time
from logpulse import LogPulseClient


def flask_middleware(client: LogPulseClient):
    def before_request():
        from flask import g
        g.start_time = time.time()

    def after_request(response):
        from flask import request, g
        start = getattr(g, "start_time", None)
        latency = (time.time() - start) * 1000 if start else 0
        fields = {
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "latency": f"{latency:.0f}ms",
            "client_ip": request.remote_addr,
        }

        if response.status_code >= 500:
            client.error("request failed", fields)
        elif response.status_code >= 400:
            client.warn("request failed", fields)
        else:
            client.info("request", fields)

        return response

    return before_request, after_request
