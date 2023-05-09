/**
  This file is in charge of creating the COMPLETIONS.json file automatically
  It's intended that this file is able to be created automatically from the PowerShell
  docs.

  The logic, and behavior of this file are largely borrowed and based
  off the behavior of `autocomplete-powershell`s own ./update/update.js
*/

const childProcess = require("node:child_process");
const fs = require("fs");
const path = require("path");
const fm = require("front-matter");

const COMMON_PARAMETERS = require("./common_parameters.json");
const VERSION = "winserver2022-ps";

async function update() {
  let CMDLET = [];
  let PARAMS = {};

  // Check if our repo is already cloned, and if so skip cloning
  if (!fs.existsSync("./windows-powershell-docs")) {
    let cloneRepo = await cloneDocRepo();

    if (!cloneRepo) {
      console.error("An error occured cloning the PowerShell-Docs Repo");
      process.exit(1);
    }
  }

  // Now that the repo is cloned we can go ahead and start generating our docs
  const fileHandler = async (filePath, pathArray, file) => {

    // When handling each file we don't care about index files, so we will manually ignore them.
    // But each index file seems to be the only file without a `-` since all CMDlets use them
    if (!file.includes("-")) {
      return;
    }

    // The following actions are largely based off `Microsoft.PowerShell.Management/Add-Content.md`

    const data = fs.readFileSync(`./${filePath}`, "utf8");

    const frontMatter = fm(data);

    let title = frontMatter.attributes.title ?? file.replace(".md", "");

    CMDLET.push({
      displayText: title,
      text: title,
      description: generateSynopsis(frontMatter.body),
      descriptionMoreURL: frontMatter.attributes["online version"],
      rightLabel: frontMatter.attributes["Module Name"]
    });

    const paramData = frontMatter.body.split("## PARAMETERS")[1];

    PARAMS[title] = generateParams(paramData, title);
  };

  await enumerateFiles(`./windows-powershell-docs/docset/${VERSION}/`, [], fileHandler);

  // Now to generate our final object
  const comp = {
    cmdlet: CMDLET,
    params: PARAMS
  };

  fs.writeFileSync("COMPLETIONS.json", JSON.stringify(comp, null, 2));

  console.log("Successfully updated completions!");
}

async function cloneDocRepo() {
  return new Promise((resolve, reject) => {
    try {

      childProcess.exec(
        "git clone https://github.com/MicrosoftDocs/windows-powershell-docs",
        { shell: "cmd.exe" },
        (error, stdout, stderr) => {
          if (error) {
            throw error;
            process.exit(1);
          }

          resolve(true);
      });
    } catch(err) {
      throw err;
      process.exit(1);
    }
  });
}

async function enumerateFiles(dir, pathArray, callback) {

  let files = fs.readdirSync(dir);

  for (const file of files) {
    let target = path.join(dir, file);

    if (fs.lstatSync(target).isDirectory()) {
      await enumerateFiles(`./${target}`, [ ...pathArray, file ], callback);
    } else {
      await callback(target, pathArray, file);
    }
  }
}

function generateSynopsis(text) {
  try {
    let initial = text.match(/(?<=## SYNOPSIS)[\s\S]*?(?=## SYNTAX)/)[0];

    initial = initial.trim();
    initial = initial.replace(/(\r\n|\n|\r)/gm, " ");

    let firstSentenceReg = /[\s\S]*?\.\s*/;

    if (firstSentenceReg.test(initial)) {
      // This would indicate that the text is multiline,
      initial = initial.match(firstSentenceReg)[0];
    }

    // TODO Maybe parse markdown?
    return initial;

  } catch(err) {
    console.log(err);
    return "";
  }
}

function generateParams(text, moduleName) {

  let lineEndingReg = /(\r\n|\n|\r)/gm;
  let firstSentenceReg = /[\s\S]*?\.\s+/;

  if (typeof text !== "string" && text?.length < 1) {
    return [];
  }

  // Text will be the text of the docs page, starting at our parameters
  try {
    text = text.split("## INPUTS")[0];
  } catch(err) {
    return [];
  }
  // ^^ Remove the trailing data we don't care about

  let allParams = text.split("###"); // Split by each param heading

  let arrayParams = [];

  for (let i = 0; i < allParams.length; i++) {
    // Lets first do some safety checks
    let curString = allParams[i];

    if (curString.replace(lineEndingReg, "").length < 1) {
      continue;
    }

    let paramTitle = curString.split(lineEndingReg, 1)[0];
    paramTitle = paramTitle.trim();
    // Keep in mind this still hase `-`

    if (paramTitle === "CommonParameters") {
      // We will have special handling here for the common handlers
      arrayParams = arrayParams.concat(COMMON_PARAMETERS);

      continue;
    }

    let description = curString;

    try {
      description = description.replace(paramTitle, "");
      description = description.trim();
      description = description.replace(lineEndingReg, " ");
      description = description.match(firstSentenceReg)[0];
      description = description.trim();
      //description = curString.split(lineEndingReg, 1)[2].match(firstSentenceReg)[0];
    } catch(err) {
      description = curString;
    }
    //let description = curString.split(lineEndingReg, 1)[2].match(firstSentenceReg)[0];

    let rawType;

    try {
      rawType = curString.match(/Type: (.*)/)[1];
    } catch(err) {
      rawType = "";
    }
    //let rawType = curString.match(/Type: (.*)/)[1];

    arrayParams.push({
      displayText: paramTitle.replace("-", ""),
      text: paramTitle,
      description: description,
      rightLabel: rawType
    });

  }

  return arrayParams;
}

update();
