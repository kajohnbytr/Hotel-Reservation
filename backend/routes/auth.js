import express from 'express';
import User from '../models/user.js';
import { protect } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

//Registration Route
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        if(!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'Please fill all fields' })
        }

        const userExists = await User.findOne({ email });
        if(userExists) {
            return res
            .status(400)
            .json({ message: 'User already exists' })
        }


        const user = await User.create({ firstName, lastName, email, password });
        const token = generateToken(user._id);
        res.status(201).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
})

//Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if(!email || !password) {
            return res
            .status(400)
            .json({ message: 'Please fill all fields' })
        }
        const user = await User.findOne({ email });


        if(!user || !(await user.matchPassword(password))) {
            return res
            .status(401)
            .json({ message: 'Invalid email or password' });
        }
        const token = generateToken(user._id);
        res.status(200).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
})

//Me
router.get("/me", protect, async (req, res) => {
    res.status(200).json(req.user)
})

//Generate Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',})
}

export default router;