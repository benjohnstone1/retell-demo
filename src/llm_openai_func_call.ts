import OpenAI from "openai";
const EventEmitter = require("events");
import { WebSocket } from "ws";
import { RetellRequest, RetellResponse, Utterance } from "./types";
import { TwilioClient } from "./twilio_api";

const functionsWebhookHandler = require("../functions/functions-webhooks");
const syncService = require("../services/sync-service");

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

export class FunctionCallingLlmClient extends EventEmitter {
  private client: OpenAI;
  private twilioClient: TwilioClient;
  private intCount: number;

  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });

    this.twilioClient = new TwilioClient();
    // interaction count
    this.intCount = 0;
  }

  // First sentence requested
  BeginMessage(ws: WebSocket, initialGreeting: string, callSid: string) {
    const res: RetellResponse = {
      response_id: 0,
      content: initialGreeting,
      content_complete: true,
      end_call: false,
    };
    syncService.writeTranscriptToTwilio(
      "Inbound call initiated",
      "customer",
      callSid,
    ); // only called once initially to create sync list
    ws.send(JSON.stringify(res));
  }

  async emitEvent(log: string, color: string) {
    const event = {
      log: log,
      color: color,
    };
    await this.emit("event", event);
  }

  private ConversationToChatRequestMessages(
    conversation: Utterance[],
    callSid: string,
  ) {
    let result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    for (let turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    // We need to calls this twice for user and then the agent
    syncService.writeTranscriptToTwilio(
      result[this.intCount]?.content,
      result[this.intCount]?.role,
      callSid,
    );
    syncService.writeTranscriptToTwilio(
      result[this.intCount + 1]?.content,
      result[this.intCount + 1]?.role,
      callSid,
    );

    // send events
    if (!result[this.intCount]?.role || !result[this.intCount]?.content) {
      // do nothing
    } else {
      let message1 = `${result[this.intCount]?.role}: ${
        result[this.intCount]?.content
      }`;
      this.emitEvent(message1, "purple");
    }

    if (
      !result[this.intCount + 1]?.role ||
      !result[this.intCount + 1]?.content
    ) {
      // do nothing
    } else {
      let message2 = `${result[this.intCount + 1]?.role}: ${
        result[this.intCount + 1]?.content
      }`;
      this.emitEvent(message2, "black");
    }

    this.intCount += 2;
    return result;
  }

  private PreparePrompt(
    request: RetellRequest,
    agentContext: string,
    callSid: string,
    funcResult?: FunctionCall,
  ) {
    let transcript = this.ConversationToChatRequestMessages(
      request.transcript,
      callSid,
    );
    let requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content:
            '##Objective\nYou are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible\n\n## Style Guardrails\n- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don\'t pack everything you want to say into one utterance.\n- [Do not repeat] Don\'t repeat what\'s in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.\n- [Be conversational] Speak like a human as though you\'re speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.\n- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged. Don\'t be a pushover.\n- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.\n\n## Response Guideline\n- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn\'t catch that", "some noise", "pardon", "you\'re coming through choppy", "static in your speech", "voice is cutting in and out"). Do not ever mention "transcription error", and don\'t repeat yourself.\n- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don\'t repeat yourself in doing this. You should still be creative, human-like, and lively.\n- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.\n\n## Role\n Task:' +
            agentContext,
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
    agentContext: string,
    functionContext: any,
    callerId: string,
    callSid: string,
    funcResult?: FunctionCall,
  ) {
    if (request.interaction_type === "update_only") {
      // process live transcript update if needed
      return;
    }
    // If there are function call results, add it to prompt here.
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      this.PreparePrompt(request, agentContext, callSid, funcResult);

    let funcCall: FunctionCall;
    let funcArguments = "";

    try {
      let events = await this.client.chat.completions.create({
        // model: "gpt-3.5-turbo-1106", //should be faster
        model: "gpt-4-turbo-preview",
        // model: "gpt-4",
        messages: requestMessages,
        stream: true,
        temperature: 0.3,
        frequency_penalty: 1,
        max_tokens: 200,
        // Step 3: Add the function into your request
        tools: this.PrepareFunctions(functionContext),
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
    } catch (e: any) {
      console.log(
        "Error in gpt stream: ",
        e.status,
        e.error?.message,
        e.error?.type,
      );
    } finally {
      if (funcCall != null) {
        // Step 5: Call the functions
        funcCall.arguments = JSON.parse(funcArguments);
        funcCall.arguments.callSid = callSid;
        console.log("funcCall", funcCall);

        // Write transcript from funcCall - do same for funcResult
        syncService.writeTranscriptToTwilio(
          funcCall.arguments?.message,
          "agent",
          callSid,
        );

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

        // Send event
        let message = `Called function: ${funcCall.funcName} -> Tracked in Segment`;
        this.emitEvent(message, "red");

        // Make callout to webhook
        const functionWebhook =
          await functionsWebhookHandler.makeWebhookRequest(
            webhook_url,
            "POST",
            funcCall.arguments,
          );

        // Make update to Segment
        const segmentTrack = await functionsWebhookHandler.makeSegmentTrack(
          funcCall.arguments,
          funcCall.funcName,
          callerId,
          "Voice AI IVR",
        );

        funcCall.result = functionWebhook;
        console.log("func result", funcCall.result);

        // Send events
        let message1 = `Function result: ${funcCall.result}`;
        this.emitEvent(message1, "green");

        // Check Language
        if (funcCall.funcName === "check_language") {
          // will need to pass in agent Id
          // get language from result
          console.log(funcCall.result);
          this.twilioClient.UpdateAgentLanguage(
            "a5d1c7c8d3171331e07f0ac89c7ef859",
            funcCall.result,
            callSid,
          );
        }

        // Send to flex
        if (funcCall.funcName === "speak_to_agent") {
          const summary = await functionsWebhookHandler.summarizeCall(
            callSid,
            this.client,
          );
          setTimeout(() => {}, 5000); // Gives time for virtual agent to respond
          this.twilioClient.SendToFlex(
            callSid,
            "WW2e4131c9a391b7f8bfdcdbe9eaff6856",
          );
        }

        this.DraftResponse(
          request,
          ws,
          agentContext,
          functionContext,
          callerId,
          callSid,
          funcCall,
        );
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
