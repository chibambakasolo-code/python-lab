

const status = document.getElementById("status");
const saveStatus = document.getElementById("save-status");
const notebook = document.getElementById("notebook");
const addButton = document.getElementById("add-cell");

let pyodide = null;
let nextCellId = 1;
let executionCount = 0;
let isExecuting = false;

const STORAGE_KEY = "python-lab-notebook";

// SAVE NOTEBOOK
function saveNotebook() {
    const cells = [];

    document.querySelectorAll(".cell").forEach(cell => {
        cells.push({
            code: cell.querySelector("textarea").value,
            output: cell.querySelector(".output").textContent,
            executionCount: Number(cell.dataset.executionCount) || 0
        });
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
        saveStatus.textContent = " | Saved locally";
    } catch (error) {
        saveStatus.textContent = " | Save failed";
        console.error(error);
    }
}

// AUTOMATICALLY RESIZE EDITOR
function resizeEditor(editor) {
    editor.style.height = "auto";
    editor.style.height = Math.max(65, editor.scrollHeight) + "px";
}

// UPDATE EXECUTION NUMBER
function updateCellNumber(cell) {
    const count = Number(cell.dataset.executionCount) || 0;
    cell.querySelector(".cell-number").textContent =
        count ? `In [${count}]` : "In [ ]";
}

// CREATE CELL
function createCell(data = {}) {

    const id = nextCellId++;

    const cell = document.createElement("section");
    cell.className = "cell";
    cell.dataset.cellId = id;
    cell.dataset.executionCount = data.executionCount || 0;

    const number = document.createElement("div");
    number.className = "cell-number";

    const content = document.createElement("div");
    content.className = "cell-content";

    const header = document.createElement("div");
    header.className = "cell-header";

    const title = document.createElement("strong");
    title.textContent = "PYTHON";

    header.append(title);

    const editor = document.createElement("textarea");
    editor.placeholder = "Write Python code here...";
    editor.spellcheck = false;
    editor.value = data.code || "";

    const output = document.createElement("pre");
    output.className = "output";
    output.textContent = data.output || "";
    output.hidden = !data.output;

    content.append(header, editor, output);
    cell.append(number, content);

    notebook.appendChild(cell);

    updateCellNumber(cell);
    resizeEditor(editor);

    // RUN CELL
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

            const result = await pyodide.runPythonAsync(editor.value);

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

    // SAVE AND RESIZE AS USER TYPES
    editor.addEventListener("input", () => {
        resizeEditor(editor);
        saveNotebook();
    });

    // KEYBOARD SHORTCUTS
    editor.addEventListener("keydown", event => {

        // Ctrl + Enter: Run cell
        if (event.ctrlKey && event.key === "Enter") {
            event.preventDefault();
            runCell();
        }

        // Ctrl + Shift + Backspace: Delete cell
        if (
            event.ctrlKey &&
            event.shiftKey &&
            event.key === "Backspace"
        ) {
            event.preventDefault();

            if (confirm("Delete this cell?")) {
                cell.remove();
                saveNotebook();
            }
        }

    });

    return cell;
}

// RESTORE NOTEBOOK
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

// ADD CELL
addButton.addEventListener("click", () => {

    const cell = createCell();

    cell.querySelector("textarea").focus();

    saveNotebook();

});

// INITIALIZE PYTHON
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

// START APPLICATION
restoreNotebook();
initializePython();
