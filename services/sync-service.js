//config
const config = require("../config/config.js");
const accountSid = config.accountSid;
const authToken = config.authToken;
const client = config.client;
const twilioSyncServiceSid = config.transcriptServiceSid;
const mapSid = config.callSummaryMapSid;

const OpenAI = require("openai");
const openAIKey = config.openAIKey;

async function writeTranscriptToTwilio(transcript, speaker, callSid) {
  if (!speaker || !transcript) {
    return;
  }

  if (speaker === "user") {
    speaker = "customer";
  } else if (speaker === "assistant") {
    speaker = "agent";
  }
  console.log("speaker:", speaker, "transcript:", transcript);

  // agent or customer
  const listUniqueName = "Transcript-" + callSid;
  let listSid;
  try {
    // check if list exists
    const checkSyncListExists = await client.sync.v1
      .services(twilioSyncServiceSid)
      .syncLists(listUniqueName)
      .fetch();
    // console.log("Found sync list", checkSyncListExists.sid);
    listSid = checkSyncListExists.sid;
  } catch (e) {
    if (e.code && e.code == "20404") {
      // create sync list
      //   console.log("Creating new sync list");
      const syncList = await client.sync.v1
        .services(twilioSyncServiceSid)
        .syncLists.create({ uniqueName: listUniqueName });
      //   console.log("New sync list created");
      listSid = syncList.sid;
      //   console.log("List sid is", listSid);
    } else {
      console.log(e);
    }
  }
  // add item to list
  const addItem = await client.sync.v1
    .services(twilioSyncServiceSid)
    .syncLists(listSid)
    .syncListItems.create({ data: { speaker, transcript } });
  // console.log(
  //   `Items inserted to list ${addItem.listSid} at index ${addItem.index}`,
  // );
}

async function summarizeCall(callSid, twilioSyncServiceSid, client, mapSid) {
  console.log("Called summarize call");
  const listUniqueName = "Transcript-" + callSid;
  console.log("Using Sync service with SID", twilioSyncServiceSid);
  console.log("List Unique ID", listUniqueName);

  try {
    // Check if list exists and update -- when is list created?
    const getSyncList = await client.sync.v1
      .services(twilioSyncServiceSid)
      .syncLists(listUniqueName)
      .syncListItems.list({ limit: 50 });

    let transcript = "";

    getSyncList.forEach((item, index) => {
      transcript += `${item.data.speaker}: ${item.data.transcript}\n`;
    });

    const openai = new OpenAI({
      apiKey: openAIKey,
    });

    // Create a summary using GPT
    const gptResponse = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Summarize the following transcript in 3 sentences:\n${transcript}`,
        },
      ],
      model: "gpt-4-turbo-preview",
    });

    const summary = gptResponse.choices[0].message.content;
    console.log("Summary:", summary);
    saveSummary(summary, callSid, twilioSyncServiceSid, mapSid, client);
  } catch (e) {
    console.log("Oh shoot. Something went really wrong, check logs", e);
  }
}

async function saveSummary(
  callSummary,
  callSid,
  twilioSyncServiceSid,
  mapSid,
  client,
) {
  console.log("Called save summary");
  const mapKey = "Summary-" + callSid;
  try {
    // Check if map exists and update
    const map = await client.sync.v1
      .services(twilioSyncServiceSid)
      .syncMaps(mapSid)
      .syncMapItems(mapKey)
      .fetch();

    docSid = map.key;
  } catch (e) {
    if (e.code && e.code == 20404) {
      console.log("map doesn't exist, creating");
      const map = await client.sync.v1
        .services(twilioSyncServiceSid)
        .syncMaps(mapSid)
        .syncMapItems.create({
          key: mapKey,
          data: {
            summary: callSummary,
          },
        });
      console.log("map created", map);
    } else {
      console.log(e);
    }
  }

  const updateMap = await client.sync.v1
    .services(twilioSyncServiceSid)
    .syncMaps(mapSid)
    .syncMapItems(mapKey)
    .update({
      data: {
        summary: callSummary,
      },
    });

  console.log("Call Summary added to map with key: ", updateMap.key);
}

exports.writeTranscriptToTwilio = writeTranscriptToTwilio;

// exports.summarizeCall = summarizeCall;
// exports.saveSummary = saveSummary;
