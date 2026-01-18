import logging
from logging.config import dictConfig

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "logging.Formatter",
            "fmt": "%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        }
    },
    "handlers": {
        "default": {
            "level": "INFO",
            "formatter": "default",
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "uvicorn.error": {"handlers": ["default"], "level": "INFO"},
        "uvicorn.access": {"handlers": ["default"], "level": "INFO"},
        "app": {"handlers": ["default"], "level": "INFO"},
    },
}


def setup_logging() -> None:
    dictConfig(LOGGING_CONFIG)


logger = logging.getLogger("app")
