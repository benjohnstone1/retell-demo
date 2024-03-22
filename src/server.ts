import express, { Request, Response } from "express";
import { RawData, WebSocket } from "ws";
import { createServer, Server as HTTPServer } from "http";
import cors from "cors";
import expressWs from "express-ws";
import { TwilioClient } from "./twilio_api";
import { RetellClient } from "retell-sdk";
import {
  AudioWebsocketProtocol,
  AudioEncoding,
} from "retell-sdk/models/components";
import { FunctionCallingLlmClient } from "./llm_openai_func_call";
import { RetellRequest, Event } from "./types";

// Express Route
const hackathonRoute = require("../routes/hackathon.route");
const initialTools = require("../functions/function-manifest");
const twilio = require("./twilio_api");

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private llmClient: FunctionCallingLlmClient;
  private retellClient: RetellClient;
  private twilioClient: TwilioClient;

  public clients: any[];
  public events: any[];

  constructor() {
    this.app = expressWs(express()).app;
    this.httpServer = createServer(this.app);
    this.app.use(express.json());
    this.app.use(cors(corsOptions));
    this.app.use(express.urlencoded({ extended: true }));

    //Routes
    this.app.use("/hackathon", hackathonRoute.router);

    this.handleRetellLlmWebSocket();
    // this.handleRegisterCallAPI();

    this.llmClient = new FunctionCallingLlmClient();

    this.retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY,
    });

    this.twilioClient = new TwilioClient();
    this.twilioClient.ListenTwilioVoiceWebhook(this.app);

    this.clients = new Array();
    this.events = new Array();
  }

  // Create SSE for Virtual Agent logs
  eventsHandler(request: any, response: any, next: any) {
    const headers = {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    };
    response.writeHead(200, headers);

    const clientId = Date.now();

    const newClient = {
      id: clientId,
      response,
    };

    this.clients.push(newClient);

    request.on("close", () => {
      // console.log(`${clientId} Connection closed`);
      this.clients = this.clients.filter((client) => client.id !== clientId);
    });
  }

  sendEventsToAllClients(newEvent: Event) {
    this.clients.forEach((client) =>
      client.response.write(`data: ${JSON.stringify(newEvent)}\n\n`),
    );
  }

  getEvents() {
    this.app.get("/events", (req, res, next) =>
      this.eventsHandler(req, res, next),
    );
  }

  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }

  handleRetellLlmWebSocket() {
    this.app.ws(
      "/llm-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        console.log("Handle llm ws for: ", callId);

        const event: Event = {
          log: "Incoming call " + twilio.callSid,
          color: "orange",
        };
        this.sendEventsToAllClients(event);

        // Event emitter
        this.llmClient.on("event", async (event: any) => {
          if (!event.log) {
            return;
          }
          this.sendEventsToAllClients(event);
        });

        // Pass in context from front-end service
        var initialGreeting = hackathonRoute.userContext?.greeting ?? "Hello";

        var systemContext =
          hackathonRoute.userContext?.systemContext ??
          "You should speak in the language given in agent settings. You are a customer support representative for Nike. You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don't ask more than 1 question at a time. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all prices to include the currency. Please help them decide between the Vaporfly, Air Max and Pegasus by asking questions like 'Do you prefer shoes that are for racing or for training?'. If they are trying to choose between the vaporfly and pegasus try asking them if they need a high mileage shoe. Once you know which shoe they would like ask them what size they would like to purchase and try to get them to place an order.";

        var functionContext =
          hackathonRoute.userContext?.functionContext ?? initialTools;

        // Start sending the begin message to signal the client is ready.
        this.llmClient.BeginMessage(ws, initialGreeting, twilio.callSid);

        // Update to german
        // works but need to call again - what does that do?
        // unsure yet if working let's test chedkclanuage
        // this.twilioClient.UpdateAgentLanguage(
        //   twilio.agentId,
        //   "de-DE",
        //   twilio.callSid,
        // );

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });
        ws.on("close", (err) => {
          console.error("Closing llm ws for: ", callId);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
          if (isBinary) {
            console.error("Got binary message instead of text in websocket.");
            ws.close(1002, "Cannot find corresponding Retell LLM.");
          }
          try {
            const request: RetellRequest = JSON.parse(data.toString());
            this.llmClient.DraftResponse(
              request,
              ws,
              systemContext,
              functionContext,
              twilio.callerId,
              twilio.callSid,
            );
          } catch (err) {
            console.error("Error in parsing LLM websocket message: ", err);
            ws.close(1002, "Cannot parse incoming message.");
          }
        });
      },
    );
  }
}
