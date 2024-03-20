const axios = require("axios");
const { Analytics } = require("@segment/analytics-node");
const analytics = new Analytics({ writeKey: process.env.SEGMENT_API_KEY });

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

exports.makeWebhookRequest = makeWebhookRequest;
exports.makeSegmentTrack = makeSegmentTrack;
exports.makeSegmentIdentify = makeSegmentIdentify;
