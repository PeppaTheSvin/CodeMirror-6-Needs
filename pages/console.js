import { useState, Component } from "react";
import Head from "next/head";
import EditorSettings from "../components/EditorSettings";
import { EDITOR_SETTINGS_DEFAULTS } from "../data/editorSettings";
import { LANGUAGES } from "../data/languages";
import styles from "../styles/Home.module.scss";

import CodeMirror6Instance from "../components/CodeMirror6Instance";

import { EditorView, Decoration } from "@codemirror/view";
import { StateField, StateEffect, Range, RangeSet } from "@codemirror/state";

const consoleLineClasses = {
  clear: "cm-console-clear",
  error: "cm-console-error",
  warn: "cm-console-warn",
  info: "cm-console-info",
};

const consoleEntriesTheme = EditorView.baseTheme({
  [`.${consoleLineClasses.clear}`]: {
    fontStyle: "italic",
    opacity: 0.5,
  },
  [`.${consoleLineClasses.error}`]: {
    background: "hsl(358.462deg 100% 61.7647% / 35%)",
  },
  [`.${consoleLineClasses.warn}`]: {
    background: "hsl(49.3194deg 100% 62.549% / 35%)",
  },
  [`.${consoleLineClasses.info}`]: {
    background: "hsl(206.418deg 52.7559% 50.1961% / 50%)",
  },
});

const addConsoleEntry = StateEffect.define();
const removeConsoleEntry = StateEffect.define();

const consoleEntriesField = StateField.define({
  create() {
    return Decoration.none; //RangeSet.empty;
  },
  update(consoleEntries, tr) {
    consoleEntries = consoleEntries.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(addConsoleEntry)) {
        let { log, from, to } = e.value;
        console.log("adding console decoration", log);

        const toAdd = [
          Decoration.mark({ attributes: { "data-log-id": log.id }, log }).range(
            from,
            to
          ),
        ];
        const type = log.function;
        if (consoleLineClasses[type]) {
          // Loop through lines
          for (let pos = from; pos <= to; ) {
            let line = tr.state.doc.lineAt(pos);
            toAdd.push(
              Decoration.line({ class: consoleLineClasses[type], log }).range(
                line.from
              )
            );
            // Next line
            pos = line.to + 1;
          }
        }
        consoleEntries = consoleEntries.update({
          add: toAdd,
          sort: true,
        });
      } else if (e.is(removeConsoleEntry)) {
        let { log } = e.value;
        consoleEntries = consoleEntries.update({
          filter(from, to, value) {
            return value.spec.log.id !== log.id;
          },
        });
      }
    }
    return consoleEntries;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function addConsoleLog(view, log) {
  const value = log.arguments.join(" ");
  let from = view.state.doc.length;
  let to = from;

  // const type = log.function;
  // if (type === "clear") {
  //   from = 0;
  // }

  let end = from + value.length;
  let effects = [addConsoleEntry.of({ log, from, to: end })];

  // Ensure that the necessary extensions are added.
  if (!view.state.field(consoleEntriesField, false)) {
    effects.push(
      StateEffect.appendConfig.of([consoleEntriesField, consoleEntriesTheme])
    );
  }

  view.dispatch({
    changes: {
      from,
      to,
      insert: value + view.state.lineBreak,
    },
    effects,
  });

  return () => {
    const range = { from: 0, to: 0 };

    const field = view.state.field(consoleEntriesField);
    field.between(0, view.state.doc.length, function (from, to, value) {
      if (value.spec.log.id === log.id) {
        range.from = Math.min(from, range.from);
        range.to = Math.max(to, range.to);
      }
    });

    console.log("removing", log.id, range);

    view.dispatch({
      changes: {
        from: range.from,
        to: range.to,
        insert: "",
      },
      effects: [removeConsoleEntry.of({ log })],
    });

    // const firstLine = view.state.doc.line(1);
    // if (firstLine.text === "") {
    //   console.log(firstLine);

    //   view.dispatch({
    //     changes: {
    //       from: firstLine.from,
    //       to: firstLine.to + 1,
    //       insert: "",
    //     },
    //   });
    // }
  };
}

class ConsoleLog extends Component {
  componentDidMount() {
    if (this.props.view) {
      this.remove = addConsoleLog(this.props.view, this.props.log);
    }
  }

  componentWillUnmount() {
    this.remove();
    // Remove lines. We should get some kind of Range back from the addConsoleLog function that can then be removed.
  }

  render() {
    return (
      <li>
        {this.props.log.id}: {this.props.log.arguments.join(" ")}
      </li>
    );
  }
}

export default function Console() {
  const [editorSettings, setEditorSettings] = useState({
    ...EDITOR_SETTINGS_DEFAULTS,
    lineNumbers: false,
  });

  const [view, setView] = useState();
  const [lastLog, setLastLog] = useState(5);
  const [logs, setLogs] = useState(LOGS.slice(0, 5));

  function addLogs() {
    setLastLog(lastLog + 1);
    setLogs((logs) => {
      return [...logs, LOGS[lastLog]];
    });
  }

  function removeLogs() {
    setLogs((logs) => {
      let logs2 = [...logs];
      logs2.shift();
      return logs2; //.slice(1 - logs.length);
    });
  }

  function onInit(view) {
    setView(view);
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>CodeMirror 6 Shared State</title>
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>CodeMirror 6 Shared State</h1>
        </header>

        <section className={styles.settings}>
          <EditorSettings
            key="settings"
            editorSettings={editorSettings}
            setEditorSettings={setEditorSettings}
          />
        </section>
        <section>
          <button onClick={addLogs}>Add Logs</button>
          <button onClick={removeLogs}>Remove Logs</button>
          <CodeMirror6Instance
            editorSettings={editorSettings}
            language={LANGUAGES.HTML}
            onInit={onInit}
            readOnly
          />
          {view &&
            logs.map((log) => (
              <ConsoleLog key={log.id} view={view} log={log} />
            ))}
        </section>
      </main>
    </div>
  );
}

const LOGS = [
  {
    function: "log",
    arguments: ['"first log"'],
    id: "1655911665381322341",
  },
  {
    arguments: ["Console was cleared"],
    complexity: 1,
    function: "clear",
    id: "1655911665379",
  },
  {
    function: "log",
    arguments: ['"log"'],
    id: "16559116653812341",
  },
  {
    function: "error",
    arguments: ['"error"'],
    id: "1655911665381",
  },
  {
    function: "warn",
    arguments: ['"warn"'],
    id: "1655911665385",
  },
  {
    function: "info",
    arguments: ['"info"'],
    id: "1655911665382",
  },
  {
    function: "log",
    arguments: ["1"],
    id: "165591166538333",
  },
  {
    function: "log",
    arguments: ["2"],
    id: "165591165653833334",
  },
  {
    function: "log",
    arguments: ["3"],
    id: "1655911665383537223",
  },
  {
    function: "log",
    arguments: ["4"],
    id: "165591163653833673",
  },
  {
    function: "log",
    arguments: ["5"],
    id: "165591166538353343",
  },

  {
    function: "log",
    arguments: ["6"],
    id: "1655911665383253634399",
  },

  {
    function: "log",
    arguments: ["7"],
    id: "1655911665383363311341",
  },

  {
    function: "log",
    arguments: ["8"],
    id: "165591166538303634463234",
  },

  {
    function: "log",
    arguments: ["9"],
    id: "1655911665383392634323",
  },
  {
    function: "debug",
    arguments: ['"debug"'],
    id: "1655911665380",
  },
  {
    function: "log",
    arguments: ['"multiple\nlines\nin\none\nlog"'],
    id: "1655911665383",
  },
  {
    function: "table",
    arguments: ['"table"'],
    id: "1655911665384",
  },
  {
    function: "info",
    arguments: ['"[WDS] Hot Module Replacement enabled."'],
    id: "1655911665392",
  },
  {
    function: "info",
    arguments: ['"[WDS] Live Reloading enabled."'],
    id: "1655911665393",
  },
];
