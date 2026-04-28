"use client";

import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import type { Spec, StateStore } from "@json-render/core";
import { chatCatalog } from "@/lib/ui-generative/catalog/chat";

const { registry } = defineRegistry(chatCatalog, {
  components: {
    Stack: shadcnComponents.Stack,
    Heading: shadcnComponents.Heading,
    Text: shadcnComponents.Text,
    Checkbox: shadcnComponents.Checkbox,
    Slider: shadcnComponents.Slider,
    Select: shadcnComponents.Select,
    ToggleGroup: shadcnComponents.ToggleGroup,
    Separator: shadcnComponents.Separator,
  },
});

type JsonRenderWrapperProps = {
  spec: Spec;
  loading?: boolean;
  store?: StateStore;
};

export function JsonRenderWrapper({
  spec,
  loading,
  store,
}: JsonRenderWrapperProps) {
  return (
    <JSONUIProvider registry={registry} store={store}>
      <Renderer spec={spec} registry={registry} loading={loading} />
    </JSONUIProvider>
  );
}
