def to_seconds(hours: int = 0, minutes: int = 0, seconds: int = 0) -> int:
    return hours * 3600 + minutes * 60 + seconds

def from_seconds(seconds: int = 0) -> tuple[int, int, int]:
    hours = int(seconds / 3600)
    seconds -= hours * 3600

    minutes = int(seconds / 60)
    seconds -= minutes * 60

    return (hours, minutes, seconds) 