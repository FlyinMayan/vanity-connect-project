# Vanity Numbers + Amazon Connect Project

This project implements a small end-to-end system that:

1. Accepts inbound phone calls via **Amazon Connect**
2. Uses an **AWS Lambda** function to generate T9-based vanity numbers for the caller’s phone number
3. Stores the top 5 vanity candidates in **DynamoDB**
4. Exposes a **`GET /recent-callers`** API via **API Gateway**
5. Displays the last 5 callers and their vanity numbers in a **React frontend** (shippable as static files, no dev tools required to view)

---

## High-Level Architecture

1. **Caller dials Amazon Connect number**
   - Amazon Connect invokes the vanity Lambda function and passes the caller’s phone number.

2. **Lambda: Vanity generator (in `vanity-connect/`)**
   - Normalizes the caller’s phone number
   - Uses a **T9 mapping** and a **dictionary of 4-letter words** to generate vanity candidates
   - Always produces up to **5** “best” vanity numbers
   - Returns the **top 3** to Amazon Connect (for the voice menu)
   - Stores the caller record + top 5 vanity numbers in DynamoDB as:

     ```json
     {
       "pk": "CALL",
       "sk": "2025-11-30T18:00:00.000Z",
       "callerNumber": "7203418574",
       "vanityNumbers": [
         "720-341-VLSI",
         "720-341-CALL",
         "720-341-HELP",
         "720-341-HOME",
         "720-341-FREE"
       ]
     }
     ```

3. **DynamoDB table**
   - **Partition key (`pk`)**: constant `"CALL"` to group all call records
   - **Sort key (`sk`)**: ISO timestamp of the call
   - This effectively creates an **append-only call log, newest last**, that can be sorted by `sk` to fetch the latest calls.

4. **Lambda: `getRecentCallers` (in `vanity-connect/`)**
   - Scans the DynamoDB table for `pk = "CALL"`
   - Sorts results by `sk` descending (newest first)
   - Returns the last 5 calls in a simple JSON shape:

     ```json
     [
       {
         "callerNumber": "7203418574",
         "vanityNumbers": ["720-341-VLSI", "720-341-CALL", "720-341-HELP"],
         "calledAt": "2025-11-30T18:00:00.000Z"
       },
       ...
     ]
     ```

5. **API Gateway**
   - Exposes the `getRecentCallers` Lambda as:

     ```text
     GET /recent-callers
     ```

   - CORS is enabled so the React frontend can call it from a browser:

     ```http
     Access-Control-Allow-Origin: *
     Access-Control-Allow-Methods: GET,OPTIONS
     Access-Control-Allow-Headers: Content-Type
     ```

6. **React Frontend (in `vanity-frontend/`)**
   - Simple dashboard that:
     - Calls `GET /recent-callers`
     - Displays a table of the last 5 callers
     - Shows their vanity numbers and timestamp
   - Built with **Vite + React + TypeScript**
   - A **pre-built static bundle** is included so reviewers don’t need Node/Vite to view it.

---

## Repository Structure

```text
vanity-connect-project/
  README.md

  vanity-connect/           # Backend: AWS Lambda + DynamoDB + API definitions
    # (handlers, utils, SAM/CloudFormation template, etc.)

  vanity-frontend/          # Frontend: React + Vite + TypeScript
    src/
      App.tsx
      main.tsx
      # React components and styling
    vite.config.ts
    tsconfig*.json
    package.json
    # Built static files live in:
    dist/
      index.html
      assets/...
