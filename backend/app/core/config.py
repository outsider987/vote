import os
from pydantic_settings import BaseSettings
from typing import Any

class Settings(BaseSettings):
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Database Settings
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    
    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    class Config:
        # Get the directory containing this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Get the project root directory (parent of 'app' directory)
        project_root = os.path.dirname(os.path.dirname(current_dir))
        env_file = os.path.join(project_root, ".env")
        case_sensitive = True

print(Settings().DATABASE_URL)
settings = Settings() 