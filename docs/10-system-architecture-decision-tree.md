---
id: DOC-10
title: System Architecture & API Troubleshooting Decision Tree
category: API Diagnostics
---

# System Architecture & API Troubleshooting Decision Tree

## Overview
This decision tree provides a systematic root-cause isolation workflow for resolving production system outages, high API latency, and cascading microservice failures.

## 1. High API Latency Diagnostic Tree
```
High API Latency Detected (>1000ms p99)
│
├── Is CPU Usage > 90% across microservices?
│   ├── YES ──> Check Garbage Collection pauses (Node.js Event Loop / Java GC).
│   │           Check high CPU JSON processing / Regex evaluation.
│   └── NO  ──> Proceed to I/O Bottleneck check.
│
├── Are Database Connection Pools exhausted?
│   ├── YES ──> Check for connection leaks in recent deployment.
│   │           Inspect slow SQL queries (>500ms execution time).
│   └── NO  ──> Proceed to External Dependency check.
│
└── Are downstream HTTP/gRPC services responding slowly?
    ├── YES ──> Check Circuit Breaker status. Implement async retry with backoff.
    └── NO  ──> Inspect network proxy / API Gateway socket pool bounds.
```

## 2. Cascading 5xx Failure Isolation Workflow
1. **Identify Ground Zero Service**: Filter APM distributed trace logs by earliest HTTP 500 timestamp and trace `X-Correlation-ID`.
2. **Check Health Endpoints**: Query `/health/liveness` and `/health/readiness` endpoints.
3. **Verify Upstream Connections**:
   - Check if database master node is reachable.
   - Check if Redis cache instance is online.
   - Check if messaging queue broker (Kafka/RabbitMQ) disk usage is full.
4. **Isolate Infrastructure vs Code**:
   - If error is `ECONNREFUSED` or `ETIMEDOUT` -> Network policy / DNS / Firewall / Security Group issue.
   - If error is `NullPointerException`, `TypeError`, or `UnhandledPromiseRejection` -> Application logic regression.

## 3. Recommended Incident Checklist
- [ ] Capture thread dump & heap snapshot before restarting container instance.
- [ ] Verify `X-Correlation-ID` header is propagated across all outgoing HTTP headers.
- [ ] Enable Circuit Breakers on failing downstream integration.
- [ ] Roll back recent deployment if error spike correlates with release timestamp.
