import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

// Components the AI may use when generating the results display UI.
// Nothing outside this catalog can be generated.
export const resultsCatalog = defineCatalog(schema, {
  components: {
    Stack: shadcnComponentDefinitions.Stack,
    Card: shadcnComponentDefinitions.Card,
    Heading: shadcnComponentDefinitions.Heading,
    Text: shadcnComponentDefinitions.Text,
    Badge: shadcnComponentDefinitions.Badge,
    Progress: shadcnComponentDefinitions.Progress,
    Separator: shadcnComponentDefinitions.Separator,
    Avatar: shadcnComponentDefinitions.Avatar,
  },
  actions: {},
});
