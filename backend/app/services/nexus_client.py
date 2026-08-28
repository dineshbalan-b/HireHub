import logging
import httpx
from openai import AsyncOpenAI
from typing import Optional
from app.config import get_settings

logger = logging.getLogger(__name__)

class NexusAIService:
    def __init__(self, base_url: str, api_key: str):
        self.client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            http_client=httpx.AsyncClient(timeout=60.0)
        )

    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating text from Nexus: {e}")
            raise

    async def transcribe_audio(self, audio_bytes: bytes, filename: str = 'audio.wav') -> str:
        try:
            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_bytes),
                language="en"
            )
            return response.text
        except Exception as e:
            logger.error(f"Error transcribing audio from Nexus: {e}")
            raise

    async def generate_speech(self, text: str, voice: str = 'alloy') -> bytes:
        try:
            response = await self.client.audio.speech.create(
                model="gpt-4o-mini-tts",
                voice=voice,
                input=text
            )
            return response.read()
        except Exception as e:
            logger.error(f"Error generating speech from Nexus: {e}")
            raise

    async def test_connection(self) -> bool:
        try:
            await self.generate("You are a helpful assistant.", "Say 'test'")
            return True
        except Exception:
            return False

_nexus_service_instance: Optional[NexusAIService] = None

def get_nexus_service() -> NexusAIService:
    global _nexus_service_instance
    if _nexus_service_instance is None:
        settings = get_settings()
        _nexus_service_instance = NexusAIService(
            base_url=settings.NEXUS_API_BASE_URL,
            api_key=settings.NEXUS_API_KEY
        )
    return _nexus_service_instance
