import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      user_id: user._id,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      user_id: user._id,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
    },
  );
};

export const verifyAccessToken = async (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = async (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
