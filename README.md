# Hack The Exit – Mystery / Escape Game Web Application

**Hack The Exit** is a production-ready, full-stack mystery escape-room web application built for college lab PC terminals connected to a central server. Students register, solve an Octal-to-Binary entry challenge, analyze **12 mixed telemetry clues** (6 Good + 6 Bad) to decrypt the system, avoid traps, or use **Direct Passkeys** to race to escape before the timer expires.

---

## 1. New Core Gameplay Concept

The gameplay operates on a cryptographic reasoning mechanic:
- **1 Main Question Prompt**
- **6 Good Clues**: Useful signals and hints that logically lead to the solution.
- **6 Bad Clues**: Believable, deceptive signals that create confusion or waste time.
- **1 Direct Passkey**: A secret bypass key for speedrunners who already know the solution.

### How it Works for Students:
1. When a question loads, the server merges the 6 Good Clues and 6 Bad Clues, randomizes their order, and delivers **12 mixed clues** (`CLUE 01` to `CLUE 12`).
2. Clue cards are rendered in a cyberpunk glassmorphic grid.
3. Students click any clue card to expand full text, view visual diagrams, and take personal notes.
4. **Security Rule**: Clue classification (`Good` vs `Bad`) is **NEVER** exposed in HTML, client JavaScript, CSS, sessionStorage, or API responses.
5. Students can solve the room through:
   - **Method A (Reasoning)**: Analyze the 12 clues, determine the answer key, and click **[ VERIFY ANSWER ]**.
   - **Method B (Direct Passkey)**: Enter the direct bypass passkey and click **[ USE PASSKEY ]** to immediately skip clue analysis and route to the next question.

---

## 2. Project Architecture

```
Hack-The-Exit/
├── package.json          # Node dependencies & running scripts
├── server.js             # Main Express server entry & middleware setup
├── .env                  # Environment configurations
├── README.md             # Complete documentation
│
├── backend/
│   ├── config/
│   │   ├── database.js   # Mongoose MongoDB connection
│   │   └── localDb.js    # Offline Local JSON Database fallback
│   │
│   ├── models/           # Mongoose schemas
│   │   ├── AdminUser.js
│   │   ├── Student.js
│   │   ├── PCAssignment.js
│   │   ├── QuestionSet.js
│   │   ├── Question.js   # 6 Good + 6 Bad clues + Passkey schema
│   │   ├── Trap.js
│   │   ├── GameSession.js# Telemetry & question progress
│   │   ├── Result.js     # Score, solved puzzles, passkeys used
│   │   └── SystemSettings.js
│   │
│   ├── routes/           # Express API endpoints
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── admin.js
│   │   ├── questionSets.js
│   │   ├── questions.js  # CRUD & duplication routes
│   │   ├── traps.js
│   │   ├── game.js       # Clue shuffling & validation
│   │   └── results.js
│   │
│   ├── controllers/      # Route controllers
│   │   ├── authController.js
│   │   ├── studentController.js
│   │   ├── adminController.js
│   │   ├── questionController.js
│   │   ├── gameController.js
│   │   └── resultController.js
│   │
│   └── middleware/
│       ├── authMiddleware.js
│       └── validation.js
│
├── frontend/             # Single-page client dashboard & views
│   ├── index.html        # Student Welcome landing page
│   ├── registration.html # Student registration form
│   ├── entry-challenge.html # Decryption entry gate
│   ├── game.html         # 12 mixed clues escape room console
│   ├── result.html       # Final stats and rankings table
│   │
│   ├── admin/
│   │   ├── login.html    # Admin sign-in portal
│   │   └── dashboard.html# Question Builder & Control Center
│   │
│   ├── css/              # Cyberpunk stylesheets
│   │   ├── style.css
│   │   ├── registration.css
│   │   ├── game.css
│   │   └── admin.css
│   │
│   └── js/               # Interactive scripts
│       ├── app.js
│       ├── registration.js
│       ├── entryChallenge.js
│       ├── game.js
│       └── admin.js
│
└── uploads/              # Uploaded question clues & diagrams
```

---

## 3. Setup Commands & Installation

### Prerequisites
- Node.js (v16+)
- MongoDB (Optional: The application automatically falls back to an offline local JSON database if MongoDB is not active)

### Installation
```bash
npm install
```

### Seed Default Admin, Questions, and PC Assignments
To initialize default admin credentials (`admin` / `admin123`), PC assignments (`PC-01`, `PC-02`, `PC-03`), and Sets A, B, C with 6 Good + 6 Bad clues per question:
```bash
npm run seed
```

### Start the Application
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 4. Environment Variables (`.env`)

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/hack-the-exit
JWT_SECRET=supersecretjwtkeyforhacktheexit
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## 5. How Administrators Build and Manage Questions

1. Log into the Admin Dashboard at `http://localhost:3000/admin/login.html` (or press `Ctrl + Shift + A` on the landing page). Default credentials: `admin` / `admin123`.
2. Navigate to **Question Builder** in the sidebar.
3. Click **+ CREATE QUESTION**.
4. Fill in the required fields:
   - **Question Details**: Question ID (`QA-1`), Assigned Set (`A`, `B`, or `C`), Title, Difficulty, and Prompt Narrative.
   - **6 Good Clues**: Enter 6 useful clues that assist students in deducing the answer.
   - **6 Bad Clues**: Enter 6 deceptive or irrelevant clues that challenge analytical thinking.
   - **Answer Configuration**: Enter the primary `Correct Answer Key` and the secondary `Direct Passkey`.
   - **Branching & Escape Route**:
     - `Next Q-ID on Correct Answer`: Set next question ID or enter `WIN`.
     - `Next Q-ID on Direct Passkey`: Set next question ID or enter `WIN`.
     - `On Wrong Answer`: Choose `Retry`, `Time Penalty (-60s)`, `Trigger Trap`, or `Alternate Route`.
     - `Final Vault Question`: Check if this is the final escape door.
5. Click **PUBLISH QUESTION**.
6. **Preview Question**: Click **[ PREVIEW ]** on any question row in the table to test how students see the 12 shuffled clues. Click **[ TOGGLE GOOD / BAD LABELS ]** to verify clue classifications.
7. **Duplicate Question**: Click **[ COPY ]** to instantly clone any question, its 12 clues, answer keys, passkeys, and branching logic.

---

## 6. Configuring PC Terminals & Sets

Each lab PC auto-detects its terminal identity via the clean URL path or localStorage:
- Terminal 1: `http://<HOST_IP>:3000/PC-01`  (or `http://localhost:3000/PC-01`)
- Terminal 2: `http://<HOST_IP>:3000/PC-02`
- Terminal 3: `http://<HOST_IP>:3000/PC-03`  (and so on for /PC-04, /PC-05...)

In the Admin Dashboard under **PC Assignments**, organizers can map each terminal (e.g. `PC-01`) to Question Set A, B, or C. When a student registers on that PC, the backend automatically locks their session to the assigned question set.

---

## 7. Leaderboard & Results Export

- Post-game results and live rankings are displayed at `/result.html`.
- Ranking order:
  1. Escaped status (`WIN`)
  2. Fastest completion time
  3. Lowest trap count
  4. Lowest answer attempts
- Administrators can download the complete participant leaderboard anytime via **EXPORT RESULTS CSV** on the Admin Dashboard.
