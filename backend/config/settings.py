"""
Django Settings — SIH26190 Secure Document Management System
All secrets loaded from environment variables. Never hardcoded.
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-dev-key-change-in-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if render_host:
    ALLOWED_HOSTS.append(render_host)

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # SIH26190 apps
    "apps.users",
    "apps.cases",
    "apps.documents",
    "apps.audit",
    "apps.security",
    "apps.search",
    "apps.blockchain",
    "apps.system_settings",
    "apps.assets",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Database ──────────────────────────────────────────────────────────────────
# SQLite for development; PostgreSQL required for production (DEBUG=False)
from django.core.exceptions import ImproperlyConfigured

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")):
    import dj_database_url  # type: ignore
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL)}
else:
    if not DEBUG:
        raise ImproperlyConfigured(
            "Production mode (DEBUG=False) requires a valid PostgreSQL DATABASE_URL. "
            "SQLite database is not permitted in production."
        )
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── REST Framework ─────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ── JWT ────────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", str(DEBUG)).lower() in ("true", "1", "yes")
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()
    ]

# ── Localization ──────────────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ── Static / Media ────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Document Storage ──────────────────────────────────────────────────────────
# This is the directory where encrypted document files are stored.
# Must be outside the web root — never served directly.
DOCUMENT_STORAGE_PATH = os.environ.get(
    "DOCUMENT_STORAGE_PATH", str(BASE_DIR.parent / "data" / "documents")
)

# ── Encryption ────────────────────────────────────────────────────────────────
# Fernet key — generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# If empty in development, a key is auto-generated at startup (NOT for production).
DOCUMENT_ENCRYPTION_KEY = os.environ.get("DOCUMENT_ENCRYPTION_KEY", "")

# ── AI / NLP ──────────────────────────────────────────────────────────────────
AI_PROVIDER = os.environ.get("AI_PROVIDER", "local")
SPACY_MODEL = os.environ.get("SPACY_MODEL", "en_core_web_sm")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Qwen 3B (Optional local LLM via Ollama)
QWEN_ENABLED = os.environ.get("QWEN_ENABLED", "true").lower() in ("true", "1", "yes")
QWEN_BASE_URL = os.environ.get("QWEN_BASE_URL", "http://127.0.0.1:11434")
QWEN_MODEL = os.environ.get("QWEN_MODEL", "qwen2.5:3b")

# ── Blockchain ────────────────────────────────────────────────────────────────
BLOCKCHAIN_RPC_URL = os.environ.get("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
BLOCKCHAIN_CHAIN_ID = int(os.environ.get("BLOCKCHAIN_CHAIN_ID", 31337))
BLOCKCHAIN_CONTRACT_ADDRESS = os.environ.get("BLOCKCHAIN_CONTRACT_ADDRESS", "")
BLOCKCHAIN_ANCHOR_PRIVATE_KEY = os.environ.get("BLOCKCHAIN_ANCHOR_PRIVATE_KEY", "")

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}
