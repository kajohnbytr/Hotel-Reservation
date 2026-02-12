import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';  
import axios from 'axios'; // ← ADD THIS
import authRoutes from './routes/auth.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();

// CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Existing routes
app.use("/api/users", authRoutes);


// ================= AI PREDICTION ROUTE =================
app.post("/api/ai/predict", async (req, res) => {
  try {
    const response = await axios.post(
      "http://127.0.0.1:5001/predict",
      req.body
    );

    res.json(response.data);

  } catch (error) {
    console.log("AI ERROR:", error.message);
    res.status(500).json({ message: "AI server not responding" });
  }
});


connectDB();

app.listen(PORT , () => {
    console.log(`Server is running on port ${PORT}`);
});
