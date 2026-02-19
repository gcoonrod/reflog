import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  autoFocus,
}: MarkdownEditorProps) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        keydown(event) {
          // Let app-level shortcuts (Cmd+K, Cmd+N, Cmd+Enter) bubble through
          const mod = event.metaKey || event.ctrlKey;
          if (mod && ["k", "n"].includes(event.key)) {
            return false;
          }
          if (mod && event.key === "Enter") {
            return false;
          }
          return undefined;
        },
      }),
    ],
    [],
  );

  return (
    <CodeMirror
      value={value}
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      autoFocus={autoFocus}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
      style={{ minHeight: "300px" }}
    />
  );
}
