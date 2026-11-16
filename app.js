


const status = document.getElementById("status");
const notebook = document.getElementById("notebook");
const addButton = document.getElementById("add-cell");

let pyodide = null;
let nextCellId = 1;


// INITIALIZE PYTHON

async function initializePython() {
    try {
        status.textContent = "Loading Python...";

        pyodide = await loadPyodide();

        status.textContent = "Python is ready!";

        // Enable existing cells
        document.querySelectorAll(".run-button")
            .forEach(button => button.disabled = false);

    } catch (error) {
        status.textContent = "Python failed to load.";
        console.error(error);
    }
}


// CREATE A NOTEBOOK CELL

function createCell(initialCode = "") {

    const id = nextCellId++;

    const cell = document.createElement("section");
    cell.className = "cell";

    // Cell heading
    const header = document.createElement("div");
    header.className = "cell-header";

    const title = document.createElement("strong");
    title.textContent = `Cell ${id}`;

    // Run button
    const runButton = document.createElement("button");
    runButton.textContent = "Run";
    runButton.className = "run-button";
    runButton.disabled = !pyodide;

    // Delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";

    const controls = document.createElement("div");

    controls.append(runButton, deleteButton);
    header.append(title, controls);

    // Python code editor
    const editor = document.createElement("textarea");
    editor.placeholder = "Write Python code here...";
    editor.spellcheck = false;
    editor.value = initialCode;

    // Output area
    const outputLabel = document.createElement("p");
    outputLabel.className = "output-label";
    outputLabel.textContent = "OUTPUT";

    const output = document.createElement("pre");
    output.className = "output";
    output.textContent = "No output yet.";

    cell.append(header, editor, outputLabel, output);

    notebook.appendChild(cell);


    // EXECUTE THIS CELL

    async function runCell() {

        if (!pyodide) return;

        runButton.disabled = true;
        output.textContent = "";

        try {

            // Capture print() output
            pyodide.setStdout({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            // Capture error output
            pyodide.setStderr({
                batched: message => {
                    output.textContent += message + "\n";
                }
            });

            // Execute the Python code
            const result = await pyodide.runPythonAsync(
                editor.value
            );

            // Display the final returned value
            if (result !== undefined) {
                output.textContent += String(result);
                
                // Release Python objects when necessary
                if (result && typeof result.destroy === "function") {
                    result.destroy();
                }
            }

            if (!output.textContent) {
                output.textContent = "Execution completed.";
            }

        } catch (error) {

            output.textContent += error.toString();

        } finally {

            runButton.disabled = false;

        }
    }


    // BUTTON EVENTS

    runButton.addEventListener("click", runCell);

    deleteButton.addEventListener("click", () => {
        cell.remove();
    });

    // Ctrl + Enter runs the cell
    editor.addEventListener("keydown", event => {

        if (event.ctrlKey && event.key === "Enter") {
            runCell();
        }

    });

    return cell;
}


// ADD A NEW CELL

addButton.addEventListener("click", () => {

    const cell = createCell();

    cell.querySelector("textarea").focus();

});


// CREATE OUR FIRST CELL

createCell(
`x = 10
y = 20

print(x + y)`
);


// START PYTHON

initializePython();
