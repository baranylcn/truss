"""Pure quota helpers — no FastAPI or DB imports, so they stay unit-testable."""


def storage_would_exceed(used_bytes: int, incoming_bytes: int, limit_mb: int) -> bool:
    """True if adding ``incoming_bytes`` to ``used_bytes`` crosses the per-user MB limit."""
    return used_bytes + incoming_bytes > limit_mb * 1024 * 1024
