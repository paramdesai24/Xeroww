"""
api/core/rate_limit.py
──────────────────────
Rate limiting middleware and dependency backed by the CacheService.
Enforces per-minute quotas for unauthenticated (by IP) and authenticated (by user ID) clients.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from api.core.config import settings
from api.services.cache_service import get_cache_service


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    ASGI Middleware that enforces requests-per-minute limits.
    Skips docs, openapi.json, health check, and metrics endpoints.
    """

    EXEMPT_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/metrics", "/"}

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        cache = get_cache_service()

        # Determine client identity
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token_snippet = auth_header.split(" ")[1][-16:]
            client_id = f"auth:{token_snippet}"
            limit = settings.RATE_LIMIT_AUTH_RPM
        else:
            client_ip = request.client.host if request.client else "unknown"
            client_id = f"ip:{client_ip}"
            limit = settings.RATE_LIMIT_UNAUTH_RPM

        key = f"ratelimit:{client_id}"
        current_count = cache.incr(key, ttl_seconds=60)

        if current_count > limit:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "60"},
                content={
                    "detail": f"Rate limit exceeded. Maximum {limit} requests per minute.",
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded. Maximum {limit} requests per minute.",
                        "details": {
                            "client_id": client_id,
                            "limit_rpm": limit,
                            "retry_after_seconds": 60,
                        },
                    },
                },
            )

        response: Response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current_count))
        return response
