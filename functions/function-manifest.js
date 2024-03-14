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
];

// Function to decide when to end call
// {
//   type: "function",
//   function: {
//     name: "end_call",
//     description: "End the call only when user explicitly requests it.",
//     parameters: {
//       type: "object",
//       properties: {
//         message: {
//           type: "string",
//           description:
//             "The message you will say before ending the call with the customer.",
//         },
//       },
//       required: ["message"],
//     },
//   },
// },

// // function to book appointment
// {
//   type: "function",
//   function: {
//     name: "book_appointment",
//     description: "Book an appointment to meet our doctor in office.",
//     parameters: {
//       type: "object",
//       properties: {
//         message: {
//           type: "string",
//           description:
//             "The message you will say while setting up the appointment like 'one moment'",
//         },
//         date: {
//           type: "string",
//           description:
//             "The date of appointment to make in forms of year-month-day.",
//         },
//       },
//       required: ["message"],
//     },
//   },
// },

// const tools = [
//   {
//     type: "function",
//     function: {
//       name: "checkLanguage",
//       description:
//         "Check the language used in the conversation to know how to reply to the user, the user may choose to switch languages during the conversation, only check for language if customer asks to switch language",
//       parameters: {
//         type: "object",
//         properties: {
//           language: {
//             type: "string",
//             enum: ["english", "french", "italian", "spanish", "german"],
//             description:
//               "The types of languages the user could want to converse in",
//           },
//         },
//         required: ["language"],
//       },
//       webhookURL: webhook + "checkLanguage",
//       returns: {
//         type: "object",
//         properties: {
//           locale: {
//             type: "string",
//             description: "The language locale that should be returned",
//           },
//         },
//       },
//     },
//   },
//   {
//     type: "function",
//     function: {
//       name: "checkInventory",
//       description:
//         "Check the inventory of airpods, airpods pro or airpods max.",
//       parameters: {
//         type: "object",
//         properties: {
//           model: {
//             type: "string",
//             enum: ["airpods", "airpods pro", "airpods max"],
//             description:
//               "The model of airpods, either the airpods, airpods pro or airpods max",
//           },
//         },
//         required: ["model"],
//       },
//       webhookURL: webhook + "checkInventory",
//       returns: {
//         type: "object",
//         properties: {
//           stock: {
//             type: "integer",
//             description:
//               "An integer containing how many of the model are in currently in stock.",
//           },
//         },
//       },
//     },
//   },
//   {
//     type: "function",
//     function: {
//       name: "checkPrice",
//       description:
//         "Check the price of given model of airpods, airpods pro or airpods max.",
//       parameters: {
//         type: "object",
//         properties: {
//           model: {
//             type: "string",
//             enum: ["airpods", "airpods pro", "airpods max"],
//             description:
//               "The model of airpods, either the airpods, airpods pro or airpods max",
//           },
//         },
//         required: ["model"],
//       },
//       webhookURL: webhook + "checkPrice",
//       returns: {
//         type: "object",
//         properties: {
//           price: {
//             type: "integer",
//             description: "the price of the model",
//           },
//         },
//       },
//     },
//   },
//   {
//     type: "function",
//     function: {
//       name: "placeOrder",
//       description: "Places an order for a set of airpods.",
//       parameters: {
//         type: "object",
//         properties: {
//           model: {
//             type: "string",
//             enum: ["airpods", "airpods pro"],
//             description: "The model of airpods, either the regular or pro",
//           },
//           quantity: {
//             type: "integer",
//             description: "The number of airpods they want to order",
//           },
//         },
//         webhookURL: webhook + "placeOrder",
//         required: ["type", "quantity"],
//       },
//       webhookURL: webhook + "checkPrice",
//       returns: {
//         type: "object",
//         properties: {
//           price: {
//             type: "integer",
//             description: "The total price of the order including tax",
//           },
//           orderNumber: {
//             type: "integer",
//             description: "The order number associated with the order.",
//           },
//         },
//       },
//     },
//   },
// ];

module.exports = tools;
