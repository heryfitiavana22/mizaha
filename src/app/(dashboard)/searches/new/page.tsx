"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createStateStore } from "@json-render/core";
import { flattenSnapshot } from "@/lib/utils/flatten-snapshot";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { CriteriaDisplay } from "@/components/chat/criteria-display";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

const USE_CASE_NAME = "freelance";

export default function NewSearchPage() {
  const router = useRouter();
  const [rawQuery, setRawQuery] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const stateStore = useMemo(() => createStateStore(), []);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  const handleSend = ({ text }: { text: string }) => {
    if (!rawQuery) setRawQuery(text);

    const criteriaLines = flattenSnapshot(stateStore.getSnapshot());
    const fullText =
      criteriaLines.length > 0
        ? `${text}\n\n${criteriaLines.join("\n")}`
        : text;

    sendMessage({ text: fullText });
  };

  const handleLaunch = async () => {
    if (!rawQuery) return;
    setIsLaunching(true);
    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawQuery,
          useCaseName: USE_CASE_NAME,
          uiCriteria: stateStore.getSnapshot(),
        }),
      });
      if (!response.ok) throw new Error("Pipeline failed to start");
      const { searchId } = (await response.json()) as { searchId: string };
      router.push(`/searches/${searchId}`);
    } catch {
      setIsLaunching(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Nouvelle recherche</h1>
        <p className="text-sm text-muted-foreground">
          Décrivez les entreprises que vous cherchez. L&apos;IA vous posera des
          questions pour affiner vos critères.
        </p>
      </div>

      {rawQuery && <CriteriaDisplay rawQuery={rawQuery} />}

      {hasMessages && (
        <Conversation className="h-100 rounded-md border">
          <ConversationContent>
            {messages.map((message, i) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming && i === messages.length - 1}
                stateStore={stateStore}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <ChatInput onSubmit={handleSend} status={status} onStop={stop} />

      {hasMessages && !isStreaming && (
        <div className="flex justify-end">
          <Button
            onClick={() => void handleLaunch()}
            disabled={isLaunching || !rawQuery}
          >
            {isLaunching ? "Lancement en cours…" : "Lancer la recherche →"}
          </Button>
        </div>
      )}
    </div>
  );
}
