---
id: DOC-06
title: gRPC vs REST vs GraphQL Architecture Comparison
category: System Architecture
---

# gRPC vs REST vs GraphQL Architecture Comparison

## Overview
Selecting the appropriate API paradigm depends on network constraints, client types (web, mobile, microservice-to-microservice), and schema contract requirements.

## 1. Architectural Comparison Matrix
- **REST (Representational State Transfer)**:
  - Protocol: HTTP/1.1 or HTTP/2, JSON/XML text payload.
  - Strengths: Universal browser support, straightforward HTTP caching, human-readable.
  - Weaknesses: Over-fetching, under-fetching, loose schema typing unless OpenAPI/Swagger enforced.
- **gRPC (Google Remote Procedure Call)**:
  - Protocol: HTTP/2 transport, Protocol Buffers (Protobuf) binary serialization.
  - Strengths: Extremely low latency, compact binary payload, strongly typed contract (`.proto`), bi-directional streaming support.
  - Weaknesses: Requires HTTP/2 proxies, limited direct web browser support without gRPC-Web gateway.
- **GraphQL**:
  - Protocol: HTTP POST with JSON query string payload.
  - Strengths: Client requests exact fields needed, single endpoint for complex graph queries.
  - Weaknesses: Complex server-side execution, potential N+1 database queries, difficult HTTP caching.

## 2. gRPC Protobuf Backward Compatibility Rules
- Never change field tag numbers (e.g., `string user_id = 1;`).
- Never delete required fields (use `reserved` keyword if field is deprecated).
- Addition of new optional fields is backward compatible.

## 3. GraphQL Performance & Security Troubleshooting
- **Depth Limiting**: Restrict maximum query nesting depth (e.g., max 5 levels) to prevent malicious recursive queries crashing server.
- **Query Complexity Analysis**: Assign cost points per schema field and reject queries exceeding maximum budget (e.g., max 1000 points).
