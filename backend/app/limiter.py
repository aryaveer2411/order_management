from slowapi import Limiter
from starlette.requests import Request


def get_client_ip(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


limiter = Limiter(key_func=get_client_ip)
