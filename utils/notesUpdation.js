import os from "os";

export async function updateNotes(page, lecture) {
  console.log("📚 ~ updateNotes ~ lecture:", lecture.lecture_id, typeof lecture.lecture_id);

  try {
    console.log(`🚀 Notes Updating Of: ${lecture.title}`);

    // Validate lecture_id
    const isValidLectureId =
      typeof lecture.lecture_id === "number" ||
      (typeof lecture.lecture_id === "string" && /^\d+$/.test(lecture.lecture_id.trim()));

    console.log("🚀 ~ updateNotes ~ isValidLectureId:", isValidLectureId);

    let editUrl;

    if (isValidLectureId) {
      console.log(`🆔 Using provided Lecture ID: ${lecture.lecture_id}`);
      editUrl = `https://experience-admin.masaischool.com/lectures/edit/?id=${Number(lecture.lecture_id)}`;
    } else {
      console.log("📄 Invalid or missing lecture_id, using fallback search...");
      await page.goto(
        `https://experience-admin.masaischool.com/lectures/?page=0&title=${lecture.title}`,
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      console.log("✅ Navigated to lecture list page");

      await page.waitForSelector("table tbody tr", { timeout: 15000 });
      const lectureId = await page
        .locator("table tbody tr:first-child td:first-child")
        .innerText();
      if (!lectureId) throw new Error("Lecture ID not found in table");
      console.log(`🆔 Found lecture ID: ${lectureId}`);

      editUrl = `https://experience-admin.masaischool.com/lectures/edit/?id=${lectureId}`;
    }

    // Navigate to edit page
    await page.goto(editUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`✏️ Navigated to lecture edit page: ${editUrl}`);

    // Helper: Fill dropdowns only if empty
    async function fillReactSelectIfEmpty(xpath, value, label) {
      try {
        const container = page.locator(`xpath=${xpath}`);
      
        await container.waitFor({ state: "attached", timeout: 20000 });
      
        // Check if value-container has the "has-value" class
        const hasValue = await container.locator(".react-select__value-container--has-value").count();
      
        if (hasValue > 0) {
          console.log(`⏭️ Skipped ${label} (already filled)`);
          return;
        }
      
        // Fill it now
        await container.scrollIntoViewIfNeeded();
        await container.click({ force: true });
      
        await page.keyboard.type(value, { delay: 30 });
        await page.waitForTimeout(1000);
        await page.keyboard.press("Enter");
      
        console.log(`✅ Filled ${label}: ${value}`);
      
      } catch (err) {
        console.log(`⚠️ Could not process ${label}: ${err.message}`);
      }
    }

    await fillReactSelectIfEmpty(
      "/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[1]/div/div",
      "Test Group",
      "Group Type"
    );

    await fillReactSelectIfEmpty(
      "/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[2]/div/div",
      "topic_title_002",
      "Topic"
    );

    await fillReactSelectIfEmpty(
      "/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[3]/div/div",
      "test_LO_003",
      "Learning Objective"
    );

    // for notes updating
    try {
      const selectAllKey = os.platform() === "darwin" ? "Meta+A" : "Control+A";

      const notesXpath = "/html/body/div/div/div/main/form/div[5]/div/div[2]/div[1]/div/textarea";
      const notesLocator = page.locator(`xpath=${notesXpath}`);
      await notesLocator.waitFor({ state: "attached", timeout: 20000 });

      await notesLocator.scrollIntoViewIfNeeded();
      await notesLocator.click({ force: true });
      await page.keyboard.press(selectAllKey);
      await page.keyboard.press("Backspace");
      await notesLocator.fill(lecture.notes || "No Notes Provided");
      await page.waitForTimeout(1000);
      await page.keyboard.press("Enter");

      console.log("🗒️ Notes updated successfully");
    } catch (err) {
      console.log(`⚠️ Could not update notes: ${err.message}`);
    }

    // Click EDIT LECTURE
    try {
      const editButton = page.locator('button:has-text("EDIT LECTURE")');
      await editButton.waitFor({ state: "attached", timeout: 20000 });
      await editButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await editButton.click({ force: true });
      console.log("💾 Clicked 'EDIT LECTURE' button, notes updated");
    } catch (err) {
      console.log(`⚠️ Could not click EDIT LECTURE button: ${err.message}`);
    }

    await page.waitForTimeout(2000);
    console.log("✅ Notes update process completed for:", lecture.title);
    return "Done";
  } catch (err) {
    console.error(
      `❌ Error while updating lecture '${lecture.title}':`,
      err.message
    );
    return "Error";
  }
}