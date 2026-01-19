from pydantic_settings import BaseSettings


class Config(BaseSettings):
    redis_host: str = "localhost"
    redis_port: int = 6379

    redis_password: str = ""

    city_key: str = "fleet_feast:city"
    game_state_key: str = "fleet_feast:game_state"

    game_state_key: str = ""
    pending_actions_queue: str = ""

    class Config:
        env_file = ".env"


config = Config()
