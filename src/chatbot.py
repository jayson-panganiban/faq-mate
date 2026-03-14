import logging
import os

import gradio as gr
import requests  # type: ignore
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

CHAT_EXAMPLES = [
    "What should I do if I'm involved in a car accident and need to use my insurance?",
    "What is the coverage for windscreen damage?",
    "How do I make a claim?",
    "Is my car covered if I drive interstate?",
    "What's the difference between comprehensive and third-party insurance?",
    "Can I choose my own repairer?",
    "Does my policy cover rental car costs after an accident?",
    "How does my driving record affect my premium?",
    "What happens if my car is written off?",
    "Are modifications to my car covered?",
]

if not OPENAI_API_KEY:
    logger.warning(
        "⚠️ OPENAI_API_KEY environment variable not set. Chatbot functionality requires it."
    )
if not API_URL:
    raise ValueError("API_URL environment variable is not set.")


def call_api(question: str) -> str:
    headers = {"X-OpenAI-Key": OPENAI_API_KEY, "Content-Type": "application/json"}
    payload = {"text": question}

    try:
        logger.info(f"Sending request to API: {API_URL}/ask")
        response = requests.post(
            f"{API_URL}/ask", json=payload, headers=headers, timeout=30.0
        )
        response.raise_for_status()
        api_response = response.json()
        logger.info(f"Received API response: {api_response}")
        return api_response.get("answer", "⚠️ Error: No answer received from API.")

    except requests.exceptions.Timeout:
        logger.error("API request timed out.")
        return (
            "⚠️ Error: The request to the backend API timed out. Please try again later."
        )
    except requests.exceptions.ConnectionError:
        logger.error(f"Could not connect to API at {API_URL}.")
        return f"⚠️ Error: Could not connect to the backend API at {API_URL}. Is it running?"
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        error_detail = e.response.text
        logger.error(f"API request failed (Status: {status_code}): {error_detail}")
        if status_code == 401:  # Unauthorized
            return "⚠️ Error: Invalid OpenAI API Key. Please check the secret in Space settings."
        elif (
            status_code == 503
        ):  # Service Unavailable (often OpenAI issues or backend overload)
            return "⚠️ Error: The AI service is currently unavailable or overloaded. Please try again later."
        else:
            return (
                f"⚠️ Error: The backend API returned an error (Status: {status_code})."
            )
    except Exception as e:
        logger.error(
            f"An unexpected error occurred calling the API: {e}", exc_info=True
        )
        return f"⚠️ An unexpected error occurred: {str(e)}"


def user_input(user_message, history):
    if not user_message.strip():
        return ""

    logger.info(f"User question: {user_message}")
    bot_response = call_api(user_message)
    logger.info(f"Bot response: {bot_response}")

    return bot_response


with gr.Blocks(title="Car Insurance FAQ Chatbot", theme=gr.themes.Soft()) as demo:
    # Header
    with gr.Column(scale=1):
        gr.Markdown(
            """
            <div style="text-align: center; padding: 20px 0;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 700;">🚗 FAQ-MATE</h1>
            <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">Car Insurance Assistant for Australia</p>
            </div>
            """,
            elem_id="header",
        )

    # Main chat interface
    with gr.Column(scale=10):
        chatbot_ui = gr.ChatInterface(
            user_input,
            chatbot=gr.Chatbot(
                scale=1,
                height=500,
                render_markdown=True,
                avatar_images=None,
                show_label=False,
            ),
            textbox=gr.Textbox(
                placeholder="Ask a question...",
                scale=7,
                container=False,
                lines=1,
                max_lines=3,
            ),
            show_progress="minimal",
        )

    # Example questions section
    gr.Markdown(
        """
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #999;">Popular questions</p>
        </div>
        """,
    )

    # Create rows of example buttons (2 buttons per row for better spacing)
    example_buttons = []
    for i in range(0, len(CHAT_EXAMPLES), 2):
        with gr.Row(scale=1):
            for j in range(2):
                if i + j < len(CHAT_EXAMPLES):
                    example_buttons.append(
                        gr.Button(
                            CHAT_EXAMPLES[i + j],
                            scale=1,
                            variant="secondary",
                            size="sm",
                        )
                    )

    for idx, btn in enumerate(example_buttons):
        btn.click(
            lambda example=CHAT_EXAMPLES[idx]: example,
            outputs=[chatbot_ui.textbox],
        )
