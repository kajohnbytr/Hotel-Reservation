<<<<<<< HEAD
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import { connectDB } from './config/db.js';
=======
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import { connectDB } from "./config/db.js";
>>>>>>> b16fc9c1 (Modified Project)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

<<<<<<< HEAD
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
=======
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });
>>>>>>> b16fc9c1 (Modified Project)

const PORT = process.env.PORT || 5000;

const app = express();

<<<<<<< HEAD
//Add CORS before other middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
=======
// Security Headers
app.use(helmet());

// Rate Limiter (Login Protection)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts. Try again later.",
});

app.use("/api/users/login", loginLimiter);

// CORS
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);
>>>>>>> b16fc9c1 (Modified Project)

app.use(express.json());

app.use("/api/users", authRoutes);

connectDB();

<<<<<<< HEAD
app.listen(PORT , () => {
    console.log(`Server is running on port ${PORT}`);
});
=======
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
>>>>>>> b16fc9c1 (Modified Project)
