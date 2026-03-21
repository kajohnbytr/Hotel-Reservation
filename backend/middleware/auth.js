import User from "../models/user.js";
import jwt from "jsonwebtoken";

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            
            // Update lastActivity on every authenticated request (debounced to once per minute)
            if (req.user) {
                const now = new Date();
                const lastActivity = req.user.lastActivity ? new Date(req.user.lastActivity) : null;
                if (!lastActivity || (now - lastActivity) > 60000) { // Update every 60 seconds max
                    try {
                        await User.updateOne(
                          { _id: req.user._id },
                          { lastActivity: now, isOnline: true }
                        );
                    } catch (err) {
                        console.error('Failed to update lastActivity:', err);
                    }
                }
            }
            
            return next();
        } catch (error) {
            if (error?.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Session expired. Please sign in again.' });
            }

            console.error('Auth token verification failed:', error?.message || error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
}