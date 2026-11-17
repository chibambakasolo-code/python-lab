

// ==========================================
// 1. CONNECT JAVASCRIPT TO HTML
// ==========================================

const status = document.getElementById("status");
const saveStatus = document.getElementById("save-status");
const notebook = document.getElementById("notebook");
const addButton = document.getElementById("add-cell");

let pyodide = null;
let nextCellId = 1;
let executionCount = 0;
let isExecuting = false;

const STORAGE_KEY = "python-lab-notebook";

// ==========================================
// 2. PYTHON AUTOCOMPLETE SUGGESTIONS
// ==========================================

const pythonSuggestions = [
    "False", "None", "True",
    "and", "as", "assert", "async", "await",
    "break", "class", "continue", "def", "del",
    "elif", "else", "except", "finally", "for",
    "from", "global", "if", "import", "in",
    "is", "lambda", "nonlocal", "not", "or",
    "pass", "raise", "return", "try", "while",
    "with", "yield",
    "abs", "all", "any", "bin", "bool", "dict",
    "enumerate", "filter", "float", "format",
    "int", "isinstance", "len", "list", "map",
    "max", "min", "open", "print", "range",
    "reversed", "round", "set", "sorted", "str",
    "sum", "tuple", "type", "zip"
];

function pythonHint(editor) {

    const cursor = editor.getCursor();
    const token = editor.getTokenAt(cursor);

    if (token.type === "comment" || token.type === "string") {
        return {
            list: [],
            from: CodeMirror.Pos(cursor.line, cursor.ch),
            to: CodeMirror.Pos(cursor.line, cursor.ch)
        };
    }

    const prefix = token.string.slice(
        0,
        cursor.ch - token.start
    );

    const matches = pythonSuggestions.filter(word =>
        word.startsWith(prefix) && word !== prefix
    );

    return {
        list: matches,
        from: CodeMirror.Pos(cursor.line, token.start),
        to: CodeMirror.Pos(cursor.line, cursor.ch)
    };
}

// ==========================================
// 3. SAVE THE NOTEBOOK
// ==========================================

function saveNotebook() {

    const cells = [];

    document.querySelectorAll(".cell").forEach(cell => {

        const editor = cell.codeEditor;
        const output = cell.querySelector(".output");

        cells.push({
            code: editor.getValue(),
            output: output.textContent,
            executionCount: Number(cell.dataset.executionCount) || 0
        });

    });

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(cells)
        );

        saveStatus.textContent = " | Saved locally";

    } catch (error) {

        saveStatus.textContent = " | Save failed";
        console.error("Saving failed:", error);

    }
}

// ==========================================
// 4. UPDATE EXECUTION NUMBER
// ==========================================

function updateCellNumber(cell) {

    const count = Number(cell.dataset.executionCount) || 0;

    cell.querySelector(".cell-number").textContent =
        count ? `In [${count}]` : "In [ ]";

}

// ==========================================
// 5. CREATE A NOTEBOOK CELL
// ==========================================

function createCell(data = {}) {

    const id = nextCellId++;

    const cell = document.createElement("section");
    cell.className = "cell";
    cell.dataset.cellId = id;
    cell.dataset.executionCount = data.executionCount || 0;

    // Execution number
    const number = document.createElement("div");
    number.className = "cell-number";

    // Main content
    const content = document.createElement("div");
    content.className = "cell-content";

    // Header
    const header = document.createElement("div");
    header.className = "cell-header";

    const title = document.createElement("strong");
    title.textContent = "PYTHON";

    header.appendChild(title);

    // Editor source element
    const textarea = document.createElement("textarea");
    textarea.value = data.code || "";

    // Output
    const output = document.createElement("pre");
    output.className = "output";
    output.textContent = data.output || "";
    output.hidden = !data.output;

    // Assemble cell
    content.append(header, textarea, output);
    cell.append(number, content);
    notebook.appendChild(cell);

    // ======================================
    // 6. CREATE CODEMIRROR EDITOR
    // ======================================

    const editor = CodeMirror.fromTextArea(textarea, {

        mode: "python",

        theme: "default",

        lineNumbers: false,

        lineWrapping: true,

        indentUnit: 4,
        
        electricChars: true,

        tabSize: 4,

        indentWithTabs: false,

        autoCloseBrackets: true,

        matchBrackets: true,

        viewportMargin: Infinity,

        extraKeys: {

            "Ctrl-Enter": runCell,

           "Enter": function(cm) {
    cm.execCommand("newlineAndIndent");

    const cursor = cm.getCursor();
    const previousLine = cm.getLine(cursor.line - 1);
    const currentLine = cm.getLine(cursor.line);

    if (previousLine && previousLine.trim().endsWith(":")) {
        cm.indentLine(cursor.line, "add");
    }

    const closingKeywords = ["else:", "elif ", "except", "finally:"];

    if (
        closingKeywords.some(keyword =>
            currentLine.trim().startsWith(keyword)
        )
    ) {
        cm.indentLine(cursor.line, "subtract");
    }
},

            "Ctrl-Shift-Backspace": deleteCell,

            "Ctrl-Shift-Space": function(cm) {
                cm.showHint({
                    hint: pythonHint,
                    completeSingle: false
                });
            },

            "Tab": "indentMore",

            "Shift-Tab": "indentLess"

        }

    });

editor.on("inputRead", function(cm) {
    const cursor = cm.getCursor();
    const token = cm.getTokenAt(cursor);

    if (
        token.type !== "comment" &&
        token.type !== "string" &&
        token.string.length >= 2
    ) {
        cm.showHint({
            hint: pythonHint,
            completeSingle: false
        });
    }
});

cell.codeEditor = editor;

    cell.codeEditor = editor;

    updateCellNumber(cell);

    // Save whenever code changes
    editor.on("change", () => {
        saveNotebook();
    });

    // ======================================
    // 7. RUN CELL
    // ======================================

    async function runCell() {

        if (!pyodide || isExecuting) return;

        isExecuting = true;

        output.hidden = false;
        output.textContent = "";

        try {

            pyodide.setStdout({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            pyodide.setStderr({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            const result = await pyodide.runPythonAsync(
                editor.getValue()
            );

            if (result !== undefined) {

                output.textContent += String(result);

                if (result && typeof result.destroy === "function") {
                    result.destroy();
                }

            }

            if (!output.textContent) {
                output.textContent = "Execution completed.";
            }

            executionCount++;

            cell.dataset.executionCount = executionCount;

            updateCellNumber(cell);

        } catch (error) {

            output.textContent += error.toString();

        } finally {

            isExecuting = false;

            saveNotebook();

        }
    }

    // ======================================
    // 8. DELETE CELL
    // ======================================

    function deleteCell() {

        if (isExecuting) return;

        if (confirm("Delete this cell?")) {

            editor.toTextArea();

            cell.remove();

            saveNotebook();

        }
    }

    // Make editor available to keyboard actions
    editor.on("keydown", (cm, event) => {

        // Shortcuts are configured in extraKeys.
        // This handler is reserved for future editor controls.

    });

    return cell;
}

// ==========================================
// 9. RESTORE SAVED NOTEBOOK
// ==========================================

function restoreNotebook() {

    try {

        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {

            const cells = JSON.parse(savedData);

            if (Array.isArray(cells) && cells.length > 0) {

                cells.forEach(data => {

                    createCell(data);

                    executionCount = Math.max(
                        executionCount,
                        Number(data.executionCount) || 0
                    );

                });

                return;
            }
        }

    } catch (error) {

        console.error("Could not restore notebook:", error);

    }

    createCell({
        code: `x = 10
y = 20

print(x + y)`
    });
}

// ==========================================
// 10. ADD NEW CELL
// ==========================================

addButton.addEventListener("click", () => {

    const cell = createCell();

    cell.codeEditor.focus();

    saveNotebook();

});

// ==========================================
// 11. INITIALIZE PYTHON
// ==========================================

async function initializePython() {

    try {

        status.textContent = "Loading Python...";

        pyodide = await loadPyodide();

        status.textContent = "Python is ready!";

    } catch (error) {

        status.textContent = "Python failed to load.";

        console.error(error);

    }
}

// ==========================================
// 12. START APPLICATION
// ==========================================

restoreNotebook();

initializePython();
