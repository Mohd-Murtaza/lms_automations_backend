import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs"
import open from "open";
const TOKEN_PATH = "tokens.json"
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_SECRET_KEY;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

// function getAuthClient() {
//   const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
//   const oAuth2Client = new google.auth.OAuth2();
//   oAuth2Client.setCredentials(tokens);
//   return oAuth2Client;
// }

// export const getSheetsClient = () => {
//   const auth = getAuthClient();
//   return google.sheets({ version: "v4", auth });
// };

// export const getAuthClient = () => {
//   const auth = new google.auth.GoogleAuth({
//     keyFile: "./configs/google_service_account.json", // path to your service account JSON
//     scopes: [
//       "https://www.googleapis.com/auth/drive.readonly", // Drive
//       "https://www.googleapis.com/auth/spreadsheets.readonly", // if needed
//       "https://www.googleapis.com/auth/presentations.readonly", // Slides
//     ],
//   });

//   return auth;
// };

// export const getAuthClient = ()=> {
//   let tokens;

//   // 1. Check if tokens.json exists
//   if (fs.existsSync(TOKEN_PATH)) {
//     tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
//   }

//   const oAuth2Client = new google.auth.OAuth2(
//     CLIENT_ID,
//     CLIENT_SECRET,
//     REDIRECT_URI
//   );

//   // 2. If tokens exist and not expired, reuse them
//   if (tokens && tokens.expiry_date > Date.now()) {
//     oAuth2Client.setCredentials(tokens);
//     console.log("✅ Using saved access token");
//     return oAuth2Client;
//   }

//   // 3. If expired but we have refresh_token, refresh automatically
//   if (tokens && tokens.refresh_token) {
//     oAuth2Client.setCredentials(tokens);
//     console.log("♻️ Access token expired, refreshing...");
//     //return oAuth2Client;
//   }

//   // 4. Else force OAuth consent screen
//   console.log("⚠️ No valid tokens, please authenticate");
//     const authUrl = oAuth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/presentations.readonly"],
//   });
//   open(authUrl); // 👈 This opens the URL in your browser
  
//   //return null;
// }

export const getAuthClient = () => {
  let tokens;

  if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  }

  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  if (tokens && tokens.expiry_date > Date.now()) {
    oAuth2Client.setCredentials(tokens);
    console.log("✅ Using saved access token");
    return oAuth2Client;
  }

  // if (tokens && tokens.refresh_token) {
  //   oAuth2Client.setCredentials(tokens);
  //   console.log("♻️ Access token expired, refreshing...");
  //  //open(authUrl);
  //  // return oAuth2Client;
  //  return null
  // }

  // No valid tokens → prompt user
  console.log("⚠️ No valid tokens, please authenticate");
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/presentations.readonly",
      "https://www.googleapis.com/auth/drive.readonly", // Drive read access
     // "https://www.googleapis.com/auth/drive" // optional if you need write access
     "https://www.googleapis.com/auth/documents.readonly"
    ],
  });
  open(authUrl);
  return null; // important: explicitly return null
};




export const getSheetsClient = () => {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error("No valid auth client, please authenticate first.");
  }
  return google.sheets({ version: "v4", auth });
};


// --- Slides client ---
export const getSlidesClient = () => {
  const auth = getAuthClient();
  if (!auth) throw new Error("No valid auth client, please authenticate first.");
  return google.slides({ version: "v1", auth });
};

// --- Drive client ---
export const getDriveClient = () => {
  const auth = getAuthClient();
  if (!auth) throw new Error("No valid auth client, please authenticate first.");

  // Include only readonly scope if you just want to read files
  return google.drive({ version: "v3", auth });
};

/// --- doc client
export const getDocClient = () => {
  const auth = getAuthClient();
  if (!auth) throw new Error("No valid auth client, please authenticate first.");
  return google.drive({ version: "v3", auth });
};