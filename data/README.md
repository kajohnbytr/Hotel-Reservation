# AI Training Datasets

This folder contains CSV datasets to train and improve the Aurora hotel AI (chatbot and room recommendation).

---

## 1. `chatbot_training.csv` – Chat / NLP

Use this to train your **NLP chatbot** (intent classification and/or response generation).

| Column         | Description |
|----------------|-------------|
| `user_message` | Example phrase a guest might type |
| `intent`       | Label: `greeting`, `rooms`, `wifi`, `price`, `reservation`, `cancellation`, `contact`, `thanks`, `amenities`, `recommendation`, `policy`, `location` |
| `response`     | Suggested bot reply for that intent |

**How to use for training**

- **Intent classifier**: Train a model (e.g. sklearn, TensorFlow) to predict `intent` from `user_message`. At inference, map predicted intent to a response (e.g. pick one response per intent or use a template).
- **Response retrieval**: Use `user_message` and `intent` as input; train or select a response (e.g. from a pool of `response` per intent).
- **Add more rows**: Duplicate intents with new phrasings (e.g. "Do you have wifi?", "Is internet free?") to improve robustness.

**Example (Python, simple intent lookup)**

```python
import pandas as pd
df = pd.read_csv('data/chatbot_training.csv')
# Build intent -> responses lookup
from collections import defaultdict
intent_responses = defaultdict(list)
for _, row in df.iterrows():
    intent_responses[row['intent']].append(row['response'])
# For a new message, use your classifier to get intent, then pick a response
```

---

## 2. `room_recommendation_training.csv` – Room Recommendation (ML)

Use this to train your **recommendation model** that suggests a room type from guests, nights, and budget.

| Column                   | Description |
|--------------------------|-------------|
| `guests`                 | Number of guests (1–6) |
| `nights`                 | Length of stay (1–7+) |
| `budget_min`             | Minimum budget (₱) for the stay |
| `budget_max`             | Maximum budget (₱) for the stay |
| `recommended_room_type`  | Label: `standard`, `deluxe`, `suite`, `villa`, `cabin` |

Room types align with Aurora: **standard** (e.g. Serenity), **deluxe** (Horizon), **suite** (Aurora Royal Suite), **villa** (Lakeside), **cabin** (Forest Cabin).

**How to use for training**

- **Classifier**: Features = `[guests, nights, budget_min, budget_max]` (or use a single `budget` = mean of min/max). Target = `recommended_room_type`. Train a classifier (e.g. Random Forest, XGBoost, or a small neural net).
- **Regression / ranking**: Predict preferred room type or a score per room type for the given (guests, nights, budget).

**Example (Python, sklearn)**

```python
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('data/room_recommendation_training.csv')
X = df[['guests', 'nights', 'budget_min', 'budget_max']]
y = df['recommended_room_type']
le = LabelEncoder()
y_enc = le.fit_transform(y)
X_train, X_test, y_train, y_test = train_test_split(X, y_enc, test_size=0.2, random_state=42)
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)
# Predict: room_type = le.inverse_transform(clf.predict([[2, 3, 400, 600]]))
```

---

## Adding more data

- **Chatbot**: Add rows with new `user_message` phrasings and the same or new `intent` and `response`. Keep responses consistent per intent for a stable experience.
- **Recommendation**: Add rows for more (guests, nights, budget) combinations; keep `recommended_room_type` consistent with your business rules (e.g. capacity and price ranges).

After training, point your Python NLP service to the new model for `/chat` and your ML service to the new model for `/predict`; the Node backend will use them when available and fall back to built-in logic when not.
