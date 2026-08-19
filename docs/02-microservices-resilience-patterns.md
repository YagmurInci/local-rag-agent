---
id: DOC-02
title: Microservices Resilience & Fault Tolerance Patterns
category: System Architecture
---

# Microservices Resilience & Fault Tolerance Patterns

## Overview
Distributed architectures are inherently prone to partial network partitions, service degradation, and cascading failures. This document details implementation rules for Circuit Breakers, Retries, Bulkheads, and Fallbacks.

## 1. Circuit Breaker Pattern
- **Purpose**: Prevent a single failing upstream service from draining thread pools and causing system-wide outage cascades.
- **States**:
  1. **CLOSED**: Normal operation. Requests pass through. Failure counts monitored over a rolling window.
  2. **OPEN**: Failure threshold exceeded (e.g., >50% failure rate over 20 requests). Requests fail fast immediately with local fallback without attempting HTTP call.
  3. **HALF-OPEN**: After a sleep window (e.g., 10 seconds), trial requests are allowed through. If successful, state transitions back to CLOSED; if failed, state reverts to OPEN.
- **Implementation Parameters**:
  - `failureRateThreshold`: 50%
  - `slowCallRateThreshold`: 75% (calls exceeding e.g., 2000ms)
  - `waitDurationInOpenState`: 10000ms
  - `slidingWindowSize`: 20 requests

## 2. Retry with Exponential Backoff & Jitter
- **Rule**: Never retry immediately without backoff on transient errors (HTTP 502, 503, 504, network connection resets). Never retry HTTP 4xx errors (400, 401, 403, 404).
- **Formula**: `Delay = Min(Max_Delay, Base_Delay * 2^Attempt) + Random_Jitter`
- **Jitter Purpose**: Prevents the "Thundering Herd" problem where thousands of retrying clients hit the recovering service at the exact same millisecond.

## 3. Bulkhead Pattern
- **Purpose**: Isolate resource pools (thread pools, HTTP connection pools) so that latency spikes in service A do not consume thread resources needed by service B.
- **Types**:
  - **Thread Pool Bulkhead**: Dedicated thread pool per downstream integration.
  - **Semaphore Bulkhead**: Limits max concurrent execution threads per dependency (e.g., max 25 concurrent calls).

## 4. Fallback Strategies
- **Graceful Degradation**:
  - Return cached static data (e.g., stale catalog data).
  - Return degraded default values (e.g., empty recommendations list instead of failing entire dashboard response).
  - Log audit trace with request correlation ID (`X-Correlation-ID`).
