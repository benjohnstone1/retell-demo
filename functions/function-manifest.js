// create metadata for all the available functions to pass to completions API
// https://platform.openai.com/docs/guides/function-calling

let tools = [
  {
    type: "function",
    function: {
      name: "check_price",
      description: "Check the price of a specific model of shoe",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The message you will say before checking the price of the model of shoe",
          },
          model: {
            type: "string",
            enum: ["vaporfly", "air max", "pegasus"],
            description:
              "The shoe model, either 'vaporfly', 'air max' or 'pegasus'",
          },
        },
        required: ["message", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_inventory",
      description:
        "Check how many items are in stock for a specific model of shoe",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The message you will say while checking how many shoes are in stock for a particualr model of shoe",
          },
          model: {
            type: "string",
            enum: ["vaporfly", "air max", "pegasus"],
            description:
              "The shoe model, either 'vaporfly', 'air max' or 'pegasus'",
          },
        },
        required: ["message", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description: "Place an order for a certain number of shoes",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The message you will say before placing an order for shoes, you need to know how many pairs and what model of shoe the customer wants",
          },
          model: {
            type: "string",
            enum: ["vaporfly", "air max", "pegasus"],
            description:
              "The shoe model, either 'vaporfly', 'air max' or 'pegasus'",
          },
          quantity: {
            type: "integer",
            description: "The number of shoes they want to order",
          },
        },
        required: ["message", "model", "quantity"],
      },
    },
  },
  {
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
  },
  {
    type: "function",
    function: {
      name: "check_language",
      description: "what to do if person asks to speak another language",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "what you will say when switching language, make sure to respond in the new language requested",
          },
          locale: {
            type: "string",
            descriptoin: "language that user is requesting to speak in",
          },
        },
        required: ["message"],
      },
    },
  },
];

module.exports = tools;
