from pydantic_settings import BaseSettings, SettingsConfigDict


from urllib.parse import quote_plus

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database Configuration
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "smart_classroom_db"
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str
    
    # JWT Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Phase 5: Facial recognition
    face_recognition_enabled: bool = False
    face_similarity_threshold: float = 0.8

    # Background validation (YOLOv8 + reference image similarity, e.g. office "cosol3")
    background_validation_enabled: bool = True
    background_room_slug: str = "cosol3"

    # Liveness (blink + head turn) — client performs MediaPipe; server requires flag when enabled
    liveness_required: bool = True

    # IP subnet validation per room slug (JSON). Never rejects attendance alone — boosts location confidence only.
    # Prefixes use startswith() — e.g. "10.4.214." matches 10.4.214.75 and any host in that /24.
    # Example: {"cosol3":["192.168.29.","10.4.214."],"811":["192.168.30.","10.4.214."],"812":[...]}
    room_network_prefixes_json: str = (
        '{"cosol3":["192.168.29.","10.4.214."],"811":["192.168.30.","10.4.214."],"812":["192.168.31.","10.4.214."]}'
    )
    ip_validation_enabled: bool = True

    # Calendar day + weekday for "today's classes" / attendance-marked-for-today (IST default)
    app_timezone: str = "Asia/Kolkata"

    # Optional blockchain (Ganache / deploy scripts) — must be declared so .env does not fail validation
    blockchain_enabled: bool = False
    ganache_url: str = "http://127.0.0.1:7545"
    deployer_private_key: str = ""
    contract_address: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False  # Allow flexible case for environment variables
    )
    
    @property
    def database_url(self) -> str:
        """Construct database connection URL - using PostgreSQL"""
        return f"postgresql://{self.DATABASE_USER}:{quote_plus(self.DATABASE_PASSWORD)}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"



# Global settings instance
settings = Settings()
