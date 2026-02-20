import json
import random
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# load intents
with open("intents.json") as file:
    data = json.load(file)

#  MEMORY STORAGE
# (temporary per user session)
conversation_memory = {
    "guests": None,
    "nights": None,
    "budget": None
}

# Avoid repeating the same response twice in a row
last_basic_response = None

def deduplicate_words(text):
    """Remove consecutive repeated words (e.g. 'the the' -> 'the')."""
    if not text or not isinstance(text, str):
        return text
    words = text.split()
    result = []
    for w in words:
        if not result or w.lower() != result[-1].lower():
            result.append(w)
    return " ".join(result)

# NORMAL CHAT RESPONSE (avoid same reply twice in a row)
def get_basic_response(user_message):
    global last_basic_response
    user_message = user_message.lower()

    for intent in data["intents"]:
        for pattern in intent["patterns"]:
            if pattern in user_message:
                responses = intent["responses"]
                # Prefer a response different from last time
                if len(responses) > 1 and last_basic_response in responses:
                    choices = [r for r in responses if r != last_basic_response]
                    reply = random.choice(choices) if choices else random.choice(responses)
                else:
                    reply = random.choice(responses)
                last_basic_response = reply
                return deduplicate_words(reply)

    last_basic_response = None
    return None

# EXTRACT BOOKING INFO 
def extract_details(message):
    message = message.lower()
    numbers = re.findall(r'\d+', message)

    if "guest" in message or "people" in message or "person" in message:
        if numbers:
            conversation_memory["guests"] = int(numbers[0])
            return f"Got it — {numbers[0]} guest(s)."

    if "night" in message:
        if numbers:
            conversation_memory["nights"] = int(numbers[0])
            return f"Okay, staying for {numbers[0]} night(s)."

    if "budget" in message or "peso" in message or "₱" in message:
        if numbers:
            conversation_memory["budget"] = int(numbers[0])
            return f"Thanks! Budget noted: ₱{numbers[0]}."

    return None

# CHECK IF READY FOR RECOMMENDATION 
def ready_for_prediction():
    return (
        conversation_memory["guests"] is not None and
        conversation_memory["budget"] is not None
    )

# CALL ML AI
def get_recommendation():
    payload = {
        "guests": conversation_memory["guests"],
        "nights": conversation_memory["nights"] or 1,
        "price": conversation_memory["budget"]
    }

    try:
        res = requests.post("http://127.0.0.1:5001/predict", json=payload)
        return res.json()["message"]
    except:
        return "I cannot access the recommendation system right now."

# MAIN CHAT ROUTE 
@app.route("/chat", methods=["POST"])
def chat():
    message = request.json["message"]

    def clean_reply(r):
        return deduplicate_words(r) if r else r

    # 1. try extracting booking details
    detail_response = extract_details(message)
    if detail_response:
        return jsonify({"reply": clean_reply(detail_response)})

    # 2. if enough info → recommend
    if ready_for_prediction():
        recommendation = get_recommendation()
        conversation_memory["guests"] = None
        conversation_memory["nights"] = None
        conversation_memory["budget"] = None
        return jsonify({"reply": clean_reply(recommendation)})

    # 3. normal conversation
    basic = get_basic_response(message)
    if basic:
        return jsonify({"reply": basic})

    fallback = "You can tell me your number of guests and budget so I can recommend a room."
    return jsonify({"reply": clean_reply(fallback)})

if __name__ == "__main__":
    app.run(port=5002)
