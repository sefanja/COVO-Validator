# COVO Validator for Archi

## Automating Semantic Coherence in Business Architecture

The COVO Validator is a jArchi script designed to validate ArchiMate models against the Capability-Object-Value Ontology (COVO) method. It bridges the gap between organizational behavior (value streams and business capabilities) and structural assets (business objects) by enforcing formal semantic constraints.

## Key Features

1. Progressive validation workflow
   The tool supports the architect's natural workflow by offering two validation profiles:
   * **Construction mode**: context-aware validation for work-in-progress.
   * **Audit mode**: strict validation for release candidates.

2. Heuristic view classification
   No manual configuration required. The tool analyzes the structural content of your views to automatically apply the correct validation logic:
   * **Top-Level Views**: containing only top-level elements.
   * **Value Stream Views**: where all the stages belong to the same top-level value stream.
     * **Value Stream Collections**: group of value stream views that share a common top-level value stream.
     * **Value Stage Zones**: all elements on a value stream view that overlap horizontally with a lowest-level value stream stage.
   * **Object Domain Views**: consisting of a two-level structure with exactly one higher-level object and at least one relationship between objects.
   * **Landscape Views**: all other views are assumed to provide complete overviews of one or more element types at a certain refinement level.

   ![Validation scopes](scope.svg)

3. Dialect-agnostic
   Whether you use the Strategy Layer (Value Stream / Capability / Resource) or the Business Layer (Business Process / Business Function / Business Object), the tool automatically detects your modeling dialect and adjusts its internal logic accordingly.

4. Enterprise-Grade Performance
   Validates complex models (~2000 elements, ~70 views) in < 15 seconds.

## Prerequisites

[Archi](https://www.archimatetool.com/) with the jArchi plugin installed.

## Installation

Download this repository as a ZIP file.

Extract the contents into a folder on your system, for example:

```Text
C:\Users\UserName\Downloads\COVO Validator\
```

To use this script inside Archi:

1. Open Archi
2. Go to `Scripts → Scripts Manager`, and click **New Archi Script**
3. Name the new script `COVO Validator.ajs`
4. In the script editor, paste the following line (adjust the path if needed):

   ```javascript
   load('C:/Users/UserName/Downloads/COVO Validator/main.js');
   ```

5. Save the script

## Usage

1. **Select scope**: In the Model Tree, select the views, folders, or the entire model you wish to validate.
2. **Run**: Right-click the selection -> `Scripts` -> `COVO Validator`.
3. **Choose profile**: Select *Construction* or *Audit* from the dialog.
4. **Analyze**: Open the Script Console in Archi to view the report.

### The Console Report

```Text
======================================================================
                          VALIDATION REPORT
======================================================================
OVERALL STATUS: FAILED

VIOLATION SUMMARY:
 - Rules failed: C4
 - Total violations: 2

Recommended fix order: C1-3, V1-2, C6-13, C4-5

----------------------------------------------------------------------
                   VALUE STREAM COLLECTION FAILURES
----------------------------------------------------------------------

 [!!] C4 - Upward coherence - Connect users to the grid
 --------------------------------------------------
 2 violations:
  - Integrate connection into energy grid (L1 value-stream) --> Perform connection work (L1 value-stream)
  - Perform work on energy grids (L1 capability) --> Work activity (L1 resource)
```

## The COVO Logic (Briefly)

The tool enforces 13 constraints (C1-13) and 2 view rules (V1-2) based on the principle of semantic symmetry:

* **Behavior implies structure**: If stage A triggers stage B or capability A enables capability B, then their objects have a status dependency.
* **Structure validates behavior**: If the structural dependency is missing, the behavioral logic is considered invalid.

This ensures that your Business Object Model (BOM) is not just a drawing, but an artifact grounded in the value creation logic.

## Configuration

The tool works out-of-the-box, but you can tweak settings in config.js:

* **Dialect**: Force specific ArchiMate types if auto-detection fails.
* **Violation limit**: Adjust the number of examples shown per failure in the console.

## Project Structure

* `main.js`: Entry point. Handles user interaction, scope collection, and report generation.
* `rules.js`: Contains the logic for constraints C1-C13 and V1-V2.
* `utils.js`: A library for graph traversal, caching, and COVO model projection.
* `config.js`: Configuration and auto-detection logic.

## Citation

If you use this tool in academic work, please cite the accompanying EDOC paper:
[Citation Placeholder: "Grounding Business Object Models in Value Creation", EDOC 2025]

## License

This project is licensed under the MIT License - see the LICENSE file for details.
