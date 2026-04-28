import pino from "pino";
import { env } from "@/env";

const logger = pino(
  env.NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      },
);

export default logger;
