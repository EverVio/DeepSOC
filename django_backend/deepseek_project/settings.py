import os
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    raw_value = raw_value.strip()
    normalized = raw_value.lstrip('-')
    if normalized.isdigit():
        return int(raw_value)
    return default


def _get_list_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    values = [item.strip() for item in raw_value.split(",") if item.strip()]
    return values or default

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-example-key-for-development-only')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = _get_bool_env('DJANGO_DEBUG', True)

ALLOWED_HOSTS = ['*']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'ninja',
    'corsheaders',
    'deepseek_api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'deepseek_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'deepseek_project.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# 允许前端域名（根据实际前端地址修改）
CORS_ALLOWED_ORIGINS = _get_list_env('CORS_ALLOWED_ORIGINS', [
    'http://localhost:8082',
    'http://127.0.0.1:8082',
])

CSRF_TRUSTED_ORIGINS = _get_list_env('CSRF_TRUSTED_ORIGINS', CORS_ALLOWED_ORIGINS)

# 允许请求头携带 Authorization
CORS_ALLOW_HEADERS = [
    "authorization",
    "content-type",
]

CORS_ALLOW_CREDENTIALS = _get_bool_env('CORS_ALLOW_CREDENTIALS', False)

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# 自定义配置
API_KEY_LENGTH = 32
AUTH_PASSWORD = os.environ.get('AUTH_PASSWORD', 'secret')
UPLOAD_MAX_BYTES = _get_int_env('UPLOAD_MAX_BYTES', 5 * 1024 * 1024)
MAX_OFFICE_UNCOMPRESSED_SIZE = _get_int_env('MAX_OFFICE_UNCOMPRESSED_SIZE', 20 * 1024 * 1024)
MAX_OFFICE_ARCHIVE_ENTRIES = _get_int_env('MAX_OFFICE_ARCHIVE_ENTRIES', 2000)
TOKEN_EXPIRY_SECONDS = _get_int_env('TOKEN_EXPIRY_SECONDS', 360000)
RATE_LIMIT_MAX = _get_int_env('RATE_LIMIT_MAX', 5000)  # 每分钟最大请求数
RATE_LIMIT_INTERVAL = _get_int_env('RATE_LIMIT_INTERVAL', 60)
CACHE_MAX_SIZE = _get_int_env('CACHE_MAX_SIZE', 200)
CACHE_EXPIRY = _get_int_env('CACHE_EXPIRY', 300)
SSE_IDLE_TIMEOUT_MS = _get_int_env('SSE_IDLE_TIMEOUT_MS', 30000)
SSE_MAX_RETRIES = _get_int_env('SSE_MAX_RETRIES', 1)
SSE_BUFFER_LIMIT_BYTES = _get_int_env('SSE_BUFFER_LIMIT_BYTES', 1024 * 1024)
WEB_SEARCH_TIMEOUT_SECONDS = _get_int_env('WEB_SEARCH_TIMEOUT_SECONDS', 15)
REMOTE_RETRIEVAL_MAX_QUERIES = _get_int_env('REMOTE_RETRIEVAL_MAX_QUERIES', 5)
REMOTE_RETRIEVAL_ENABLE_RELAXED = _get_bool_env('REMOTE_RETRIEVAL_ENABLE_RELAXED', False)
DB_RETRIEVAL_TOP_K = _get_int_env('DB_RETRIEVAL_TOP_K', 5)
DB_RETRIEVAL_TIMEOUT_SECONDS = _get_int_env('DB_RETRIEVAL_TIMEOUT_SECONDS', 4)
DB_RETRIEVAL_CACHE_SECONDS = _get_int_env('DB_RETRIEVAL_CACHE_SECONDS', 300)
WEB_SEARCH_MAX_RESULTS = _get_int_env('WEB_SEARCH_MAX_RESULTS', 5)
WEB_SEARCH_JOIN_TIMEOUT_SECONDS = _get_int_env('WEB_SEARCH_JOIN_TIMEOUT_SECONDS', 3)
QUERY_RECORD_CACHE_REFRESH_SECONDS = _get_int_env('QUERY_RECORD_CACHE_REFRESH_SECONDS', 30)
WARM_QUERY_RECORD_CACHE = _get_bool_env('WARM_QUERY_RECORD_CACHE', True)
RAG_LOG_ITEM_MAX_CHARS = _get_int_env('RAG_LOG_ITEM_MAX_CHARS', 320)
RAG_WEB_ITEM_MAX_CHARS = _get_int_env('RAG_WEB_ITEM_MAX_CHARS', 320)
RAG_EVIDENCE_MAX_ITEMS = _get_int_env('RAG_EVIDENCE_MAX_ITEMS', 1)