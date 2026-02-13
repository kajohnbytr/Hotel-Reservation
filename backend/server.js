import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';  
import authRoutes from './routes/auth.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();

//Add CORS before other middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use("/api/users", authRoutes);

connectDB();

app.listen(PORT , () => {
    console.log(`Server is running on port ${PORT}`);
});