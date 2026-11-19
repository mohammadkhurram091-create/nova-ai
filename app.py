
from flask import Flask, render_template, request, jsonify
import ollama

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

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
        })

    except Exception as error:
        return jsonify({ 
            "error": str(error)
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)