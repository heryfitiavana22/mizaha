"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createStateStore } from "@json-render/core";
import { flattenSnapshot } from "@/lib/utils/flatten-snapshot";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

export default function NewSearchPage() {
  const router = useRouter();
  const [isLaunching, setIsLaunching] = useState(false);
  const stateStore = useMemo(() => createStateStore(), []);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSend = ({ text }: { text: string }) => {
    const criteriaLines = flattenSnapshot(stateStore.getSnapshot());
    const fullText =
      criteriaLines.length > 0
        ? `${text}\n\n${criteriaLines.join("\n")}`
        : text;

    sendMessage({ text: fullText });
  };

  const handleLaunch = useCallback(
    async (params: { useCaseName: string; rawQuery: string }) => {
      if (!params.rawQuery || !params.useCaseName) return;
      setIsLaunching(true);
      try {
        const response = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawQuery: params.rawQuery,
            useCaseName: params.useCaseName,
            uiCriteria: stateStore.getSnapshot(),
          }),
        });
        if (!response.ok) throw new Error("Pipeline failed to start");
        const { searchId } = (await response.json()) as { searchId: string };
        router.push(`/searches/${searchId}`);
      } catch {
        setIsLaunching(false);
      }
    },
    [router, stateStore],
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Nouvelle recherche</h1>
        <p className="text-sm text-muted-foreground">
          Décrivez ce que vous cherchez — entreprises à prospecter, missions
          freelance, offres d&apos;emploi. L&apos;IA affine les critères et
          lance la recherche quand tout est prêt.
        </p>
      </div>

      {messages.length > 0 && (
        <Conversation className="h-100 rounded-md border">
          <ConversationContent>
            {messages.map((message, i) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming && i === messages.length - 1}
                stateStore={stateStore}
                onLaunchSearch={handleLaunch}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <ChatInput onSubmit={handleSend} status={status} onStop={stop} />

      {isLaunching && (
        <p className="text-sm text-muted-foreground text-center">
          Lancement en cours…
        </p>
      )}
    </div>
  );
}
