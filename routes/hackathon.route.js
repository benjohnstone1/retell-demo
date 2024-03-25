const config = require("../config/config");
const router = config.router;

let userContext = {};

// we will need to update the tools into the new format that we have (or just hardcode)
const createTools = (functionContext) => {
  const tools = [];
  for (let i = 0; i < functionContext.length; i++) {
    for (let j = 0; j < functionContext[i].properties.length; j++) {
      for (let k = 0; k < functionContext[i].returnObjProperties.length; k++) {
        var toolsObj = {
          type: "function",
          function: {
            name: functionContext[i].name,
            description: functionContext[i].desc,
            webhookURL: functionContext[i].webhookURL,
          },
          parameters: {
            type: "object",
            properties: {
              [functionContext[i].properties[j].name]: {
                type: functionContext[i].properties[j].type,
                enum: functionContext[i].properties[j].enum,
                description: functionContext[i].properties[j].desc,
              },
            },
            required: [functionContext[i].properties[j].name],
          },
          returns: {
            type: "object",
            properties: {
              [functionContext[i].returnObjProperties[j].name]: {
                type: functionContext[i].returnObjProperties[j].type,
                description: functionContext[i].returnObjProperties[j].desc,
              },
            },
          },
        };
      }
    }
    tools.push(toolsObj);
  }
  console.log(tools[0]);
  return tools;
};

let flexFunction = {
  type: "function",
  function: {
    name: "speak_to_agent",
    description: "Transfers call to an agent",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "What you will say before transferring to an agent",
        },
      },
      required: ["message"],
    },
  },
};

const createToolsRetell = (functionContext) => {
  const tools = [];
  for (let i = 0; i < functionContext.length; i++) {
    for (let j = 0; j < functionContext[i].properties.length; j++) {
      for (let k = 0; k < functionContext[i].returnObjProperties.length; k++) {
        var toolsObj = {
          type: "function",
          function: {
            name: functionContext[i].retell_name,
            description: functionContext[i].desc,
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description:
                    "The message you will say before " +
                    functionContext[i].desc,
                },
                [functionContext[i].properties[j].name]: {
                  type: functionContext[i].properties[j].type,
                  enum: functionContext[i].properties[j].enum,
                  description: functionContext[i].properties[j].desc,
                },
              },
              required: [functionContext[i].properties[j].name, "message"],
            },
          },
        };
      }
    }
    if (toolsObj.function.name === "check_language") {
      // ignore this function for Retell
    } else {
      tools.push(toolsObj);
      tools.push(flexFunction);
    }
  }
  return tools;
};

// Sets user context
router.post("/set-user-context/", async (req, res, next) => {
  try {
    let greeting = req.body.greeting;
    let systemContext = req.body.context;
    let functionContext = req.body.functionContext;

    const tools = createToolsRetell(functionContext);
    console.log("initial greeting is", greeting);
    if (!tools) {
      console.log("No tools sent");
    }

    userContext = {
      systemContext: systemContext,
      greeting: greeting,
      functionContext: tools,
    };
    exports.userContext = userContext;
    return res.status(200).send("Updated virtual agent context");
  } catch (e) {
    console.log(e);
  }
});

exports.router = router;
