"""
Notes generator service — converts a transcript into structured Markdown study notes
using GPT-4o. Language-aware prompts for English and Mauritian Creole.
"""
import asyncio
from openai import OpenAI
from app.core.config import settings


def _generate_sync(transcript: str, language: str) -> str:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    system_instruction = (
        "You are an expert academic tutor. Your goal is to convert the following lecture transcript "
        "into clear, organized, and effective study notes in Markdown format. "
        "Include a Title, a brief Summary, Key Concepts (with bullet points), and a Vocabulary list if applicable."
    )

    if language == "fr":
        system_instruction += (
            " The transcript is in French. Generate the study notes in French."
        )
    elif language == "mfe":
        system_instruction += (
            " The transcript is in Mauritian Creole. Please analyze the Creole content carefully. "
            "Generate the study notes in Creole."
        )
    elif language == "mfe_fusion":
        system_instruction += (
            " The transcript may mix Mauritian Creole, English, and French. "
            "Generate the study notes in English but preserve important Creole/French terms in the Vocabulary section."
        )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user",   "content": f"Here is the transcript:\n\n{transcript}"},
        ],
        temperature=0.5,
    )
    return response.choices[0].message.content


async def generate_study_notes(transcript: str, language: str) -> str:
    """Returns structured Markdown study notes."""
    return await asyncio.to_thread(_generate_sync, transcript, language)
