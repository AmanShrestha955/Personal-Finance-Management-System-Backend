const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModels.js");
const Account = require("../models/accountModels.js");
const generateToken = require("../utils/generateToken.js");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { accessToken: "<Google OAuth2 access_token>" }
 *
 * Fetches the user's Google profile using the access token, then:
 *   - If user exists (by googleId OR email) → log them in
 *   - If user does not exist → create account (pre-verified) + Account doc
 * Returns a JWT identical to normal login.
 */
const googleAuth = async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ message: "Google access token is required" });
  }

  try {
    // 1. Fetch user profile from Google using the access token
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      return res
        .status(401)
        .json({ message: "Failed to fetch Google user info" });
    }

    const profile = await response.json();
    const { sub: googleId, email, name, picture } = profile;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Google account does not have a public email" });
    }

    // 2. Try to find user by googleId first, then by email
    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
    }

    if (!user) {
      // 3a. New user — create and mark as verified (Google already verified email)
      user = await User.create({
        name,
        email,
        googleId,
        photo: picture,
        provider: "google",
        isVerified: true,
      });

      // Create linked Account for the new user
      await Account.create({ userId: user._id });

      console.log("[GOOGLE AUTH] New user created:", user.email);
    } else if (!user.googleId) {
      // 3b. Existing local-auth user — link their Google account
      user.googleId = googleId;
      user.provider = "google";
      if (!user.photo) user.photo = picture;
      user.isVerified = true;
      await user.save();
      console.log("[GOOGLE AUTH] Existing user linked to Google:", user.email);
    } else {
      console.log("[GOOGLE AUTH] Existing Google user logged in:", user.email);
    }

    // 4. Generate JWT and respond
    const token = generateToken(user._id);
    return res.status(200).json({
      token,
      message: "Google authentication successful",
    });
  } catch (error) {
    console.error("[GOOGLE AUTH] Error:", error.message);
    return res.status(500).json({
      message: "Google authentication failed",
      error: error.message,
    });
  }
};

module.exports = { googleAuth };
