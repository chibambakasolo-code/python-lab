
// 1. Find the elements on our webpage

const status = document.getElementById("status");
const code = document.getElementById("code");
const runButton = document.getElementById("run");
const output = document.getElementById("output");


// 2. Create a variable to hold our Python interpreter

let pyodide = null;


// 3. Load Python

async function initializePython() {

    try {

        status.textContent = "Loading Python...";

        pyodide = await loadPyodide();

        // Capture Python print() output
        pyodide.setStdout({
            batched: (message) => {
                output.textContent += message + "\n";
            }
        });

        // Capture Python errors
        pyodide.setStderr({
            batched: (message) => {
                output.textContent += message + "\n";
            }
        });

        status.textContent = "Python is ready!";

        runButton.disabled = false;

    } catch (error) {

        status.textContent = "Python failed to load.";

        output.textContent = error.message;

    }
}


// 4. Run Python code

async function runPython() {

    if (!pyodide) return;

    runButton.disabled = true;

    output.textContent = "";

    try {

        const result = await pyodide.runPythonAsync(code.value);

        if (result !== undefined) {
            output.textContent += String(result);
        }

    } catch (error) {

        output.textContent += error.toString();

    }

    runButton.disabled = false;
}


// 5. Connect the button to our function

runButton.addEventListener("click", runPython);


// 6. Start the Python interpreter

initializePython();
