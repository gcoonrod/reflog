import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { spotlight } from "@mantine/spotlight";

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
      // Override CodeMirror's default Ctrl-K (deleteToLineEnd) and Ctrl-N
      // with app-level shortcuts. Prec.highest ensures these fire before
      // the default keymap.
      //
      // We bind both Mod-k (Cmd on Mac, Ctrl on Win/Linux) and the
      // explicit Ctrl-k variant so the shortcut works regardless of how
      // the platform is detected (CodeMirror uses navigator.platform
      // while some environments report a different userAgent).
      Prec.highest(
        keymap.of([
          {
            key: "Mod-k",
            run: () => {
              setTimeout(() => {
                spotlight.open();
              }, 0);
              return true;
            },
          },
          {
            key: "Ctrl-k",
            run: () => {
              setTimeout(() => {
                spotlight.open();
              }, 0);
              return true;
            },
          },
          {
            key: "Mod-n",
            run: () => false,
          },
          {
            key: "Ctrl-n",
            run: () => false,
          },
          {
            key: "Mod-Enter",
            run: () => false,
          },
          {
            key: "Ctrl-Enter",
            run: () => false,
          },
        ]),
      ),
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
