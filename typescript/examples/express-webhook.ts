import express, { type Request, type Response } from "express";

import { parseWebhookEvent } from "../src/index";
import { appLogger } from "./app-logger";

const app = express();

app.post(
  "/webhooks/mukhtabir",
  express.raw({ type: "*/*" }),
  async (req: Request, res: Response) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) {
          continue;
        }
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }

      const webhook = await parseWebhookEvent({
        body: req.body,
        headers,
        secret: process.env.MUKHTABIR_WEBHOOK_SECRET ?? "",
        verifySignature: true,
        toleranceSeconds: 300,
      });

      appLogger.info("Mukhtabir webhook received", {
        deliveryId: webhook.headers.deliveryId,
        event: webhook.event.event,
      });
      res.sendStatus(200);
    } catch {
      res.status(401).send("Invalid signature");
    }
  },
);
