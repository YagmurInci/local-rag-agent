---
id: DOC-08
title: Redis & Caching Architecture Strategies
category: System Architecture
---

# Redis & Caching Architecture Strategies

## Overview
Caching reduces database read pressure and speeds up API response latency from hundreds of milliseconds to sub-5ms. Improper cache patterns, however, cause data inconsistency and cache stampedes.

## 1. Core Caching Patterns
1. **Cache-Aside (Lazy Loading)**:
   - Application checks cache for key. On hit, return data. On miss, read from DB, write key to cache with TTL, return data.
   - Recommended default pattern for general read workloads.
2. **Write-Through**:
   - Application writes data to cache and database synchronously in single transaction.
   - Ensures cache is never stale, but increases write latency.
3. **Write-Behind (Write-Back)**:
   - Application writes to cache immediately. Async worker periodically flushes accumulated cache writes to database in batch.
   - High performance write speed, but risk of data loss if cache node crashes before flush.

## 2. Troubleshooting Cache Failures
1. **Cache Stampede (Thundering Herd)**:
   - Cause: High-traffic key expires. Hundreds of concurrent requests experience cache miss at the same instant and simultaneously query database.
   - Fix: Use Mutex Lock (Redis `SETNX`), or Probabilistic Early Expiration (XFetch algorithm), or background worker refresh before TTL expires.
2. **Cache Penetration**:
   - Cause: Clients request non-existent keys (e.g. `user/invalid_id`), bypassing cache and hitting DB on every request.
   - Fix: Cache empty/null results with short TTL (e.g. 30s) or use Bloom Filter in front of cache.
3. **Cache Avalanche**:
   - Cause: Thousands of keys set with identical TTL expire at the exact same minute.
   - Fix: Add random jitter to TTL values (e.g., `TTL = 3600s + random(0, 300s)`).

## 3. Redis Eviction Policies
- **volatile-lru**: Evict least recently used key among those with set TTL.
- **allkeys-lru**: Evict least recently used key across all keys (recommended for pure caching tiers).
- **noeviction**: Return OOM error on write commands when memory limit reached.
