export async function updateNotes(page,assignment){
    try {
    console.log(
      `🚀 Notes Updating Of: ${assignment.assesment_template_name}`
    );

    // 1️⃣ Go to assignments page
    await page.goto(`https://experience-admin.masaischool.com/lectures/?page=0&title=${assignment.assesment_template_name}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("📄 Navigated to lecture Page");
   /// The data appears in the tab, the first td is the lecture id, get that lectures id and 
   /// navigate to https://experience-admin.masaischool.com/lectures/edit/?id=<id from above>
   // then get the text area whose Placeholder is Enter description
   /// then paste the notes that is assignment.notes
   // then cick a button whose text is EDIT LECTURE

   // 2️⃣ Wait for the table to appear
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    // 3️⃣ Extract lecture ID from the first row's first cell
    const lectureId = await page
      .locator("table tbody tr:first-child td:first-child")
      .innerText();
    if (!lectureId) throw new Error("Lecture ID not found in table");

    console.log(`🆔 Found lecture ID: ${lectureId}`);

    // 4️⃣ Navigate to the lecture edit page
    const editUrl = `https://experience-admin.masaischool.com/lectures/edit/?id=${lectureId}`;
    await page.goto(editUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`✏️ Navigated to lecture edit page: ${editUrl}`);

    // 5️⃣ Wait for textarea and fill the notes
    const notesTextarea = page.locator('textarea[placeholder="Enter description"]');
    await notesTextarea.waitFor({ state: "visible", timeout: 10000 });

    // Clear old text (if any)
    await notesTextarea.fill("");
    await notesTextarea.fill(assignment.notes || "No Notes Provided");
    console.log("🗒️ Filled lecture notes");

    // //// Group Type
    // const groupTypeInput = page.locator(
    //   "xpath=/html/body/div/div/div/main/form/div[2]/div[3]/div/div/label[1]/div/div/div[1]/div[2]/input"
    // );
    // await groupTypeInput.waitFor({ state: "visible", timeout: 10000 });
    // await groupTypeInput.click({ force: true }); // focus field
    // await page.keyboard.type("Test Group", { delay: 30 });
    // await page.keyboard.press("Enter");
    // console.log(`✅ Typed Group Type`);

    // /// Topic
    // const topicInput = page.locator(
    //   "xpath=/html/body/div/div/div/main/form/div[2]/div[3]/div/div/label[2]/div/div/div[1]/div[2]/input"
    // );
    // await topicInput.waitFor({ state: "visible", timeout: 10000 });
    // await topicInput.click({ force: true }); // focus field
    // await page.keyboard.type("topic_title_002", { delay: 30 });
    // await page.keyboard.press("Enter");
    // console.log(`✅ Typed Group Type`);

    // /// learning_Objectives_Input
    // const learning_Objectives_Input = page.locator(
    //   "xpath=/html/body/div/div/div/main/form/div[2]/div[3]/div/div/label[3]/div/div/div[1]/div[2]/input"
    // );
    // await learning_Objectives_Input.waitFor({
    //   state: "visible",
    //   timeout: 10000,
    // });
    // await learning_Objectives_Input.click({ force: true }); // focus field
    // await page.keyboard.type("test_LO_003", { delay: 30 });
    // await page.keyboard.press("Enter");
    // console.log(`✅ Typed Group Type`);


    // 6️⃣ Click the "EDIT LECTURE" button
    const editButton = page.locator('button:has-text("EDIT LECTURE")');
    await editButton.waitFor({ state: "visible", timeout: 10000 });
    await editButton.click({ force: true });
    console.log("💾 Clicked 'EDIT LECTURE' button");

    // 7️⃣ Wait for confirmation (toast / navigation)
    await page.waitForTimeout(2000);
    console.log("✅ Notes updated successfully");
    
    console.log("Notes Updation Done")
    return "Done";
  } catch (err) {
    console.error(
      `❌ Error while creating assignment '${assignment.assesment_template_name}':`,
      err.message
    );
    return "Error";
  }
    
}