
import os
import time

from flask import Flask, render_template, request, jsonify
import ollama
from google import genai
from google.genai import errors


app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():

    # VALIDATE REQUEST
    data = request.get_json(silent=True) or {}

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    user_message = data.get("message", "")

    if not isinstance(user_message, str):
        return jsonify({"error": "Message must be text."}), 400

    user_message = user_message.strip()

    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

    if len(user_message) > 10000:
        return jsonify({
            "error": "Message is too long. Please keep it under 10,000 characters."
        }), 400

    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()

    # ==========================================
    # GEMINI AI PROVIDER
    # ==========================================

    if provider == "gemini":

        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            return jsonify({
                "error": "Gemini API is not configured on the server."
            }), 503

        model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

        try:

            client = genai.Client(
                api_key=api_key,
                http_options={
                    "timeout": 30000
                }
            )

            max_attempts = 3
            response = None

            # RETRY TEMPORARY API FAILURES

            for attempt in range(max_attempts):

                try:

                    response = client.models.generate_content(
                        model=model,
                        contents=user_message
                    )

                    break

                except errors.APIError as error:

                    status = error.status

                    # Retry only temporary API errors
                    if status not in (429, 500, 502, 503, 504):
                        raise

                    # Stop after final attempt
                    if attempt == max_attempts - 1:
                        raise

                    app.logger.warning(
                        "Gemini API temporarily unavailable. "
                        "Retrying attempt %s of %s.",
                        attempt + 2,
                        max_attempts
                    )

                    time.sleep(attempt + 1)

            # EXTRACT GEMINI RESPONSE

            reply = response.text if response else None

            if not reply:
                return jsonify({
                    "error": "The AI returned an empty response. Please try again."
                }), 502

            return jsonify({
                "reply": reply
            }), 200

        except Exception as error:

            # LOG ACTUAL ERROR FOR DEBUGGING
            app.logger.exception(
                "Gemini API request failed. Error type: %s. Error: %s",
                type(error).__name__,
                str(error)
            )

            return jsonify({
                "error": "The AI service is temporarily unavailable. Please try again."
            }), 503

    # ==========================================
    # OLLAMA LOCAL AI PROVIDER
    # ==========================================

    elif provider == "ollama":

        try:

            response = ollama.chat(
                model="llama3.2:1b",
                messages=[
                    {
                        "role": "user",
                        "content": user_message
                    }
                ]
            )

            return jsonify({
                "reply": response["message"]["content"]
            }), 200

        except Exception:

            app.logger.exception("Ollama request failed")

            return jsonify({
                "error": "Local AI is unavailable. Please check that Ollama is running."
            }), 503

    # ==========================================
    # INVALID PROVIDER
    # ==========================================

    else:

        return jsonify({
            "error": "Invalid AI provider configuration."
        }), 500


# ==========================================
# APPLICATION ENTRY POINT
# ==========================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", 5000)),
        debug=False
    )
