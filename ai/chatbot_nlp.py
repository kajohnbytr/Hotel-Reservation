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

# NORMAL CHAT RESPONSE
def get_basic_response(user_message):
    user_message = user_message.lower()

    for intent in data["intents"]:
        for pattern in intent["patterns"]:
            if pattern in user_message:
                return random.choice(intent["responses"])

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

    # 1. try extracting booking details
    detail_response = extract_details(message)
    if detail_response:
        return jsonify({"reply": detail_response})

    # 2. if enough info → recommend
    if ready_for_prediction():
        recommendation = get_recommendation()

        # reset memory after recommendation
        conversation_memory["guests"] = None
        conversation_memory["nights"] = None
        conversation_memory["budget"] = None

        return jsonify({"reply": recommendation})

    # 3. normal conversation
    basic = get_basic_response(message)
    if basic:
        return jsonify({"reply": basic})

    return jsonify({"reply": "You can tell me your number of guests and budget so I can recommend a room."})

if __name__ == "__main__":
    app.run(port=5002)
