"use client";

import type { ChatStatus } from "ai";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

type ChatInputProps = {
  onSubmit: ({ text }: { text: string }) => void;
  status?: ChatStatus;
  onStop?: () => void;
  placeholder?: string;
};

export function ChatInput({
  onSubmit,
  status,
  onStop,
  placeholder,
}: ChatInputProps) {
  const handleSubmit = ({ text }: PromptInputMessage) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({ text: trimmed });
  };

  return (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        placeholder={placeholder ?? "Décrivez votre recherche…"}
      />
      <PromptInputFooter>
        <span />
        <PromptInputSubmit status={status} onStop={onStop} />
      </PromptInputFooter>
    </PromptInput>
  );
}
