const config = require("../config/config");
const segmentKey = config.segmentKey;
const mapSid = config.callSummaryMapSid;
const client = config.client;
const twilioSyncServiceSid = config.transcriptServiceSid;
const axios = require("axios");
const { Analytics } = require("@segment/analytics-node");
const analytics = new Analytics({ writeKey: segmentKey });

const makeWebhookRequest = async (
  webhook_url,
  method,
  functionArgs,
  //   callSid,
) => {
  try {
    if (method === "GET") {
      let response = await axios.get(webhook_url, {
        functionArgs,
        callSid: callSid,
      });
      return response.data;
    } else if (method === "POST") {
      let response = await axios.post(webhook_url, {
        functionArgs,
      });
      return response.data;
    }
  } catch (e) {
    console.log(e);
  }
};

const makeSegmentTrack = async (
  functionArgs,
  functionName,
  callerId,
  source,
) => {
  // Set properties for segment function
  let properties = { source: source };
  let numParams = Object.keys(functionArgs).length;
  for (let i = 0; i < numParams; i++) {
    let key = Object.keys(functionArgs)[i];
    let value = functionArgs[key];
    properties[key] = value;
  }
  // Send track event to Segment
  analytics.track({
    userId: callerId,
    event: functionName,
    properties: properties,
  });
  console.log("Tracked in Segment");
};

const makeSegmentIdentify = async (callerId) => {
  //Trigger Segment identity
  analytics.identify({
    userId: callerId,
    traits: {
      phone: callerId,
    },
  });
  console.log("Identified in Segment");
};

const summarizeCall = async (callSid, openai) => {
  console.log("Called summarize call");
  const listUniqueName = "Transcript-" + callSid;
  console.log("Using Sync service with SID", twilioSyncServiceSid);
  console.log("List Unique ID", listUniqueName);

  try {
    const getSyncList = await client.sync.v1
      .services(twilioSyncServiceSid)
      .syncLists(listUniqueName)
      .syncListItems.list({ limit: 50 });

    let transcript = "";

    getSyncList.forEach((item, index) => {
      transcript += `${item.data.speaker}: ${item.data.transcript}\n`;
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
    saveSummary(summary, callSid);
  } catch (e) {
    console.log("Oh shoot. Something went really wrong, check logs", e);
  }
};

const saveSummary = async (callSummary, callSid) => {
  console.log("Called save summary for", callSummary);
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
      console.log("map created", map.key, map.mapSid);
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
    })
    .catch((e) => console.log(e));
  console.log("summary is ", callSummary);
  console.log("Call Summary added to map with key: ", updateMap.data);
};

exports.makeWebhookRequest = makeWebhookRequest;
exports.makeSegmentTrack = makeSegmentTrack;
exports.makeSegmentIdentify = makeSegmentIdentify;
exports.summarizeCall = summarizeCall;
exports.saveSummary = saveSummary;
