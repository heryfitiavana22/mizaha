"use client";

import {
  ActionProvider,
  JSONUIProvider,
  Renderer,
  defineRegistry,
} from "@json-render/react";
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
    Button: shadcnComponents.Button,
  },
  actions: {
    launchSearch: async () => {
      // Real handler provided via ActionProvider from the page
    },
  },
});

type LaunchSearchParams = { useCaseName: string; rawQuery: string };

type JsonRenderWrapperProps = {
  spec: Spec;
  loading?: boolean;
  store?: StateStore;
  onLaunchSearch?: (params: LaunchSearchParams) => void;
};

export function JsonRenderWrapper({
  spec,
  loading,
  store,
  onLaunchSearch,
}: JsonRenderWrapperProps) {
  return (
    <JSONUIProvider registry={registry} store={store}>
      <ActionProvider
        handlers={
          onLaunchSearch
            ? {
                launchSearch: (params) =>
                  onLaunchSearch(params as LaunchSearchParams),
              }
            : {}
        }
      >
        <Renderer spec={spec} registry={registry} loading={loading} />
      </ActionProvider>
    </JSONUIProvider>
  );
}
