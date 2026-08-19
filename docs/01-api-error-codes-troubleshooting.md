---
id: DOC-01
title: API Error Codes & Gateway Troubleshooting
category: API Diagnostics
---

# API Error Codes & Gateway Troubleshooting Guide

## Overview
This document provides step-by-step diagnostic procedures for resolving HTTP API error codes, gateway timeouts, CORS preflight failures, and network handshake errors across distributed microservices.

## 1. HTTP 502 Bad Gateway
- **Cause**: The API Gateway (Nginx, Envoy, Kong, AWS ALB) received an invalid response or connection refusal from the upstream microservice.
- **Diagnostic Steps**:
  1. Check if the upstream container or process is running (`docker ps`, `systemctl status service-name`).
  2. Inspect API Gateway access logs for upstream socket errors: `upstream prematurely closed connection while reading response header`.
  3. Verify if the upstream process crashed due to an unhandled exception or OOM (Out Of Memory) kill.
  4. Ensure port binding and localhost vs `0.0.0.0` IP binding configurations match.
- **Resolution**: Restart upstream service, adjust keep-alive timeout settings on upstream so gateway keep-alive is lower than upstream socket timeout.

## 2. HTTP 504 Gateway Timeout
- **Cause**: Upstream service failed to respond within the configured gateway timeout limit (e.g., 30s or 60s).
- **Diagnostic Steps**:
  1. Check database locks or slow query executions blocking the application thread.
  2. Inspect downstream HTTP external API calls that may be blocking synchronously without timeouts.
  3. Review garbage collection (GC) pause duration or thread pool exhaustion.
- **Resolution**:
  - Implement async processing (background message queue like Kafka/RabbitMQ) for heavy operations.
  - Increase gateway proxy timeouts if long-polling is intentionally required: `proxy_read_timeout 120s;`.
  - Add request timeouts in client libraries.

## 3. CORS (Cross-Origin Resource Sharing) Preflight Failures
- **Error**: `Access to fetch at 'https://api.domain.com/v1/data' from origin 'https://app.domain.com' has been blocked by CORS policy`.
- **Diagnostic Steps**:
  1. Check if OPTIONS preflight request returns HTTP 200/204 with header `Access-Control-Allow-Origin`.
  2. Verify if `Access-Control-Allow-Headers` includes custom request headers (e.g., `Authorization`, `X-Correlation-ID`).
  3. Ensure credentials (`Access-Control-Allow-Credentials: true`) are set if cookies or Bearer tokens are sent. Note: `Access-Control-Allow-Origin` cannot be `*` when credentials are enabled.

## 4. HTTP 429 Too Many Requests
- **Cause**: Client exceeded the rate limit configured on the API gateway or rate limiting middleware.
- **Resolution**: Read `Retry-After` header value. Implement client-side exponential backoff with jitter.

## 5. SSL/TLS Handshake Failures
- **Error**: `SSL routines:ssl3_get_server_certificate:certificate verify failed` or `PR_END_OF_FILE_ERROR`.
- **Root Causes**: Expired SSL certificate, missing intermediate CA bundle, TLS protocol version mismatch (e.g., server enforces TLS 1.3 while client sends TLS 1.1).
