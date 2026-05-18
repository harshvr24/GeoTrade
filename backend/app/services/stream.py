import os

class NoOpStream:
    async def publish(self, topic: str, value):
        return None
    async def subscribe(self, topic: str):
        return None


def _build_stream():
    # Placeholder for Kafka/PubSub. Returns no-op if not configured.
    if os.environ.get("KAFKA_BOOTSTRAP"):
        try:
            from aiokafka import AIOKafkaProducer  # type: ignore
            producer = AIOKafkaProducer(bootstrap_servers=os.environ["KAFKA_BOOTSTRAP"])
            return producer
        except Exception:
            pass
    return NoOpStream()


stream_client = _build_stream()
