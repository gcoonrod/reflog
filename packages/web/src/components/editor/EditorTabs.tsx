import { Tabs } from "@mantine/core";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";

interface EditorTabsProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function EditorTabs({ value, onChange, autoFocus }: EditorTabsProps) {
  return (
    <Tabs defaultValue="write">
      <Tabs.List>
        <Tabs.Tab value="write">Write</Tabs.Tab>
        <Tabs.Tab value="preview">Preview</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="write" pt="sm">
        <MarkdownEditor
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
        />
      </Tabs.Panel>

      <Tabs.Panel value="preview" pt="sm">
        <MarkdownPreview content={value} />
      </Tabs.Panel>
    </Tabs>
  );
}
