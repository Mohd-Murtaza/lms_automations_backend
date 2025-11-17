export async function createLecture(page, lecture) {
  try {
    console.log(
      `🚀 Creating lecture: ${lecture.title}`
    );
    let flagForLecture=false
    // 1️⃣ Go to lectures page
    await page.goto("https://experience-admin.masaischool.com/lectures/create/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("📄 Navigated to lecture creating Page");

    // 3️⃣ Wait for title input and fill it
    const titleInput = page.locator('input[placeholder="Enter Title"]');
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000); 
    await titleInput.fill(lecture.title);
    console.log(`✏️ Filled title: ${lecture.title}`);

    // 4️⃣ Fill Type (custom select using XPath) - lecture/Practice/Evaluation
    const typeInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[1]/div/label[1]/div/div/div[1]/div[2]/input"
    );
    await typeInput.waitFor({ state: "visible", timeout: 10000 });
    await typeInput.click({ force: true }); // focus field
    await typeInput.fill(lecture.type, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected Type: ${lecture.type}`);

    ////  category - dsa/coding
    const categoryInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[1]/div/label[2]/div/div/div[1]/div[2]/input"
    );
    await categoryInput.waitFor({ state: "visible", timeout: 10000 });
    await categoryInput.click({ force: true }); // focus field
    await categoryInput.fill(lecture.category, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected category: ${lecture.category}`);

    ////  tags
    const tagsInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[1]/div/label[3]/div/div/div[1]/div/input"
    );
    await tagsInput.waitFor({ state: "visible", timeout: 10000 });
    await tagsInput.click({ force: true }); // focus field
    await tagsInput.fill(lecture.tags, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected tags: ${lecture.tags}`);

    // Host name
    const hostInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[1]/div/label[4]/div/div/div[1]/div[2]/input"
    );
    await hostInput.waitFor({ state: "visible", timeout: 10000 });
    await hostInput.click({ force: true }); // focus field
    await hostInput.fill(lecture.host_name, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected Host Name: ${lecture.host_name}`);

    /// enter batch
    const batchInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[2]/div/label[1]/div/div/div[1]/div[2]/input"
    );
    await batchInput.waitFor({ state: "visible", timeout: 10000 });
    await batchInput.click({ force: true }); // focus field
    await batchInput.fill(lecture.batch, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected batch: ${lecture.batch}`);

    // section -
    const sectionInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[2]/div/label[2]/div/div/div[1]/div[2]/input"
    );
    await sectionInput.waitFor({ state: "visible", timeout: 10000 });
    await sectionInput.click({ force: true }); // focus field
    await sectionInput.fill(lecture.section, { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Selected section: ${lecture.section}`);

    // associated lectures -
    if(lecture.associated_lecture){
        const associatedLecturesInput = page.locator(
          "xpath=/html/body/div/div/div/main/form/div[1]/div[2]/div/label[3]/div/div/div[1]/div[2]/input"
        );
        await associatedLecturesInput.waitFor({ state: "visible", timeout: 10000 });
        await associatedLecturesInput.click({ force: true }); // focus field
        await page.keyboard.type(lecture.associated_lecture, { delay: 30 });
        await page.waitForTimeout(1000); 
        await page.keyboard.press("Enter");
        console.log(`✅ Selected associated lectures: ${lecture.associated_lecture}`);
    }

    //// Group Type
    const groupTypeInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[1]/div/div/div[1]/div[2]/input"
    );
    await groupTypeInput.waitFor({ state: "visible", timeout: 10000 });
    await groupTypeInput.click({ force: true }); // focus field
    await page.keyboard.type("Test Group", { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Typed Group Type`);

    /// Topic
    const topicInput = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[2]/div/div/div[1]/div[2]/input"
    );
    await topicInput.waitFor({ state: "visible", timeout: 10000 });
    await topicInput.click({ force: true }); // focus field
    await page.keyboard.type("topic_title_002", { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Typed Group Type`);

    /// learning_Objectives_Input
    const learning_Objectives_Input = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[3]/div/div/label[3]/div/div/div[1]/div[2]/input"
    );
    await learning_Objectives_Input.waitFor({
      state: "visible",
      timeout: 10000,
    });
    await learning_Objectives_Input.click({ force: true }); // focus field
    await page.keyboard.type("test_LO_003", { delay: 30 });
    await page.waitForTimeout(1000); 
    await page.keyboard.press("Enter");
    console.log(`✅ Typed Group Type`);

    // zoom link
    if(lecture.zoom_link){
        try {
            // Zoom Link - human-like + force
            const zoomInput = page.locator('input[placeholder="Zoom Link"]');
            await zoomInput.waitFor({ state: "attached", timeout: 20000 }); // ensure it exists in DOM
            await zoomInput.click({ force: true }); // click even if disabled/hidden
            await zoomInput.fill(lecture.zoom_link || "No Zoom Link", { delay: 30 });
            await page.waitForTimeout(1000); 
            await page.keyboard.press("Enter");
            console.log("✅ Zoom Link filled successfully");
        } catch (err) {
            console.log(`⚠️ Could not update zoom link: ${err.message}`);
        }
    }

    // Notes added
    try {
      const notesXpath = "/html/body/div/div/div/main/form/div[5]/div/div[2]/div[1]/div/textarea";
      const notesLocator = page.locator(`xpath=${notesXpath}`);
      await notesLocator.waitFor({ state: "attached", timeout: 20000 });
    //   await notesLocator.scrollIntoViewIfNeeded();
      await notesLocator.click({ force: true });
      await notesLocator.fill(lecture.notes || "No Notes Provided");
      await page.waitForTimeout(1000); 
      await page.keyboard.press("Enter");
      console.log("🗒️ Notes updated successfully");
      flagForLecture=true
    } catch (err) {
      console.log(`⚠️ Could not update notes: ${err.message}`);
    }

    /// schedule
    const schedule_Date_Time_Input = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[4]/div/label[1]/div/div/input"
    );
    await schedule_Date_Time_Input.waitFor({
      state: "visible",
      timeout: 10000,
    });
    await schedule_Date_Time_Input.click({ force: true }); // focus field
    // Step 1️⃣ Type the date (e.g. "06-11-2025")
    await page.keyboard.type(`${lecture.startDate}`, { delay: 30 });

    // // Step 2️⃣ Add a space
    await page.keyboard.press("Tab");

    // Step 3️⃣ Type the time (e.g. "08:00 PM")
    await page.keyboard.type(lecture.startTime, { delay: 30 });

    // Step 4️⃣ Confirm
    await page.keyboard.press("Enter");

    console.log(`✅ Schedule entered: ${lecture.startDate} ${lecture.startTime}`);
    /// end date time

    const end_Date_Time_Input = page.locator(
      "xpath=/html/body/div/div/div/main/form/div[1]/div[4]/div/label[2]/div/div/input"
    );
    await end_Date_Time_Input.waitFor({
      state: "visible",
      timeout: 10000,
    });
    await end_Date_Time_Input.click({ force: true }); // focus field
    // Step 1️⃣ Type the date (e.g. "06-11-2025")
    await page.keyboard.type(`${lecture.endDate}`, { delay: 30 });

    // // Step 2️⃣ Add a space
    await page.keyboard.press("Tab");

    // Step 3️⃣ Type the time (e.g. "08:00 PM")
    await page.keyboard.type(lecture.endTime, { delay: 30 });
    
    await page.waitForTimeout(1500); 
    // Step 4️⃣ Confirm
    await page.keyboard.press("Enter");

    console.log(`✅ Schedule will end at: ${lecture.endDate} ${lecture.endTime}`);


    // Click on the Create Button
    const createButton = page.locator('button:has-text("CREATE")');
    await createButton.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1500); 
    await createButton.click({force:true});
    console.log(`✏️ Filled notes successfully`);
    
    return flagForLecture ? "Done" : "Not Done"
  } catch (err) {
    console.error(
      `❌ Error while creating lecture '${lecture.title}':`,
      err.message
    );
    return "Error";
  }
}
