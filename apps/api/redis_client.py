from typing import Optional

import redis.asyncio as redis

from config import config

print(config.redis_host, config.redis_password, config.redis_port)

_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            password=config.redis_password if config.redis_password else None,
            decode_responses=True,
        )
    return _client


async def close_redis():
    global _client
    if _client:
        await _client.close()
        _client = None
