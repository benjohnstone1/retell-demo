import OpenAI from "openai";
import { WebSocket } from "ws";
import { RetellRequest, RetellResponse, Utterance } from "./types";
const functionsWebhookHandler = require("../functions/functions-webhooks");
const tools = require("../functions/function-manifest");

let webhook = "https://hackathon-open-ai-2890.twil.io/";

//Step 1: Define the structure to parse openAI function calling result to our data model
export interface FunctionCall {
  id: string;
  funcName: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ChatCompletionsFunctionToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: {};
      required: [String];
    };
    webhookURL: string;
    returns: {};
  };
}

// Define the greeting message of the agent. If you don't want the agent speak first, set to empty string ""
const beginSentence = "Hello?";
// Your agent prompt.
// const agentPrompt =
//   "Task: As a professional therapist, your responsibilities are comprehensive and patient-centered. You establish a positive and trusting rapport with patients, diagnosing and treating mental health disorders. Your role involves creating tailored treatment plans based on individual patient needs and circumstances. Regular meetings with patients are essential for providing counseling and treatment, and for adjusting plans as needed. You conduct ongoing assessments to monitor patient progress, involve and advise family members when appropriate, and refer patients to external specialists or agencies if required. Keeping thorough records of patient interactions and progress is crucial. You also adhere to all safety protocols and maintain strict client confidentiality. Additionally, you contribute to the practice's overall success by completing related tasks as needed.\n\nConversational Style: Communicate concisely and conversationally. Aim for responses in short, clear prose, ideally under 10 words. This succinct approach helps in maintaining clarity and focus during patient interactions.\n\nPersonality: Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the patient. It's important to listen actively and empathize without overly agreeing with the patient, ensuring that your professional opinion guides the therapeutic process.";

const agentPrompt =
  "Task: You are a customer support representative for Nike. You speak english and french. You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don't ask more than 1 question at a time. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all prices to include the currency. Please help them decide between the Vaporfly, Air Max and Pegasus by asking questions like 'Do you prefer shoes that are for racing or for training?'. If they are trying to choose between the vaporfly and pegasus try asking them if they need a high mileage shoe. Once you know which shoe they would like ask them what size they would like to purchase and try to get them to place an order.\n\nConversational Style: Communicate concisely and conversationally. Aim for responses in short, clear prose, ideally under 10 words. This succinct approach helps in maintaining clarity and focus during customer interactions.\n\nPersonality: Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the customer. It's important to listen actively and empathize without overly agreeing with the customer, ensuring that your professional opinion guides the sales process.";

export class FunctionCallingLlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
  }

  // First sentence requested
  BeginMessage(ws: WebSocket) {
    const res: RetellResponse = {
      response_id: 0,
      content: beginSentence,
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  private ConversationToChatRequestMessages(conversation: Utterance[]) {
    let result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    for (let turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    console.log(result);
    return result;
  }

  private PreparePrompt(request: RetellRequest, funcResult?: FunctionCall) {
    let transcript = this.ConversationToChatRequestMessages(request.transcript);
    let requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          // This is the prompt that we add to make the AI speak more like a human
          content:
            '##Objective\nYou are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible\n\n## Style Guardrails\n- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don\'t pack everything you want to say into one utterance.\n- [Do not repeat] Don\'t repeat what\'s in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.\n- [Be conversational] Speak like a human as though you\'re speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.\n- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged. Don\'t be a pushover.\n- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.\n\n## Response Guideline\n- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn\'t catch that", "some noise", "pardon", "you\'re coming through choppy", "static in your speech", "voice is cutting in and out"). Do not ever mention "transcription error", and don\'t repeat yourself.\n- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don\'t repeat yourself in doing this. You should still be creative, human-like, and lively.\n- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.\n\n## Role\n' +
            agentPrompt,
        },
      ];
    for (const message of transcript) {
      requestMessages.push(message);
    }

    // Populate func result to prompt so that GPT can know what to say given the result
    // will only get called on the appointment request otherwise not expecting to call this
    try {
      if (funcResult) {
        requestMessages.push({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: funcResult.id,
              type: "function",
              function: {
                name: funcResult.funcName,
                arguments: JSON.stringify(funcResult.arguments),
              },
            },
          ],
        });
        // add function call result to prompt
        requestMessages.push({
          role: "tool",
          tool_call_id: funcResult.id,
          content: funcResult.result,
        });
      }
    } catch (e) {
      console.log("error with func result", e);
    }

    if (request.interaction_type === "reminder_required") {
      // Change this content if you want a different reminder message
      requestMessages.push({
        role: "user",
        content: "(Now the user has not responded in a while, you would say:)",
      });
    }
    return requestMessages;
  }

  // Step 2: Prepare the function calling definition to the prompt
  private PrepareFunctions(
    tools: any,
  ): ChatCompletionsFunctionToolDefinition[] {
    let functions: ChatCompletionsFunctionToolDefinition[] = tools;
    return functions;
  }

  async DraftResponse(
    request: RetellRequest,
    ws: WebSocket,
    funcResult?: FunctionCall,
  ) {
    if (request.interaction_type === "update_only") {
      // process live transcript update if needed
      return;
    }
    // If there are function call results, add it to prompt here.
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      this.PreparePrompt(request, funcResult);

    let funcCall: FunctionCall;
    let funcArguments = "";

    try {
      let events = await this.client.chat.completions.create({
        // model: "gpt-3.5-turbo-1106",
        model: "gpt-4",
        messages: requestMessages,
        stream: true,
        temperature: 0.3,
        frequency_penalty: 1,
        max_tokens: 200,
        // Step 3: Add the function into your request
        tools: this.PrepareFunctions(tools),
      });

      for await (const event of events) {
        if (event.choices.length >= 1) {
          let delta = event.choices[0]?.delta;
          if (!delta) continue;
          // Step 4: Extract the functions
          if (delta.tool_calls) {
            const toolCall = delta.tool_calls[0];
            // Function calling here.
            if (toolCall.id) {
              if (funcCall) {
                // Another function received, old function complete, can break here.
                // You can also modify this to parse more functions to unlock parallel function calling.
                break;
              } else {
                funcCall = {
                  id: toolCall.id,
                  funcName: toolCall.function.name || "",
                  arguments: {},
                };
              }
            } else {
              // append arguments
              funcArguments += toolCall.function?.arguments || "";
            }
          } else if (delta.content) {
            const res: RetellResponse = {
              response_id: request.response_id,
              content: delta.content,
              content_complete: false,
              end_call: false,
            };
            ws.send(JSON.stringify(res));
          }
        }
      }
    } catch (err) {
      console.error("Error in gpt stream: ", err);
    } finally {
      if (funcCall != null) {
        // Step 5: Call the functions
        funcCall.arguments = JSON.parse(funcArguments);
        console.log("funcCall", funcCall);

        // initial response to function call
        const res: RetellResponse = {
          response_id: request.response_id,
          content: funcCall.arguments.message,
          content_complete: false,
          end_call: false,
        };
        ws.send(JSON.stringify(res));

        let webhook_url = webhook + funcCall.funcName;
        console.log(webhook_url);

        // Make callout to webhook
        const functionWebhook =
          await functionsWebhookHandler.makeWebhookRequest(
            webhook_url,
            "POST",
            funcCall.arguments,
          );

        funcCall.result = functionWebhook;
        // "Respond with the following information " +
        // JSON.stringify(functionWebhook);
        // we need to update funcCall.result into a string
        console.log("func result", funcCall.result);

        this.DraftResponse(request, ws, funcCall);

        // If it's to book appointment, say something and book appointment at the same time, and then say something after booking is done
        // if (funcCall.funcName === "book_appointment") {
        //   funcCall.arguments = JSON.parse(funcArguments);
        //   const res: RetellResponse = {
        //     response_id: request.response_id,
        //     // LLM will return the function name along with the message property we define. In this case, "The message you will say while setting up the appointment like 'one moment'"
        //     content: funcCall.arguments.message,
        //     // If content_complete is false, it means AI will speak later. In our case, agent will say something to confirm the appointment, so we set it to false
        //     content_complete: false,
        //     end_call: false,
        //   };
        //   ws.send(JSON.stringify(res));

        //   // Sleep 2s to mimic the actual appointment booking
        //   // Replace with your actual making appointment functions
        //   await new Promise((r) => setTimeout(r, 2000));
        //   funcCall.result = "Appointment booked successfully";
        //   this.DraftResponse(request, ws, funcCall);
        // }
      } else {
        const res: RetellResponse = {
          response_id: request.response_id,
          content: "",
          content_complete: true,
          end_call: false,
        };
        ws.send(JSON.stringify(res));
      }
    }
  }
}
