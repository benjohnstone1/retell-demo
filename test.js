const config = require("./config/config.js");
const accountSid = config.accountSid;
const authToken = config.authToken;
const client = config.client;
const twilioSyncServiceSid = config.transcriptServiceSid;
const mapSid = config.callSummaryMapSid;

const axios = require("axios");

let mapKey = "Summary-CAb796e7787b36cf40cb5f9eef8b40b943";

async function fetchSummary() {
  const map = await client.sync.v1
    .services(twilioSyncServiceSid)
    .syncMaps(mapSid)
    .syncMapItems(mapKey)
    .fetch();

  console.log("Map", map.data.summary);
}
// fetchSummary();

let summary =
  "The customer initiates a call and inquires about the price of Nike Pegasus shoes. The agent, after a brief confusion between Pegasus and Vaporfly models, attempts to check the inventory and price for the correct shoes. Finally, the agent prepares to connect the customer with another agent who can assist further with their query.";

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
// saveSummary(
//   summary,
//   "CAb796e7787b36cf40cb5f9eef8b40b943",
//   twilioSyncServiceSid,
//   mapSid,
//   client,
// );

// axios
//   .post("https://ben-johnstone.ngrok.io/createEvent", {
//     log: "Fred",
//     color: "black",
//   })
//   .then(function (response) {
//     console.log(response);
//   })
//   .catch((e) => console.log(e));

// console.log(axios.get("https://ben-johnstone.ngrok.io/event"));
