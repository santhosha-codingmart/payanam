import { verifyAccessToken } from "../modules/auth/services/jwt.service.js";
import User from "../modules/users/models/user.model.js";

export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No access token provided. Please log in.",
      });
    }
    const decoded = await verifyAccessToken(token);
    const user = await User.findById(decoded.user_id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User associated with this token no longer exists.",
      });
    }
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token. Please log in again.",
    });
  }
};
