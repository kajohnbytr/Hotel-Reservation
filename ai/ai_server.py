from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# ================= LOAD ML MODEL =================
model = joblib.load("rating_model.pkl")

# ================= ROOM DATABASE =================
ROOMS = [
    {"name":"Standard Room","type":0,"capacity":2,"price":1500},
    {"name":"Deluxe Room","type":1,"capacity":3,"price":2800},
    {"name":"Family Room","type":2,"capacity":5,"price":4500}
]

# ================= ROOM RECOMMENDATION =================
def recommend_room(guests, budget):
    possible_rooms = []

    for room in ROOMS:
        if guests <= room["capacity"] and room["price"] <= budget:
            possible_rooms.append(room)

    # if nothing fits, choose closest price
    if not possible_rooms:
        return min(ROOMS, key=lambda x: abs(x["price"] - budget))

    # best capacity match
    return min(possible_rooms, key=lambda x: (x["capacity"] - guests))

# ================= PREDICTION ROUTE =================
@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    guests = int(data.get("guests",2))
    nights = int(data.get("nights",1))
    budget = int(data.get("price",2500))

    # get best room
    room = recommend_room(guests, budget)

    room_type = room["type"]
    price = room["price"]

    # machine learning prediction
    prediction = model.predict([[guests, nights, room_type, price]])
    rating = round(float(prediction[0]),2)

    # final chatbot response
    message = f"""
I recommend the {room['name']}.

Reason:
• Good for {guests} guest(s)
• Fits your budget of ₱{budget}
• Estimated nightly price: ₱{price}

Predicted guest satisfaction: {rating} ⭐
"""

    return jsonify({
        "room": room["name"],
        "predicted_rating": rating,
        "message": message
    })

# ================= RUN SERVER =================
if __name__ == "__main__":
    app.run(port=5001)
