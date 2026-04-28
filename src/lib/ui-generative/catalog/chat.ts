import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

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
  },
  actions: {},
});
