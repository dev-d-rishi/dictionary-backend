import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user"; // Adjust the import path as necessary

const router = express.Router();

// Secret Key (for demo; use env in real projects)
const JWT_SECRET = "your_jwt_secret_key";

// Register Route
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({
        message: "All fields are required: username, email, and password",
      });
      return;
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(409).json({ message: "User already exists with this email" });
      return;
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(409).json({ message: "Username is already taken" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isAdmin: false,
    });

    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({ message: "User registered successfully", token });
  } catch (err: any) {
    console.error("Registration Error:", err);
    res.status(500).json({
      message:
        "Something went wrong during registration. Please try again later.",
      error: err.message,
    });
  }
});

// Login Route
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ message: "Email/Username and password are required" });
      return;
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: email }, { username: email }],
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
    return;
  } catch (err: any) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
