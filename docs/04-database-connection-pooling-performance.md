---
id: DOC-04
title: Database Connection Pooling & Performance Tuning
category: Performance & Database
---

# Database Connection Pooling & Performance Tuning

## Overview
Database connectivity bottlenecks are a primary cause of microservice latency spikes and HTTP 500/504 errors. This guide details connection pool sizing, connection leak detection, and query optimization.

## 1. Connection Pool Exhaustion (`TimeoutAcquiringConnectionException`)
- **Symptom**: Threads hang waiting for an available DB connection from pool (HikariCP, pg-pool, TypeORM, Prisma).
- **Root Causes**:
  1. **Connection Leak**: Code acquires connection inside a try block but fails to release/close connection in a `finally` block or async promise chain.
  2. **Unbounded Pool Size**: Pool maximum size (`maxPoolSize`) set too small for concurrent incoming requests.
  3. **Long-Running Queries**: Slow SQL execution holds connection active for seconds.
- **Diagnostic Rules**:
  - Enable leak detection threshold (e.g., `hikari.leakDetectionThreshold=5000` to log stack trace if connection isn't returned within 5 seconds).
  - Calculate Pool Size Formula: `Connections = (Core_Count * 2) + Effective_Spindle_Count`.
  - Setting max connections to 100+ is usually an anti-pattern that overloads database CPU context switching.

## 2. N+1 Query Problem
- **Symptom**: Fetching 100 parent objects triggers 100 individual SQL SELECT queries for child relations instead of a single JOIN or IN query.
- **Detection**: APM tracing (Datadog, OpenTelemetry, New Relic) shows hundreds of repetitive query spans per HTTP request.
- **Fix**: Use explicit `JOIN FETCH` (Hibernate/JPA), `include` (Prisma), or `DataLoader` pattern (GraphQL).

## 3. Database Deadlocks
- **Symptom**: Transaction aborts with `SQLState 40001: deadlock detected`.
- **Cause**: Two concurrent transactions update tables or rows in opposite order (Tx1 locks Row A then requests Row B; Tx2 locks Row B then requests Row A).
- **Fix**:
  - Always acquire locks on rows in identical deterministic order across all application code.
  - Keep transaction duration as short as possible (do not make external HTTP calls inside DB transaction boundaries).
