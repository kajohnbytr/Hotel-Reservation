import User from "../models/user.js";
import jwt from "jsonwebtoken";

export const protect = async (req, res, next) => {
    let token;

<<<<<<< HEAD
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
}
=======
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            token = req.headers.authorization.split(" ")[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findById(decoded.id).select("-password");

            if (!user) {
                return res.status(401).json({ message: "Not authorized" });
            }

            req.user = user;
            return next();
        } catch (error) {
            return res.status(401).json({ message: "Not authorized" });
        }
    }

    return res.status(401).json({ message: "Not authorized" });
};
>>>>>>> b16fc9c1 (Modified Project)
