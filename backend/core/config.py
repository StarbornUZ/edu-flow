import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")       # asosiy model: GPT-4o
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")  # fallback: Claude Sonnet

REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", 15 * 24 * 60))
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))

ALGORITHM = os.getenv("ALGORITHM", "HS256")
