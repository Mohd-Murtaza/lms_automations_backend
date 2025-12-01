import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import fs from "fs";
import { google } from "googleapis";
import { getAuthClient } from "./configs/googleSheetClient.js";
import { AutomationRouter } from "./routes/automation.routes.js";
import { ConfigRouter } from "./routes/config.routes.js";



const PORT = process.env.PORT || 8000;
const TOKEN_PATH = "tokens.json";
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_SECRET_KEY;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const app = express();
app.use(cors());
app.use(express.json());
getAuthClient()
// ✅ OAuth callback route
app.get("/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;
    const { tokens } = await oAuth2Client.getToken(code);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    oAuth2Client.setCredentials(tokens);

    res.send("✅ Tokens saved successfully. You can now close this tab.");
    console.log("✅ Tokens saved to tokens.json");
  } catch (error) {
    console.error("❌ Error during OAuth callback:", error.message);
    res.status(500).send("Authentication failed");
  }
});

// ✅ Test route
app.get("/test", (req, res) => {
  res.send("This is a test route");
});

// ✅ Main API routes
app.use("/api", AutomationRouter);
app.use("/config", ConfigRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
