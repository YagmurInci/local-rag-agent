---
id: DOC-07
title: Memory Leaks & Garbage Collection Debugging
category: Performance & Database
---

# Memory Leaks & Garbage Collection Debugging

## Overview
Unchecked memory leaks cause microservices to consume increasing RSS (Resident Set Size) memory until killed by the OS Out-Of-Memory killer (`OOMKilled` status in Kubernetes/Docker).

## 1. Common Memory Leak Anti-Patterns
1. **Global Cache without Eviction**: Storing objects in global javascript `Map` or static Java `HashMap` without size limits or TTL expiration.
2. **Uncleared Event Listeners & Timers**: Registering `EventEmitter.on()` or `setInterval()` inside per-request handlers without calling `removeListener()` or `clearInterval()`.
3. **Closure Scope Leaks**: Async callbacks holding references to outer scope variables containing large buffers or HTTP context objects.
4. **Unclosed Database / File Stream Resources**: Streams opened but not piped or closed on error.

## 2. Step-by-Step Memory Diagnostic Protocol
1. **Monitor Heap Trend**: Observe heap usage over time via Prometheus/Grafana. A sawtooth pattern with increasing baseline indicates a memory leak.
2. **Generate Heap Snapshot**:
   - Node.js: Take snapshot via `--inspect` V8 inspector or `heapdump` module.
   - Java: Run `jcmd <pid> GC.heap_dump /tmp/heap.hprof`.
3. **Compare Allocation Timelines**: Take Snapshot 1 (baseline after boot), run load test (1000 requests), force garbage collection, take Snapshot 2.
4. **Identify Retaining Paths**: Look for high "Shallow Size" vs "Retained Size" objects. Check constructor names with thousands of unexpected instances (e.g., `Closure`, `HTTPReqContext`, `DatabaseConnection`).

## 3. Node.js Event Loop Lag Debugging
- **Symptom**: HTTP response times increase exponentially under high CPU usage, even though total request count is low.
- **Cause**: Synchronous non-blocking operations executed on the single main thread (e.g., `JSON.parse` on 50MB payload, heavy regex evaluation, synchronous crypto/file I/O).
- **Fix**: Offload heavy CPU computations to Worker Threads or dedicated microservices.
