import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { getSheetsClient } from "../configs/googleSheetClient.js";
import { assessmentCloneRenameQueue, assignmentCreationQueue, connection, notesUpdationQueue, lectureCreationQueue} from "../configs/redis_bullmq.config.js";
import { getConfig } from "../utils/getConfig.js";
const { GOOGLE_SHEET_ID } = getConfig();



export const AutomationRouter = express.Router();

AutomationRouter.post("/add-data", async (req, res) => {
  try {
    const type = req.query.type; // assignments or lectures
    if (!type) {
      return res.status(400).json({ message: "Missing ?type=assignments|lectures" });
    }

    const validTypes = ["assignments", "lectures"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid type. Use assignments or lectures."
      });
    }

    const sheetName = type === "assignments" ? "assignment" : "lecture";

    console.log(`📄 Reading sheet: ${sheetName}`);

    const sheets = getSheetsClient();
    const spreadsheetId = GOOGLE_SHEET_ID;

    // --- FETCH SHEET METADATA TO GET sheetId ---
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet = meta.data.sheets.find(
      (s) => s.properties.title === sheetName
    );
    console.log("🚀 ~ targetSheet:", targetSheet)

    if (!targetSheet) {
      return res.status(400).json({ message: `Sheet '${sheetName}' not found.` });
    }

    const sheetId = targetSheet.properties.sheetId;
    console.log("📌 sheetId:", sheetId);

    // --- READ DATA ---
    const range = `${sheetName}!A:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: `No data found in ${sheetName}` });
    }

    const headers = rows[0];
    const redisIdColIndex = headers.indexOf("redisId");

    console.log("🚀 ~ redisIdColIndex:", redisIdColIndex);

    if (redisIdColIndex === -1) {
      return res.status(400).json({
        message: `Column "redisId" not found in sheet ${sheetName}`,
      });
    }

    const records = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i] || ""));
      return obj;
    });

    console.log("📌 Records fetched:", records.length);

    // --- DELETE OLD REDIS DATA ---
    const pattern = `${type}:*`;
    const oldKeys = await connection.keys(pattern);
    console.log("🚀 ~ oldKeys:", oldKeys)

    if (oldKeys.length > 0) {
      await connection.del(...oldKeys);
      console.log(`🗑️ Old ${type} removed:`, oldKeys.length);
    }

    // --- INSERT NEW DATA & PREPARE WRITE-BACK REQUESTS ---
    let success = 0,
      failed = 0;

    const writeBackRequests = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      const redisId = rec.lecture_id
        ? rec.lecture_id
        : rec.title?.replace(/\s+/g, "-").toLowerCase() + "-" + uuidv4();

      rec.redisId = redisId;

      try {
        const redisKey = `${type}:${redisId}`;
        await connection.hset(redisKey, rec);
        success++;

        // Batch update request
        writeBackRequests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: redisId }
                  }
                ]
              }
            ],
            fields: "userEnteredValue",
            range: {
              sheetId,
              startRowIndex: i + 1,
              endRowIndex: i + 2,
              startColumnIndex: redisIdColIndex,
              endColumnIndex: redisIdColIndex + 1
            }
          }
        });

      } catch (err) {
        console.error("❌ Redis insert error:", err.message);
        failed++;
      }
    }

    // --- EXECUTE BATCH UPDATE IN SHEET ---
    if (writeBackRequests.length > 0) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: writeBackRequests
          }
        });

        console.log("🟢 redisId write-back completed");
      } catch (err) {
        console.error("⚠️ Write-back failed:", err.message);
      }
    }

    return res.json({
      message: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully.`,
      totalSheetRows: records.length,
      redisInserted: success,
      redisFailed: failed,
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({
      message: "Server error.",
      error: err.message,
    });
  }
});

AutomationRouter.post("/create-lectures", async (req, res) => {
  try {
    // 🔹 1 — Fetch all lecture data from Redis
    const keys = await connection.keys("lectures:*");
    const allLectures = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allLectures.push(data);
      }
    }

    // 🔸 If Redis is empty
    if (allLectures.length === 0) {
      return res.status(404).json({ message: "No lecture data found in Redis." });
    }

    // 🔹 2 — Filter only pending lectures
    // Expecting field: isCreated = "no"
    const pendingLectures = allLectures.filter(
      (l) => (l.isLectureCreated || "").toLowerCase() === "no"
    );

    // 🔸 If nothing is pending
    if (pendingLectures.length === 0) {
      return res.status(200).json({
        message: "✅ All lectures have already been created.",
      });
    }

    // 🔹 3 — Queue the job ONLY for pending
    const job = await lectureCreationQueue.add("bulkLectureCreateJob", {
      lectures: pendingLectures,
    });

    // 🔹 4 — Send result
    return res.json({
      message: "✅ Lecture creation job queued successfully.",
      queuedLectures: pendingLectures.length,
      jobId: job.id,
    });

  } catch (err) {
    console.error("❌ Error while queuing lecture create job:", err.message);
    return res.status(500).json({
      message: "Server error while queuing lecture creation job.",
      error: err.message,
    });
  }
});


AutomationRouter.post("/clone-assessment-template", async (req, res) => {
  try {
    // Fetch all assignment data from Redis
    const keys = await connection.keys("assignments:*");
    const allAssignments = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        allAssignments.push(data);
      }
    }

    if (allAssignments.length === 0) {
      return res.status(404).json({ message: "No assignment data found in Redis." });
    }

    // Filter only those which are not cloned yet
    const pendingAssignments = allAssignments.filter(
      (a) => (a.isCloned || "").toLowerCase() === "no"
    );

    if (pendingAssignments.length === 0) {
      return res.status(200).json({ message: "✅ All assignments are already cloned." });
    }

    // Queue cloning jobs
    const job = await assessmentCloneRenameQueue.add("bulkAssessmentCloneJob", {
      assignments: pendingAssignments,
    });

    return res.json({
      message: "✅ Assessment cloning job queued successfully.",
      queuedAssignments: pendingAssignments.length,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ Error while queuing clone jobs:", err.message);
    return res.status(500).json({
      message: "Server error while queuing assessment clone job.",
      error: err.message,
    });
  }
});


AutomationRouter.post("/create-assignments", async (req, res) => {
  try {
    const keys = await connection.keys("assignments:*");
    const pendingAssignments = [];
    
    for (const key of keys) {
      const a = await connection.hgetall(key);

      if (!a || Object.keys(a).length === 0) continue;

      // STEP 1: Early check — stop at first not cloned
      if (!a.isCloned || a.isCloned.toLowerCase() !== "yes") {
        return res.status(400).json({
          message:
            "❌ Some assignments are not cloned yet. Please clone ALL assessments before creating assignments.",
          details: a,
        });
      }

      // STEP 2: Collect only pending ones
      if (!a.isAssignmentCreated || a.isAssignmentCreated.toLowerCase() !== "yes") {
        pendingAssignments.push(a);
      }
    }

    if (pendingAssignments.length === 0) {
      return res.status(200).json({
        message: "All assignments already created.",
      });
    }
    console.log("🔷 pending Assignments length and the assignments====>", pendingAssignments.length, pendingAssignments)
    const job = await assignmentCreationQueue.add("bulkAssignmentCreateJob", {
      assignments: pendingAssignments,
    });

    return res.json({
      message: "Queued successfully",
      pendingCount: pendingAssignments.length,
      jobId: job.id,
    });

  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});


AutomationRouter.post("/start-update-notes", async (req, res) => {
  try {
    // Step 1 — Get all assignment data from Redis
    const keys = await connection.keys("assignments:*");
    
    if (keys.length === 0) {
      return res.status(404).json({ message: "No assignments found in Redis" });
    }

    const pendingNotesToUpdate = [];

    // Step 2 — One-pass loop
    for (const key of keys) {
      const data = await connection.hgetall(key);
      if (!data || Object.keys(data).length === 0) continue;

      // If notes are already updated → skip
      if (data.isNotesUpdated && data.isNotesUpdated.toLowerCase() === "yes") {
        continue;
      }

      // Otherwise pending
      pendingNotesToUpdate.push(data);
    }

    console.log("Pending notes to update:", pendingNotesToUpdate.length, pendingNotesToUpdate);

    // Step 3 — Nothing pending
    if (pendingNotesToUpdate.length === 0) {
      return res.status(200).json({
        message: "✅ All lectures already have updated notes.",
      });
    }

    // Step 4 — Queue job
    const job = await notesUpdationQueue.add("bulkNotesUpdateJob", {
      lectures: pendingNotesToUpdate,
    });

    return res.json({
      message: "✅ Notes updation job queued successfully.",
      queuedLectures: pendingNotesToUpdate.length,
      jobId: job.id,
    });

  } catch (err) {
    console.error("❌ Error while queuing notes update:", err.message);
    return res.status(500).json({
      message: "Server error while adding notes update job",
      error: err.message,
    });
  }
});


AutomationRouter.get("/get-automation-status", async (req, res) => {
  try {
    const type = req.query.type; // assignments OR lectures
    console.log("🚀 ~ type: ======>", type);

    // --- VALIDATE TYPE ---
    if (!type) {
      return res.status(400).json({
        message: "Missing ?type=assignments|lectures",
      });
    }

    const validTypes = ["assignments", "lectures"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid type. Use ?type=assignments OR ?type=lectures",
      });
    }

    // --- REDIS KEY PATTERN ---
    const pattern = `${type}:*`; // assignments:* or lectures:*
    const keys = await connection.keys(pattern);

    if (keys.length === 0) {
      return res.status(404).json({
        message: `No ${type} data found in Redis.`,
      });
    }

    const results = [];

    for (const key of keys) {
      const data = await connection.hgetall(key);

      if (data && Object.keys(data).length > 0) {

        // REMOVE PREFIX like "assignments:" or "lectures:"
        const cleanKey = key.replace(`${type}:`, "");
        // COMMON FIELDS
        const commonData = {
          redisKey: cleanKey,
          title: data.title || "",
          batch: data.batch || "",
          section: data.section || "",
        };

        // DIFFERENT LOGIC FOR ASSIGNMENTS VS LECTURES
        if (type === "assignments") {
          results.push({
            ...commonData,
            isCloned: data.isCloned || "N/A",
            isAssignmentCreated: data.isAssignmentCreated || "N/A",
            isNotesUpdated: data.isNotesUpdated || "N/A",
          });
        }

        if (type === "lectures") {
          results.push({
            ...commonData,
            isLectureCreated: data.isLectureCreated || "N/A",
          });
        }
      }
    }
    return res.json({
      type,
      total: results.length,
      data: results,
    });

  } catch (err) {
    console.error("❌ Error fetching automation status:", err.message);
    return res.status(500).json({
      message: "Server error while fetching automation status",
      error: err.message,
    });
  }
});

AutomationRouter.patch("/update-automation-status", async (req, res) => {
  try {
    const { redisId, field, newValue } = req.body;
    console.log("🚀 ~ redisId:", redisId)
    const type = req.query.type;
    console.log("🚀 ~ type:", type)

    if (!type) {
      return res.status(400).json({ message: "Missing ?type=assignments|lectures" });
    }

    if (!redisId || !field || typeof newValue === "undefined") {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const redisKey = type==="assignments" ? `assignments:${redisId}`:`lectures:${redisId}`
    console.log("🚀 ~ redisKey:", redisKey)

    // Check Redis existence
    const exists = await connection.exists(redisKey);
    console.log("🚀 ~ exists:", exists)
    if (!exists) {
      return res.status(404).json({ message: `No record found: ${redisKey}` });
    }

    // ---------- FIELD MAPPING ----------
    let redisField, sheetField;

    if (type === "assignments") {
      switch (field) {
        case "assessmentClone":
          redisField = "isCloned";
          sheetField = "isCloned";
          break;
        case "assignmentCreated":
          redisField = "isAssignmentCreated";
          sheetField = "isAssignmentCreated";
          break;
        case "notesUpdated":
          redisField = "isNotesUpdated";
          sheetField = "isNotesUpdated";
          break;
        default:
          return res.status(400).json({ message: "Invalid field for assignments" });
      }
    }

    if (type === "lectures") {
      switch (field) {
        case "lectureCreated":
          redisField = "isLectureCreated";
          sheetField = "isLectureCreated";
          break;
        default:
          return res.status(400).json({ message: "Invalid field for lectures" });
      }
    }

    // ---------- UPDATE REDIS ----------
    await connection.hset(redisKey, redisField, newValue);

    // ---------- UPDATE GOOGLE SHEET ----------
    const sheets = getSheetsClient();
    const spreadsheetId = GOOGLE_SHEET_ID;

    const sheetName = type === "assignments" ? "assignment" : "lecture";
    const range = `${sheetName}!A:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    const headers = rows[0];

    const colIndex = headers.indexOf(sheetField);
    console.log("🚀 ~ colIndex:", colIndex)
    if (colIndex === -1) {
      return res.status(400).json({ message: "Column not found in sheet" });
    }

    // find row by redisId
    const rowIndex = rows.findIndex((row) => row.includes(redisId));
    console.log("🚀 ~ rowIndex:", rowIndex)
    if (rowIndex === -1) {
      return res.status(404).json({ message: "Row not found in sheet" });
    }

    const updateRange = `${sheetName}!${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newValue]],
      },
    });

    return res.json({
      message: `✅ Updated Redis and Google Sheet successfully`,
      field: redisField,
      newValue,
      redisKey
    });

  } catch (err) {
    console.error("❌ Error updating automation status:", err.message);
    return res.status(500).json({
      message: "Server error while updating automation status",
      error: err.message
    });
  }
});

// ✅ Clear all Redis data related to automation
AutomationRouter.delete("/cleardata", async (req, res) => {
  try {
    const type = req.query.type; // assignments | lectures
    console.log("🚀 ~ type:", type);

    if (!type || !["assignments", "lectures"].includes(type)) {
      return res.status(400).json({
        message: "Invalid type. Allowed: assignments | lectures",
      });
    }

    // ------------------------------------------
    // 🔥 1) CLEAR Google Sheet redisId Column
    // ------------------------------------------
    const sheets = getSheetsClient();
    const spreadsheetId = GOOGLE_SHEET_ID;

    const sheetName = type === "assignments" ? "assignment" : "lecture";
    const range = `${sheetName}!A:Z`;

    // Step 1: Read sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(400).json({
        message: `❌ Sheet '${sheetName}' is empty.`,
      });
    }

    // Step 2: Detect redisId column dynamically
    const headers = rows[0];
    const redisColIndex = headers.findIndex(
      (h) => h?.toLowerCase().trim() === "redisid"
    );
    console.log("🚀 ~ redisColIndex:", redisColIndex)
    // console.log("🚀 ~ headers:", headers)

    if (redisColIndex === -1) {
      return res.status(400).json({
        message: `❌ 'redisId' column not found in sheet '${sheetName}'. Please check header.`,
        availableHeaders: headers,
      });
    }

    // Convert index → column letter (A–Z)
    const colLetter = String.fromCharCode(65 + redisColIndex);
    const clearRange = `${sheetName}!${colLetter}2:${colLetter}`;
    console.log("🚀 ~ clearRange:", clearRange)

    // Step 3: Clear entire redisId column dynamically
    const totalRows = rows.length; // including header row
    const blankValues = [];
      
    // Create empty rows equal to sheet rows-1 (excluding header)
    for (let i = 1; i < totalRows; i++) {
      blankValues.push([""]);
    }
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: clearRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: blankValues,
      },
    });

    console.log(`🧽 Cleared redisId column (${colLetter}) in sheet '${sheetName}'`);

    // ------------------------------------------
    // 🔥 2) CLEAR REDIS KEYS
    // ------------------------------------------
    const redisPattern = `${type}:*`;
    const keys = await connection.keys(redisPattern);
    let clearedCount = 0;

    if (keys.length > 0) {
      await connection.del(keys);
      clearedCount = keys.length;
      console.log(`🧹 Deleted ${keys.length} Redis keys for type: ${type}`);
    }

    // ------------------------------------------
    // 🔥 3) CLEAR BullMQ QUEUES BASED ON TYPE
    // ------------------------------------------
    const assignmentQueues = [
      "assessmentCloneRenameQueue",
      "assignmentCreationQueue",
      "notesUpdationQueue",
    ];

    const lectureQueues = ["lectureCreationQueue"];

    const queuesToClear =
      type === "assignments" ? assignmentQueues : lectureQueues;

    for (const q of queuesToClear) {
      const pattern = `bull:${q}:*`;
      const queueKeys = await connection.keys(pattern);

      if (queueKeys.length > 0) {
        await connection.del(queueKeys);
        console.log(`🧼 Cleared BullMQ queue: ${q}`);
      }
    }

    // ------------------------------------------
    // 🔥 4) FINAL RESPONSE
    // ------------------------------------------
    return res.json({
      message: `🧹 Cleared Redis + queues + redisId column for '${type}'.`,
      clearedRedisIdColumn: colLetter,
      sheetName,
      clearedRedisKeys: clearedCount,
    });

  } catch (err) {
    console.error("❌ Error clearing data:", err);
    return res.status(500).json({
      message: "Server error while clearing data",
      error: err.message,
    });
  }
});