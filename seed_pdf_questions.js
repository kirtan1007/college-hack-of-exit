const fs = require('fs');
const path = require('path');

const questions = [
  {
    questionId: "Q01",
    set: "ALL",
    setName: "Cyber Security",
    title: "STAGE 01: AUTHENTICATION BYPASS",
    category: "Cyber Security",
    code: `if (username == "admin" && password == 1234) {\n    cout << "ACCESS GRANTED";\n} else {\n    cout << "ACCESS DENIED";\n}`,
    promptText: "If username = admin and password = 1234, determine the program output.",
    answerKey: "ACCESS GRANTED",
    directPasskey: "ACCESS GRANTED",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q02",
    nextQuestionIdOnPasskey: "Q02",
    nextQuestionIdOnWrong: "Q01",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "easy",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q01-G1", text: "The condition uses logical AND (&&).", order: 1 },
      { clueId: "Q01-G2", text: "The username is admin.", order: 2 },
      { clueId: "Q01-G3", text: "Both conditions must be true.", order: 3 },
      { clueId: "Q01-G4", text: "The password is 1234.", order: 4 },
      { clueId: "Q01-G5", text: "The exact output is ACCESS GRANTED.", order: 5 },
      { clueId: "Q01-G6", text: "The else block runs when both conditions are true.", order: 6 }
    ],
    badClues: [
      { clueId: "Q01-B1", text: "The condition uses OR (||).", order: 1 },
      { clueId: "Q01-B2", text: "The username is guest.", order: 2 },
      { clueId: "Q01-B3", text: "Only the username must match.", order: 3 },
      { clueId: "Q01-B4", text: "The password is 4321.", order: 4 },
      { clueId: "Q01-B5", text: "The output is ACCESS DENIED.", order: 5 },
      { clueId: "Q01-B6", text: "The program compares two integers.", order: 6 }
    ]
  },
  {
    questionId: "Q02",
    set: "ALL",
    setName: "Hacking",
    title: "STAGE 02: SQL INJECTION LOGIC",
    category: "Hacking",
    code: `string query = "SELECT * FROM users WHERE user='" + input_user + "' AND pass='" + input_pass + "';";`,
    promptText: "A web login directly joins attacker-controlled input into a SQL query. Identify the security weakness.",
    answerKey: "SQL INJECTION",
    directPasskey: "SQL INJECTION",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q03",
    nextQuestionIdOnPasskey: "Q03",
    nextQuestionIdOnWrong: "Q02",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "easy",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q02-G1", text: "User input is directly concatenated into SQL.", order: 1 },
      { clueId: "Q02-G2", text: "The query is built as a string.", order: 2 },
      { clueId: "Q02-G3", text: "An attacker may alter the intended SQL logic.", order: 3 },
      { clueId: "Q02-G4", text: "Prepared statements help prevent this class of issue.", order: 4 },
      { clueId: "Q02-G5", text: "The vulnerability is SQL INJECTION.", order: 5 },
      { clueId: "Q02-G6", text: "The input is not safely parameterized.", order: 6 }
    ],
    badClues: [
      { clueId: "Q02-B1", text: "The code uses AES encryption.", order: 1 },
      { clueId: "Q02-B2", text: "The input is automatically hashed.", order: 2 },
      { clueId: "Q02-B3", text: "Only C++ pointers are involved.", order: 3 },
      { clueId: "Q02-B4", text: "The database cannot be affected by input.", order: 4 },
      { clueId: "Q02-B5", text: "The weakness is buffer overflow.", order: 5 },
      { clueId: "Q02-B6", text: "The query is always safe because it uses strings.", order: 6 }
    ]
  },
  {
    questionId: "Q03",
    set: "ALL",
    setName: "Cyber Security",
    title: "STAGE 03: PASSWORD HASHING",
    category: "Cyber Security",
    code: `// Password Storage Security Protocol\nhash = SHA256(password + salt);\nsave_to_database(username, hash);`,
    promptText: "A system stores passwords as a one-way cryptographic hash. What key property makes this useful?",
    answerKey: "ONE-WAY",
    directPasskey: "ONE-WAY",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q04",
    nextQuestionIdOnPasskey: "Q04",
    nextQuestionIdOnWrong: "Q03",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q03-G1", text: "A hash is designed to be difficult to reverse.", order: 1 },
      { clueId: "Q03-G2", text: "The stored value is not the original password.", order: 2 },
      { clueId: "Q03-G3", text: "Verification can compare hashes.", order: 3 },
      { clueId: "Q03-G4", text: "Secure password hashing uses a salt.", order: 4 },
      { clueId: "Q03-G5", text: "The property is ONE-WAY.", order: 5 },
      { clueId: "Q03-G6", text: "Hashing differs from reversible encryption.", order: 6 }
    ],
    badClues: [
      { clueId: "Q03-B1", text: "The hash should be decrypted to verify it.", order: 1 },
      { clueId: "Q03-B2", text: "A hash is the same as plaintext.", order: 2 },
      { clueId: "Q03-B3", text: "Passwords should be stored in a text file.", order: 3 },
      { clueId: "Q03-B4", text: "The original password must be displayed.", order: 4 },
      { clueId: "Q03-B5", text: "Hashing is simply Base64 encoding.", order: 5 },
      { clueId: "Q03-B6", text: "The server must store plaintext passwords.", order: 6 }
    ]
  },
  {
    questionId: "Q04",
    set: "ALL",
    setName: "Hacking",
    title: "STAGE 04: PRIVILEGE ESCALATION",
    category: "Hacking",
    code: `// Access Control Matrix\nif (user.role == "standard_user") {\n    // Vulnerability: Missing server-side authorization check\n    execute_root_command(req.param("cmd"));\n}`,
    promptText: "A normal user exploits a permission check and can execute an administrative action. Identify the security concept.",
    answerKey: "PRIVILEGE ESCALATION",
    directPasskey: "PRIVILEGE ESCALATION",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q05",
    nextQuestionIdOnPasskey: "Q05",
    nextQuestionIdOnWrong: "Q04",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q04-G1", text: "The account gains access beyond intended permissions.", order: 1 },
      { clueId: "Q04-G2", text: "The vulnerable check allows a higher-privilege action.", order: 2 },
      { clueId: "Q04-G3", text: "Authorization controls what an authenticated user may do.", order: 3 },
      { clueId: "Q04-G4", text: "Least privilege reduces unnecessary permissions.", order: 4 },
      { clueId: "Q04-G5", text: "The issue can give a normal account elevated rights.", order: 5 },
      { clueId: "Q04-G6", text: "The concept is PRIVILEGE ESCALATION.", order: 6 }
    ],
    badClues: [
      { clueId: "Q04-B1", text: "The issue is only a DNS lookup.", order: 1 },
      { clueId: "Q04-B2", text: "Authentication and authorization are identical.", order: 2 },
      { clueId: "Q04-B3", text: "The user has no account.", order: 3 },
      { clueId: "Q04-B4", text: "It is necessarily a hardware failure.", order: 4 },
      { clueId: "Q04-B5", text: "The concept is data compression.", order: 5 },
      { clueId: "Q04-B6", text: "It means losing network connectivity.", order: 6 }
    ]
  },
  {
    questionId: "Q05",
    set: "ALL",
    setName: "Cyber Security",
    title: "STAGE 05: CROSS-SITE SCRIPTING",
    category: "Cyber Security",
    code: `<!-- Unsanitized User Input in DOM -->\n<div class="comment-box">\n    <?php echo $_GET['comment']; ?>\n</div>`,
    promptText: "A website renders user comments without safely encoding HTML, allowing script content to execute in another user's browser. Identify the vulnerability.",
    answerKey: "CROSS-SITE SCRIPTING (XSS)",
    directPasskey: "CROSS-SITE SCRIPTING (XSS)",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q06",
    nextQuestionIdOnPasskey: "Q06",
    nextQuestionIdOnWrong: "Q05",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q05-G1", text: "The browser interprets injected script content.", order: 1 },
      { clueId: "Q05-G2", text: "Unsafe output can affect another user's browser.", order: 2 },
      { clueId: "Q05-G3", text: "Output encoding is an important defense.", order: 3 },
      { clueId: "Q05-G4", text: "XSS targets web application behavior in a browser.", order: 4 },
      { clueId: "Q05-G5", text: "The vulnerability is CROSS-SITE SCRIPTING (XSS).", order: 5 },
      { clueId: "Q05-G6", text: "Content Security Policy can reduce some XSS impact.", order: 6 }
    ],
    badClues: [
      { clueId: "Q05-B1", text: "The vulnerability is SQL injection.", order: 1 },
      { clueId: "Q05-B2", text: "The payload must modify a C++ pointer.", order: 2 },
      { clueId: "Q05-B3", text: "XSS means encrypting a database.", order: 3 },
      { clueId: "Q05-B4", text: "The browser never executes JavaScript.", order: 4 },
      { clueId: "Q05-B5", text: "The issue is always a network cable.", order: 5 },
      { clueId: "Q05-B6", text: "The defense is storing passwords in plaintext.", order: 6 }
    ]
  },
  {
    questionId: "Q06",
    set: "ALL",
    setName: "C++ / Pointer Trace",
    title: "STAGE 06: C++ POINTER TRACE",
    category: "C++ / Pointer Trace",
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int secret = 18;\n    int *p = &secret;\n    *p = *p + 7;\n    cout << *p;\n    return 0;\n}`,
    promptText: "int secret=18; int *p=&secret; *p=*p+7; cout<<*p;",
    answerKey: "25",
    directPasskey: "25",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q07",
    nextQuestionIdOnPasskey: "Q07",
    nextQuestionIdOnWrong: "Q06",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q06-G1", text: "The pointer p stores the address of secret.", order: 1 },
      { clueId: "Q06-G2", text: "Dereferencing p accesses the value of secret.", order: 2 },
      { clueId: "Q06-G3", text: "secret initially contains 18.", order: 3 },
      { clueId: "Q06-G4", text: "The statement adds 7 to the value.", order: 4 },
      { clueId: "Q06-G5", text: "cout << *p prints the pointed value.", order: 5 },
      { clueId: "Q06-G6", text: "The final value is 25.", order: 6 }
    ],
    badClues: [
      { clueId: "Q06-B1", text: "p stores 25 directly as an address.", order: 1 },
      { clueId: "Q06-B2", text: "A loop runs seven times.", order: 2 },
      { clueId: "Q06-B3", text: "The pointer points to a string.", order: 3 },
      { clueId: "Q06-B4", text: "secret starts at 25.", order: 4 },
      { clueId: "Q06-B5", text: "The program uses a reference instead of a pointer.", order: 5 },
      { clueId: "Q06-B6", text: "The output is ACCESS.", order: 6 }
    ]
  },
  {
    questionId: "Q07",
    set: "ALL",
    setName: "C++ / Recursion",
    title: "STAGE 07: C++ RECURSION + LOGIC",
    category: "C++ / Recursion",
    code: `#include <iostream>\nusing namespace std;\n\nint calc(int n) {\n    if (n == 1) return 2;\n    return n + calc(n - 1);\n}\n\nint main() {\n    cout << calc(4);\n    return 0;\n}`,
    promptText: "int calc(int n){ if(n==1)return 2; return n+calc(n-1); } cout<<calc(4);",
    answerKey: "12",
    directPasskey: "12",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q08",
    nextQuestionIdOnPasskey: "Q08",
    nextQuestionIdOnWrong: "Q07",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q07-G1", text: "The base case returns 2.", order: 1 },
      { clueId: "Q07-G2", text: "calc(4) calls calc(3).", order: 2 },
      { clueId: "Q07-G3", text: "calc(3) calls calc(2).", order: 3 },
      { clueId: "Q07-G4", text: "calc(2) calls calc(1).", order: 4 },
      { clueId: "Q07-G5", text: "The additions are 4 + 3 + 2 + 2.", order: 5 },
      { clueId: "Q07-G6", text: "The final result is 12.", order: 6 }
    ],
    badClues: [
      { clueId: "Q07-B1", text: "The function multiplies n by calc(n-1).", order: 1 },
      { clueId: "Q07-B2", text: "The base case is n==0.", order: 2 },
      { clueId: "Q07-B3", text: "calc(4) has no recursion.", order: 3 },
      { clueId: "Q07-B4", text: "The result is 24.", order: 4 },
      { clueId: "Q07-B5", text: "Recursion starts from 0.", order: 5 },
      { clueId: "Q07-B6", text: "The program prints ACCESS.", order: 6 }
    ]
  },
  {
    questionId: "Q08",
    set: "ALL",
    setName: "C++ / Arrays",
    title: "STAGE 08: C++ ARRAY / INDEX TRAP",
    category: "C++ / Arrays",
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a[] = {4, 8, 15, 16, 23};\n    int x = a[1] + a[3];\n    if (x > 20) cout << x;\n    return 0;\n}`,
    promptText: "int a[]={4,8,15,16,23}; int x=a[1]+a[3]; if(x>20) cout<<x;",
    answerKey: "24",
    directPasskey: "24",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q09",
    nextQuestionIdOnPasskey: "Q09",
    nextQuestionIdOnWrong: "Q08",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q08-G1", text: "Array indexing starts at 0.", order: 1 },
      { clueId: "Q08-G2", text: "a[1] is 8.", order: 2 },
      { clueId: "Q08-G3", text: "a[3] is 16.", order: 3 },
      { clueId: "Q08-G4", text: "x is a[1] + a[3].", order: 4 },
      { clueId: "Q08-G5", text: "x becomes 24.", order: 5 },
      { clueId: "Q08-G6", text: "The condition 24 > 20 is true.", order: 6 }
    ],
    badClues: [
      { clueId: "Q08-B1", text: "a[1] is 4.", order: 1 },
      { clueId: "Q08-B2", text: "a[3] is 15.", order: 2 },
      { clueId: "Q08-B3", text: "The array has four elements.", order: 3 },
      { clueId: "Q08-B4", text: "The condition checks x < 20.", order: 4 },
      { clueId: "Q08-B5", text: "The output is BLOCK.", order: 5 },
      { clueId: "Q08-B6", text: "Array indexing starts at 1.", order: 6 }
    ]
  },
  {
    questionId: "Q09",
    set: "ALL",
    setName: "Hacking Logic",
    title: "STAGE 09: HACKING LOGIC — XOR KEY",
    category: "Hacking Logic",
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int encrypted = 91;\n    int key = 13;\n    int original = encrypted ^ key;\n    cout << original;\n    return 0;\n}`,
    promptText: "int encrypted=91; int key=13; int original=encrypted^key; cout<<original;",
    answerKey: "86",
    directPasskey: "86",
    isFinalVault: false,
    nextQuestionIdOnCorrect: "Q10",
    nextQuestionIdOnPasskey: "Q10",
    nextQuestionIdOnWrong: "Q09",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "medium",
    score: 100,
    penalty: 20,
    goodClues: [
      { clueId: "Q09-G1", text: "The ^ operator performs bitwise XOR.", order: 1 },
      { clueId: "Q09-G2", text: "encrypted starts at 91.", order: 2 },
      { clueId: "Q09-G3", text: "key is 13.", order: 3 },
      { clueId: "Q09-G4", text: "XOR is applied between encrypted and key.", order: 4 },
      { clueId: "Q09-G5", text: "The result is 86.", order: 5 },
      { clueId: "Q09-G6", text: "The exact output is 86.", order: 6 }
    ],
    badClues: [
      { clueId: "Q09-B1", text: "^ means exponentiation here.", order: 1 },
      { clueId: "Q09-B2", text: "The result is 104.", order: 2 },
      { clueId: "Q09-B3", text: "The key is 31.", order: 3 },
      { clueId: "Q09-B4", text: "The result is a string.", order: 4 },
      { clueId: "Q09-B5", text: "The operation is multiplication.", order: 5 },
      { clueId: "Q09-B6", text: "The output is 13.", order: 6 }
    ]
  },
  {
    questionId: "Q10",
    set: "ALL",
    setName: "Math / Hacker Lock",
    title: "STAGE 10: MATH + HACKER LOCK",
    category: "Math / Hacker Lock",
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int code = 3;\n    for (int i = 0; i < 3; i++) {\n        code = code * 2 + 1;\n    }\n    cout << code;\n    return 0;\n}`,
    promptText: "int code=3; for(int i=0;i<3;i++) code=code*2+1; cout<<code;",
    answerKey: "31",
    directPasskey: "31",
    isFinalVault: true,
    nextQuestionIdOnCorrect: "WIN",
    nextQuestionIdOnPasskey: "WIN",
    nextQuestionIdOnWrong: "Q10",
    wrongAnswerAction: "retry",
    wrongPasskeyAction: "retry",
    difficulty: "hard",
    score: 200,
    penalty: 20,
    goodClues: [
      { clueId: "Q10-G1", text: "The initial code is 3.", order: 1 },
      { clueId: "Q10-G2", text: "The loop executes three times.", order: 2 },
      { clueId: "Q10-G3", text: "Each iteration doubles code.", order: 3 },
      { clueId: "Q10-G4", text: "Each iteration adds 1.", order: 4 },
      { clueId: "Q10-G5", text: "The values become 7, 15, 31.", order: 5 },
      { clueId: "Q10-G6", text: "The final answer is 31.", order: 6 }
    ],
    badClues: [
      { clueId: "Q10-B1", text: "The loop executes four times.", order: 1 },
      { clueId: "Q10-B2", text: "The initial code is 1.", order: 2 },
      { clueId: "Q10-B3", text: "Each iteration subtracts 1.", order: 3 },
      { clueId: "Q10-B4", text: "The intermediate values are 6, 12, 24.", order: 4 },
      { clueId: "Q10-B5", text: "The output is 32.", order: 5 },
      { clueId: "Q10-B6", text: "The loop uses division.", order: 6 }
    ]
  }
];

// Ensure stable, permanent _id for every question
questions.forEach(q => {
  q._id = `qid_${q.questionId.toLowerCase()}`;
});

// Write Question.json
const qPath = path.join(__dirname, 'backend/data/Question.json');
fs.writeFileSync(qPath, JSON.stringify(questions, null, 2), 'utf8');
console.log(`[SUCCESS] Wrote ${questions.length} questions to ${qPath}`);

// Update QuestionSet.json to point start to Q01 and final to Q10
const qsPath = path.join(__dirname, 'backend/data/QuestionSet.json');
const questionSets = [
  {
    name: "A",
    entryOctal: "11",
    entryBinaryPassword: "1001",
    startQuestionId: "Q01",
    finalQuestionId: "Q10",
    difficulty: "medium",
    active: true
  },
  {
    name: "B",
    entryOctal: "15",
    entryBinaryPassword: "1101",
    startQuestionId: "Q01",
    finalQuestionId: "Q10",
    difficulty: "medium",
    active: true
  },
  {
    name: "C",
    entryOctal: "17",
    entryBinaryPassword: "1111",
    startQuestionId: "Q01",
    finalQuestionId: "Q10",
    difficulty: "medium",
    active: true
  }
];
fs.writeFileSync(qsPath, JSON.stringify(questionSets, null, 2), 'utf8');
console.log(`[SUCCESS] Updated ${questionSets.length} question sets to start with Q01 and end at Q10.`);
