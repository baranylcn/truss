import math
from typing import Any


def sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj

    if isinstance(obj, list):
        return [sanitize_for_json(x) for x in obj]

    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}

    return obj
