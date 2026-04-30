import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

// Only components listed here can be generated — no improvisation outside this catalog.
export const chatCatalog = defineCatalog(schema, {
  components: {
    Stack: shadcnComponentDefinitions.Stack,
    Heading: shadcnComponentDefinitions.Heading,
    Text: shadcnComponentDefinitions.Text,
    Checkbox: shadcnComponentDefinitions.Checkbox,
    Slider: shadcnComponentDefinitions.Slider,
    Select: shadcnComponentDefinitions.Select,
    ToggleGroup: shadcnComponentDefinitions.ToggleGroup,
    Separator: shadcnComponentDefinitions.Separator,
    Button: shadcnComponentDefinitions.Button,
  },
  actions: {
    launchSearch: {
      params: z.object({
        useCaseName: z.enum(["freelance-client", "find-jobs"]),
        rawQuery: z.string(),
      }),
      description:
        "Launch the search pipeline. Call when you have enough information to determine the use case. 'freelance-client' = company prospecting (finding clients for a freelancer). 'find-jobs' = job offer search. rawQuery = the user's request as they wrote it.",
    },
  },
});
