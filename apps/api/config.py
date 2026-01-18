# import os

# REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
# REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
# REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# # Redis keys
# CITY_KEY = "fleet_feast:city"
# GAME_STATE_KEY = "fleet_feast:game_state"

from pydantic_settings import BaseSettings


class Config(BaseSettings):
    redis_host: str = "localhost"
    redis_port: int = 6379

    redis_password: str = ""

    city_key: str = "fleet_feast:city"
    game_state_key: str = "fleet_feast:game_state"

    class Config:
        env_file = ".env"


config = Config()
