from typing import Optional, Any, Awaitable
import json
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

async def enqueue(queue_name: str, message: Any) -> int:
    """Add a message to the queue. Returns queue length."""
    client = await get_redis()
    push_res = client.lpush(queue_name, json.dumps(message))
    if isinstance(push_res, Awaitable):
        push_res = await push_res

    return push_res


async def dequeue(queue_name: str, timeout: int = 0) -> Optional[Any]:
    """
    Remove and return a message from the queue.
    If timeout > 0, blocks until a message is available or timeout expires.
    Returns None if queue is empty (or timeout expires).
    """
    client = await get_redis()
    if timeout > 0:
        result = client.brpop([queue_name], timeout=timeout)
        if isinstance(result, Awaitable):
            result = await result
        return json.loads(result[1]) if result else None
    else:
        result = client.rpop(queue_name)
        if isinstance(result, Awaitable):
            result = await result
        return json.loads(result) if isinstance(result, str) else None


async def peek(queue_name: str) -> Optional[Any]:
    """View the next message without removing it."""
    client = await get_redis()
    result = client.lindex(queue_name, -1)
    if isinstance(result, Awaitable):
            result = await result
    return json.loads(result) if result else None


async def queue_length(queue_name: str) -> int:
    """Get the number of messages in the queue."""
    client = await get_redis()
    result = client.llen(queue_name)
    if isinstance(result, Awaitable):
        result = await result

    return result


async def clear_queue(queue_name: str) -> bool:
    """Delete all messages in the queue."""
    client = await get_redis()
    return await client.delete(queue_name) > 0