---
id: DOC-05
title: API Rate Limiting & Throttling Strategies
category: API Diagnostics
---

# API Rate Limiting & Throttling Strategies

## Overview
Rate limiting protects APIs from denial of service (DoS), web scraping abuse, and resource starvation caused by runaway client scripts.

## 1. Rate Limiting Algorithms
1. **Token Bucket**:
   - Bucket holds up to `N` tokens. Tokens refill at rate `R` per second.
   - Incoming request consumes 1 token. If bucket empty, request rejected with HTTP 429.
   - Ideal for allowing short bursts of traffic while enforcing average rate.
2. **Leaky Bucket**:
   - Requests enter a FIFO queue. Requests leak out of bucket at fixed constant rate.
   - Smooths out bursts into steady stream. Good for protecting slow legacy backends.
3. **Sliding Window Log / Counter**:
   - Tracks timestamp of requests in Redis zset or window counter.
   - Prevents edge-burst attacks where double the limit occurs right at window boundaries (unlike Fixed Window).

## 2. Standard Rate Limit Response Headers
APIs must return standard rate limit metadata in HTTP response headers:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1672531200
Retry-After: 30
```

## 3. Distributed Rate Limiting with Redis
- **Atomic Lua Script**: When operating across a multi-node API gateway cluster, rate counters must be evaluated atomically in Redis via Lua scripts to avoid race conditions.
- **Fallthrough Strategy**: If Redis cache drops or times out, gateway should fail-open or fallback to local in-memory token bucket to avoid total API outage.
