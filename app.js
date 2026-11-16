
// ==========================================
// 1. CONNECT JAVASCRIPT TO THE HTML
// ==========================================

const status = document.getElementById("status");
const saveStatus = document.getElementById("save-status");
const notebook = document.getElementById("notebook");
const addButton = document.getElementById("add-cell");

// ==========================================
// 2. VARIABLES USED BY OUR APPLICATION
// ==========================================

let pyodide = null;
let nextCellId = 1;
let executionCount = 0;
let isExecuting = false;

const STORAGE_KEY = "python-lab-notebook";

// ==========================================
// 3. SAVE THE NOTEBOOK
// ==========================================

function saveNotebook() {
    const cells = [];

    document.querySelectorAll(".cell").forEach(cell => {
        const editor = cell.querySelector("textarea");
        const output = cell.querySelector(".output");

        cells.push({
            code: editor.value,
            output: output.textContent,
            executionCount: Number(cell.dataset.executionCount) || 0
        });
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
        saveStatus.textContent = " | Saved locally";
    } catch (error) {
        saveStatus.textContent = " | Save failed";
        console.error("Notebook saving failed:", error);
    }
}

// ==========================================
// 4. UPDATE CELL NUMBERS
// ==========================================

function updateCellNumber(cell) {
    const number = cell.querySelector(".cell-number");
    const count = Number(cell.dataset.executionCount) || 0;

    number.textContent = count ? `In [${count}]` : "In [ ]";
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

    // Left-hand execution number
    const number = document.createElement("div");
    number.className = "cell-number";

    // Main cell content
    const content = document.createElement("div");
    content.className = "cell-content";

    // Cell toolbar
    const header = document.createElement("div");
    header.className = "cell-header";

    const title = document.createElement("strong");
    title.textContent = "PYTHON";

    const controls = document.createElement("div");

    const runButton = document.createElement("button");
    runButton.textContent = "▶ Run";
    runButton.className = "run-button";
    runButton.disabled = !pyodide;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";

    controls.append(runButton, deleteButton);
    header.append(title, controls);

    // Python code editor
    const editor = document.createElement("textarea");
    editor.placeholder = "Write Python code here...";
    editor.spellcheck = false;
    editor.value = data.code || "";

    // Output section
    const outputLabel = document.createElement("p");
    outputLabel.className = "output-label";
    outputLabel.textContent = "OUTPUT";

    const output = document.createElement("pre");
    output.className = "output";
    output.textContent = data.output || "";

    // Assemble the cell
    content.append(header, editor, outputLabel, output);
    cell.append(number, content);

    notebook.appendChild(cell);

    updateCellNumber(cell);

    // ======================================
    // 6. EXECUTE THIS CELL
    // ======================================

    async function runCell() {

        if (!pyodide || isExecuting) return;

        isExecuting = true;

        document.querySelectorAll(".run-button")
            .forEach(button => button.disabled = true);

        output.textContent = "";

        try {

            // Capture Python print() output
            pyodide.setStdout({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            // Capture Python errors
            pyodide.setStderr({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            // Execute the Python code
            const result = await pyodide.runPythonAsync(editor.value);

            // Display the result of the final expression
            if (result !== undefined) {
                output.textContent += String(result);

                if (result && typeof result.destroy === "function") {
                    result.destroy();
                }
            }

            if (!output.textContent) {
                output.textContent = "Execution completed.";
            }

            // Record this execution
            executionCount++;
            cell.dataset.executionCount = executionCount;

            updateCellNumber(cell);

        } catch (error) {

            output.textContent += error.toString();

        } finally {

            isExecuting = false;

            document.querySelectorAll(".run-button")
                .forEach(button => button.disabled = !pyodide);

            // Save code, output and execution count
            saveNotebook();
        }
    }

    // ======================================
    // 7. CONNECT BUTTONS AND KEYBOARD
    // ======================================

    runButton.addEventListener("click", runCell);

    deleteButton.addEventListener("click", () => {
        cell.remove();
        saveNotebook();
    });

    editor.addEventListener("input", saveNotebook);

    editor.addEventListener("keydown", event => {
        if (event.ctrlKey && event.key === "Enter") {
            runCell();
        }
    });

    return cell;
}

// ==========================================
// 8. RESTORE A PREVIOUS NOTEBOOK
// ==========================================

function restoreNotebook() {

    try {

        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {

            const cells = JSON.parse(savedData);

            if (Array.isArray(cells)) {

                cells.forEach(data => {
                    createCell(data);

                    executionCount = Math.max(
                        executionCount,
                        Number(data.executionCount) || 0
                    );
                });

                if (cells.length > 0) {
                    return;
                }
            }
        }

    } catch (error) {

        console.error("Could not restore notebook:", error);

    }

    // Create an example cell if no notebook exists
    createCell({
        code: `x = 10
y = 20

print(x + y)`
    });
}

// ==========================================
// 9. ADD NEW CELLS
// ==========================================

addButton.addEventListener("click", () => {

    const cell = createCell();

    cell.querySelector("textarea").focus();

    saveNotebook();

});

// ==========================================
// 10. INITIALIZE PYTHON
// ==========================================

async function initializePython() {

    try {

        status.textContent = "Loading Python...";

        pyodide = await loadPyodide();

        status.textContent = "Python is ready!";

        document.querySelectorAll(".run-button")
            .forEach(button => button.disabled = false);

    } catch (error) {

        status.textContent = "Python failed to load.";

        console.error(error);

    }
}

// ==========================================
// 11. START THE APPLICATION
// ==========================================

// Restore notebook before starting Python
restoreNotebook();

// Start Python
initializePython();
