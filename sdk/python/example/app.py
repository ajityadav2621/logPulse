from logpulse import LogPulseClient

client = LogPulseClient(
    api_key="my-app-api-key",
    app_name="payments-api",
    base_url="http://localhost:8080",
    buffer_size=100,
    flush_interval=5,
)

client.info("service started", {"version": "1.2.3", "env": "production"})
client.warn("high latency detected", {"latency_ms": 1200, "endpoint": "/charge"})
client.error("failed to charge card", {
    "order_id": "ord_12345",
    "user_id": "usr_67890",
    "error": "card_declined",
})

print("Logs sent. Press Ctrl+C to exit.")

try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    client.close()
