---
id: DOC-03
title: OAuth2 & JWT Authentication Troubleshooting
category: Security & Auth
---

# OAuth2 & JWT Authentication Troubleshooting

## Overview
Authentication and authorization failures in microservices often result in HTTP 401 Unauthorized or HTTP 403 Forbidden errors. This guide outlines standard troubleshooting procedures for OAuth2 flows and JWT validation issues.

## 1. HTTP 401 Unauthorized vs HTTP 403 Forbidden
- **HTTP 401 Unauthorized**: Missing, invalid, or expired credentials (token is absent, malformed, or signature verification failed).
- **HTTP 403 Forbidden**: Credentials are valid, but the identified entity lacks required roles, permissions, or scope (e.g., token has `scope: read` but endpoint requires `scope: write`).

## 2. Common JWT Validation Failures
1. **Signature Verification Error (`SignatureVerificationException`)**:
   - Cause: Public key mismatch or secret key mismatch between Auth Server (IDP) and API Gateway/Service.
   - Fix: Verify JWKS (JSON Web Key Set) URL endpoint path `/.well-known/jwks.json`. Check kid (Key ID) header in JWT against JWKS.
2. **Expired Token (`TokenExpiredException`)**:
   - Cause: `exp` claim timestamp is in the past.
   - Fix: Configure client to use `refresh_token` flow before expiration. Add allowed clock skew tolerance (e.g., 60 seconds) on API Gateway.
3. **Invalid Issuer (`iss`) or Audience (`aud`)**:
   - Cause: Service expects `aud: https://api.mycompany.com` but token was issued with `aud: https://auth.mycompany.com`.
   - Fix: Align audience validation rules in gateway security configuration.

## 3. OAuth2 Grant Type Selection & Flow Debugging
- **Authorization Code Flow with PKCE**: Required for Single Page Applications (SPAs) and Mobile Apps. Replaces client secret with `code_verifier` and `code_challenge`.
- **Client Credentials Flow**: Used for service-to-service (machine-to-machine) backend communication.
- **Refresh Token Loop**: Occurs when client attempts refresh token API request using an expired refresh token or revoked grant, receiving 400 Bad Request (`invalid_grant`), but client loops endlessly trying to refresh.
  - Fix: Client must intercept `invalid_grant` error and force full user re-authentication / redirect to login page.
