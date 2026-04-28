"use client";

import { useJsonRenderMessage } from "@json-render/react";
import type { UIMessage } from "ai";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { JsonRenderWrapper } from "./json-render-wrapper";

type ChatMessageProps = {
  message: UIMessage;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const { spec, text, hasSpec } = useJsonRenderMessage(
    message.parts as Parameters<typeof useJsonRenderMessage>[0],
  );

  return (
    <Message from={message.role}>
      <MessageContent>
        {text && <MessageResponse>{text}</MessageResponse>}
        {hasSpec && spec && <JsonRenderWrapper spec={spec} />}
      </MessageContent>
    </Message>
  );
}
