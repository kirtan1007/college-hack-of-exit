const mongoose = require('./config/dbLoader');
const bcrypt = require('bcryptjs');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const AdminUser = require('./models/AdminUser');
const QuestionSet = require('./models/QuestionSet');
const Question = require('./models/Question');
const Trap = require('./models/Trap');
const SystemSettings = require('./models/SystemSettings');
const PCAssignment = require('./models/PCAssignment');

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hack-the-exit';
    console.log(`Seeding database at ${mongoUri}...`);
    
    try {
      if (process.env.USE_LOCAL_JSON_DB === 'true') {
        throw new Error('Explicitly configured to use Local JSON Database');
      }
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      global.useLocalJsonDb = false;
      console.log('Connected to MongoDB.');
    } catch (err) {
      console.warn(`\n[DATABASE WARNING] Could not connect to MongoDB for seeding: ${err.message}`);
      console.warn(`[DATABASE INFO] Seeding to LOCAL OFFLINE JSON DATABASE. (Data stored in backend/data/)\n`);
      global.useLocalJsonDb = true;
    }

    // Clear existing data
    await AdminUser.deleteMany({});
    await QuestionSet.deleteMany({});
    await Question.deleteMany({});
    await Trap.deleteMany({});
    await SystemSettings.deleteMany({});
    console.log('Cleared existing database entries.');

    // 1. Seed Admin User
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const admin = new AdminUser({
      username: adminUsername,
      password: hashedPassword
    });
    await admin.save();
    console.log(`Admin user created: username: ${adminUsername}, password: ${adminPassword}`);

    // 2. Seed System Settings
    const settings = new SystemSettings({
      eventName: 'Hack The Exit',
      eventDescription: 'Analyze 12 mixed clues to decrypt the system, avoid traps, or use direct passkeys to escape.',
      defaultTimerMinutes: 30,
      maxPasswordAttempts: 3,
      enableHints: true,
      departments: ['BCA', 'B.Sc IT', 'B.Tech CS', 'MCA', 'M.Sc IT', 'Other'],
      semesters: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6']
    });
    await settings.save();
    console.log('System settings seeded.');

    // 3. Seed PC Assignments default list (PC-01 to PC-20 alternating A/B)
    await PCAssignment.deleteMany({});
    const pcSeeds = [];
    for (let i = 1; i <= 20; i++) {
      const pad = i < 10 ? '0' + i : '' + i;
      pcSeeds.push({
        pcId: `PC-${pad}`,
        assignedSet: i % 2 === 1 ? 'A' : 'B'
      });
    }
    await PCAssignment.insertMany(pcSeeds);
    console.log(`Default PC Assignments seeded (${pcSeeds.length} terminals).`);

    // 4. Seed Question Sets (Pattern A & Pattern B)
    const sets = [
      {
        name: 'A',
        entryOctal: '11',
        entryBinaryPassword: '1001',
        startQuestionId: 'Q01',
        finalQuestionId: 'Q02',
        difficulty: 'medium',
        active: true
      },
      {
        name: 'B',
        entryOctal: '15',
        entryBinaryPassword: '1101',
        startQuestionId: 'Q02',
        finalQuestionId: 'Q01',
        difficulty: 'medium',
        active: true
      }
    ];
    await QuestionSet.insertMany(sets);
    console.log('Question sets seeded.');

    // 5. Seed Hard Code Questions with Exactly 6 Good Clues + 6 Bad Clues + 1 Direct Passkey
    const questions = [
      // ==========================================
      // SET A: C++, PYTHON, SQL CYBER SECURITY
      // ==========================================
      {
        questionId: 'QA-1',
        set: 'A',
        setName: 'A',
        title: 'STAGE 01: POLYMORPHIC DESTRUCTOR LIFECYCLE',
        category: 'C++ / OOP Architecture',
        code: `#include <iostream>
class Base {
public:
    Base() { std::cout << "B"; }
    virtual ~Base() { std::cout << "~B"; }
    virtual void ping() { std::cout << "P1"; }
};
class Derived : public Base {
public:
    Derived() { std::cout << "D"; }
    ~Derived() { std::cout << "~D"; }
    void ping() override { std::cout << "P2"; }
};
int main() {
    Base* obj = new Derived();
    obj->ping();
    delete obj;
    return 0;
}`,
        promptText: 'Analyze the memory allocation and destruction lifecycle of the polymorphic C++ class hierarchy. Predict the exact output string printed to standard console output.',
        answerKey: 'BDP2~D~B',
        directPasskey: 'VPTR_VTBL',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QA-2',
        nextQuestionIdOnPasskey: 'QA-2',
        nextQuestionIdOnWrong: 'TRAP-A1',
        wrongAnswerAction: 'retry',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-A1',
        difficulty: 'medium',
        score: 150,
        penalty: 30,
        goodClues: [
          { clueId: 'QA1-G1', text: 'Base constructor executes first, printing "B".', order: 1 },
          { clueId: 'QA1-G2', text: 'Derived constructor executes immediately following Base, printing "D".', order: 2 },
          { clueId: 'QA1-G3', text: 'Dynamic dispatch calls Derived\'s overridden ping() method, emitting "P2".', order: 3 },
          { clueId: 'QA1-G4', text: 'Virtual destructor in Base ensures Derived destructor runs before Base destructor.', order: 4 },
          { clueId: 'QA1-G5', text: 'Derived destructor emits "~D" followed by Base destructor emitting "~B".', order: 5 },
          { clueId: 'QA1-G6', text: 'Concatenating all stages in order yields exactly 8 characters: BDP2~D~B.', order: 6 }
        ],
        badClues: [
          { clueId: 'QA1-B1', text: 'Non-virtual destructors cause undefined slicing behavior, omitting "~D".', order: 1 },
          { clueId: 'QA1-B2', text: 'Static early binding invokes Base::ping() printing "P1" instead of "P2".', order: 2 },
          { clueId: 'QA1-B3', text: 'Derived constructor runs first before base sub-object initialization.', order: 3 },
          { clueId: 'QA1-B4', text: 'Stack deallocation prints destructors in reverse order "~B~D".', order: 4 },
          { clueId: 'QA1-B5', text: 'The memory leak prevents the delete operator from calling any destructor.', order: 5 },
          { clueId: 'QA1-B6', text: 'Output begins with derived signature "DP2" because obj points to Derived.', order: 6 }
        ]
      },
      {
        questionId: 'QA-2',
        set: 'A',
        setName: 'A',
        title: 'STAGE 02: MUTABLE DEFAULT ARGUMENT PERSISTENCE',
        category: 'Python / Memory Management',
        code: `def probe(val, buffer=[]):
    buffer.append(val)
    return len(buffer)

r1 = probe(10)
r2 = probe(20, [])
r3 = probe(30)
print(f"{r1}{r2}{r3}")`,
        promptText: 'Inspect the default parameter binding in Python function definitions. Predict the 3-digit concatenated integer output printed by print(f"{r1}{r2}{r3}").',
        answerKey: '112',
        directPasskey: 'MUTABLE_DEFAULT',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QA-FINAL',
        nextQuestionIdOnPasskey: 'QA-FINAL',
        nextQuestionIdOnWrong: 'TRAP-A2',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-A2',
        difficulty: 'medium',
        score: 150,
        penalty: 40,
        goodClues: [
          { clueId: 'QA2-G1', text: 'Default argument buffer=[] is evaluated only once when the function is defined, not per call.', order: 1 },
          { clueId: 'QA2-G2', text: 'First call probe(10) appends to the shared default list; length becomes 1.', order: 2 },
          { clueId: 'QA2-G3', text: 'Second call probe(20, []) explicitly passes a fresh list []; its length evaluates to 1.', order: 3 },
          { clueId: 'QA2-G4', text: 'Third call probe(30) uses the original persistent default list which already holds [10].', order: 4 },
          { clueId: 'QA2-G5', text: 'Appending 30 to [10] makes buffer [10, 30] with length 2.', order: 5 },
          { clueId: 'QA2-G6', text: 'Combining r1=1, r2=1, r3=2 produces the exact integer string: 112.', order: 6 }
        ],
        badClues: [
          { clueId: 'QA2-B1', text: 'Python reinitializes default mutable objects on every function call to [].', order: 1 },
          { clueId: 'QA2-B2', text: 'The second call mutates the default buffer list leaving 3 items total.', order: 2 },
          { clueId: 'QA2-B3', text: 'r1, r2, and r3 evaluate to 1, 2, 3 in consecutive numerical progression.', order: 3 },
          { clueId: 'QA2-B4', text: 'Python raises a TypeError when mutating default collection arguments.', order: 4 },
          { clueId: 'QA2-B5', text: 'The output concatenation is 123 due to recursive list pointer references.', order: 5 },
          { clueId: 'QA2-B6', text: 'Default arguments are stored in local function frame and garbage collected.', order: 6 }
        ]
      },
      {
        questionId: 'QA-FINAL',
        set: 'A',
        setName: 'A',
        title: 'FINAL VAULT: SQL INJECTION IMMUNIZATION',
        category: 'Cyber Security / SQL Defense',
        code: `-- Vulnerable query:
-- SELECT * FROM vault WHERE pin = ' + userInput + ' AND active = 1;

-- Security Hardened implementation:
PREPARE stmt FROM 'SELECT * FROM vault WHERE pin = ? AND active = 1';
EXECUTE stmt USING @userInput;`,
        promptText: 'The terminal was breached via "OR 1=1" injection. The architect hardened the gateway by separating SQL compilation from data parameters. What is the standard 2-word technical term for this database defensive mechanism?',
        answerKey: 'PREPARED STATEMENT',
        directPasskey: 'OWASP_TOP1',
        isFinalVault: true,
        nextQuestionIdOnCorrect: 'WIN',
        nextQuestionIdOnPasskey: 'WIN',
        nextQuestionIdOnWrong: 'TRAP-A3',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-A3',
        difficulty: 'hard',
        score: 250,
        penalty: 60,
        goodClues: [
          { clueId: 'QAF-G1', text: 'Also known in database engineering as Parameterized Queries or Prepared Statements.', order: 1 },
          { clueId: 'QAF-G2', text: 'The database engine compiles the SQL execution plan before binding parameter placeholder "?".', order: 2 },
          { clueId: 'QAF-G3', text: 'User input is treated strictly as literal data rather than executable SQL syntax.', order: 3 },
          { clueId: 'QAF-G4', text: 'Primary defense against CWE-89 (SQL Injection) according to OWASP Top 10 guidelines.', order: 4 },
          { clueId: 'QAF-G5', text: 'Employs PREPARE and EXECUTE commands in SQL dialects: PREPARED STATEMENT.', order: 5 },
          { clueId: 'QAF-G6', text: 'Renders malicious \' OR 1=1 -- boolean bypass payloads completely harmless.', order: 6 }
        ],
        badClues: [
          { clueId: 'QAF-B1', text: 'Client-side regex input sanitation is the primary defense against SQL injection.', order: 1 },
          { clueId: 'QAF-B2', text: 'Running queries under root database user prevents schema tampering.', order: 2 },
          { clueId: 'QAF-B3', text: 'Web Application Firewall (WAF) replaces the need for database parameterized queries.', order: 3 },
          { clueId: 'QAF-B4', text: 'Stored procedures without parameterized inputs prevent all injection attacks.', order: 4 },
          { clueId: 'QAF-B5', text: 'Base64 encoding user input stops SQL syntax evaluation.', order: 5 },
          { clueId: 'QAF-B6', text: 'Hashing the entire SQL query string prevents in-memory command tampering.', order: 6 }
        ]
      },

      // ==========================================
      // SET B: C POINTERS, JAVA MEMORY, ALGORITHMS
      // ==========================================
      {
        questionId: 'QB-1',
        set: 'B',
        setName: 'B',
        title: 'STAGE 01: C POINTER ARITHMETIC & NEGATIVE OFFSETS',
        category: 'C / Memory Architecture',
        code: `#include <stdio.h>
int main() {
    int arr[] = {10, 20, 30, 40, 50, 60};
    int *ptr = arr + 2;
    printf("%d", *(ptr + 2) - ptr[-1]);
    return 0;
}`,
        promptText: 'Trace the memory offsets and pointer arithmetic in the C buffer. What is the integer value printed to stdout?',
        answerKey: '30',
        directPasskey: 'OFFSET_0X20',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QB-2',
        nextQuestionIdOnPasskey: 'QB-2',
        nextQuestionIdOnWrong: 'TRAP-B1',
        wrongAnswerAction: 'retry',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-B1',
        difficulty: 'medium',
        score: 150,
        penalty: 30,
        goodClues: [
          { clueId: 'QB1-G1', text: 'arr points to arr[0] (10). Therefore ptr = arr + 2 points to arr[2] (value 30).', order: 1 },
          { clueId: 'QB1-G2', text: 'Pointer addition ptr + 2 advances 2 positions forward to arr[4] (value 50).', order: 2 },
          { clueId: 'QB1-G3', text: 'De-referencing *(ptr + 2) yields integer 50.', order: 3 },
          { clueId: 'QB1-G4', text: 'Negative subscript ptr[-1] accesses 1 position behind: arr[1] (value 20).', order: 4 },
          { clueId: 'QB1-G5', text: 'The arithmetic subtraction calculates: 50 - 20.', order: 5 },
          { clueId: 'QB1-G6', text: 'Evaluating 50 - 20 gives exact result: 30.', order: 6 }
        ],
        badClues: [
          { clueId: 'QB1-B1', text: 'In C, negative pointer subscripting ptr[-1] causes an immediate segmentation fault.', order: 1 },
          { clueId: 'QB1-B2', text: 'arr + 2 multiplies byte size by 8 instead of standard sizeof(int).', order: 2 },
          { clueId: 'QB1-B3', text: '*(ptr + 2) evaluates to 60 because indexing begins at 1.', order: 3 },
          { clueId: 'QB1-B4', text: 'Subtracting pointers calculates memory address difference in hex rather than value.', order: 4 },
          { clueId: 'QB1-B5', text: 'The array decays into a float pointer causing precision truncation.', order: 5 },
          { clueId: 'QB1-B6', text: 'Output evaluates to 10 by subtracting adjacent offset indices.', order: 6 }
        ]
      },
      {
        questionId: 'QB-2',
        set: 'B',
        setName: 'B',
        title: 'STAGE 02: JVM STRING POOL & REFERENCE EQUALITY',
        category: 'Java / JVM Architecture',
        code: `public class SecurityPool {
    public static void main(String[] args) {
        String s1 = "CYBER";
        String s2 = new String("CYBER");
        String s3 = s2.intern();
        boolean b1 = (s1 == s2);
        boolean b2 = (s1 == s3);
        System.out.println(b1 + "-" + b2);
    }
}`,
        promptText: 'Evaluate reference equality (==) versus the JVM String Constant Pool. Predict the exact boolean string printed to stdout (e.g. true-true, false-false, etc.).',
        answerKey: 'false-true',
        directPasskey: 'STRING_INTERN',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QB-FINAL',
        nextQuestionIdOnPasskey: 'QB-FINAL',
        nextQuestionIdOnWrong: 'TRAP-B2',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-B2',
        difficulty: 'medium',
        score: 150,
        penalty: 40,
        goodClues: [
          { clueId: 'QB2-G1', text: 'Operator == compares memory reference addresses, not string character content.', order: 1 },
          { clueId: 'QB2-G2', text: 'Literal "CYBER" is allocated in the String Constant Pool inside JVM Heap.', order: 2 },
          { clueId: 'QB2-G3', text: 'new String("CYBER") explicitly creates a new distinct object on the regular heap.', order: 3 },
          { clueId: 'QB2-G4', text: 'Therefore (s1 == s2) evaluates to false due to differing memory references.', order: 4 },
          { clueId: 'QB2-G5', text: 'Calling s2.intern() returns the canonical reference from the pool, matching s1.', order: 5 },
          { clueId: 'QB2-G6', text: 'Hence (s1 == s3) evaluates to true, resulting in: false-true.', order: 6 }
        ],
        badClues: [
          { clueId: 'QB2-B1', text: 'In Java, == automatically compares string content just like .equals().', order: 1 },
          { clueId: 'QB2-B2', text: 'Both s1 and s2 share the exact same reference because compiler deduplicates strings.', order: 2 },
          { clueId: 'QB2-B3', text: 's2.intern() allocates a brand new third string instance on the JVM stack.', order: 3 },
          { clueId: 'QB2-B4', text: 'The output evaluates to true-true due to automatic string compression.', order: 4 },
          { clueId: 'QB2-B5', text: 'Strings created with new cannot be compared with pool literals without compile error.', order: 5 },
          { clueId: 'QB2-B6', text: 'Output is true-false because interning purges older pool references.', order: 6 }
        ]
      },
      {
        questionId: 'QB-FINAL',
        set: 'B',
        setName: 'B',
        title: 'FINAL VAULT: BINARY EXPONENTIATION COMPLEXITY',
        category: 'Algorithms / Asymptotic Analysis',
        code: `def mod_pow(base, exp, mod):
    result = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            result = (result * base) % mod
        exp = exp // 2
        base = (base * base) % mod
    return result`,
        promptText: 'The security coprocessor computes modular powers. In standard Big-O notation with respect to exponent N, what is the optimal time complexity of this binary exponentiation algorithm?',
        answerKey: 'O(log N)',
        directPasskey: 'BINARY_EXP',
        isFinalVault: true,
        nextQuestionIdOnCorrect: 'WIN',
        nextQuestionIdOnPasskey: 'WIN',
        nextQuestionIdOnWrong: 'TRAP-B3',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-B3',
        difficulty: 'hard',
        score: 250,
        penalty: 60,
        goodClues: [
          { clueId: 'QBF-G1', text: 'In each iteration of the while loop, exponent is halved: exp = exp // 2.', order: 1 },
          { clueId: 'QBF-G2', text: 'The number of loop iterations is proportional to the number of binary bits in N.', order: 2 },
          { clueId: 'QBF-G3', text: 'Halving the problem size at each step is the textbook trait of logarithmic time.', order: 3 },
          { clueId: 'QBF-G4', text: 'Standard Big-O notation format: O(log N).', order: 4 },
          { clueId: 'QBF-G5', text: 'For exponent 1,000,000, this requires ~20 multiplications instead of 1,000,000.', order: 5 },
          { clueId: 'QBF-G6', text: 'Commonly known as Binary Exponentiation or Exponentiation by Squaring.', order: 6 }
        ],
        badClues: [
          { clueId: 'QBF-B1', text: 'Because of the while loop, the algorithm runs in linear time O(N).', order: 1 },
          { clueId: 'QBF-B2', text: 'Squaring the base at each step produces quadratic time complexity O(N^2).', order: 2 },
          { clueId: 'QBF-B3', text: 'The modulo operations introduce factorial overhead O(N!).', order: 3 },
          { clueId: 'QBF-B4', text: 'Space complexity is O(N) due to recursive stack allocation.', order: 4 },
          { clueId: 'QBF-B5', text: 'Division by 2 creates exponential time O(2^N).', order: 5 },
          { clueId: 'QBF-B6', text: 'Constant time O(1) applies because CPU ALU handles modulo in 1 cycle.', order: 6 }
        ]
      },

      // ==========================================
      // SET C: DATA STRUCTURES, CRYPTO, DYNAMIC PROG
      // ==========================================
      {
        questionId: 'QC-1',
        set: 'C',
        setName: 'C',
        title: 'STAGE 01: CIRCULAR RING BUFFER INDEX WRAP',
        category: 'Data Structures / Ring Buffer',
        code: `#include <iostream>
int main() {
    int capacity = 5;
    int front = 3;
    int count = 4;
    // Calculate index where next packet will be inserted:
    int rear = (front + count) % capacity;
    std::cout << rear;
    return 0;
}`,
        promptText: 'A high-speed socket ring buffer has fixed capacity 5. If front = 3 and currently count = 4 packets are stored, what 0-based array index rear will receive the next insertion?',
        answerKey: '2',
        directPasskey: 'RING_BUFFER',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QC-2',
        nextQuestionIdOnPasskey: 'QC-2',
        nextQuestionIdOnWrong: 'TRAP-C1',
        wrongAnswerAction: 'retry',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-C1',
        difficulty: 'medium',
        score: 150,
        penalty: 30,
        goodClues: [
          { clueId: 'QC1-G1', text: 'In a circular queue, rear insertion pointer uses modulo arithmetic: (front + count) % capacity.', order: 1 },
          { clueId: 'QC1-G2', text: 'Calculate addition: front + count = 3 + 4 = 7.', order: 2 },
          { clueId: 'QC1-G3', text: 'Modulo operation computes: 7 % 5.', order: 3 },
          { clueId: 'QC1-G4', text: '7 divided by 5 yields quotient 1 with integer remainder 2.', order: 4 },
          { clueId: 'QC1-G5', text: 'The ring buffer wraps past index 4 back to indices 0, 1, then 2.', order: 5 },
          { clueId: 'QC1-G6', text: 'Single digit integer answer: 2.', order: 6 }
        ],
        badClues: [
          { clueId: 'QC1-B1', text: 'Queues can never wrap around unless elements are first popped from front.', order: 1 },
          { clueId: 'QC1-B2', text: 'Rear index is calculated as front + count which evaluates to 7 directly.', order: 2 },
          { clueId: 'QC1-B3', text: 'Array bounds error occurs when front + count exceeds capacity.', order: 3 },
          { clueId: 'QC1-B4', text: 'Modulo calculation is reversed: capacity % (front + count) which yields 5.', order: 4 },
          { clueId: 'QC1-B5', text: 'Zero-indexed circular queues reset to index 0 on buffer saturation.', order: 5 },
          { clueId: 'QC1-B6', text: 'Next insertion index is 1 due to 1-based indexing in C++ STL collections.', order: 6 }
        ]
      },
      {
        questionId: 'QC-2',
        set: 'C',
        setName: 'C',
        title: 'STAGE 02: DEPRECATED 128-BIT CRYPTOGRAPHIC HASH',
        category: 'Cyber Security / Cryptography',
        code: `# Security audit of legacy authentication digest:
# Hash sample: 79054025255fb1a26e4bc422aef54eb4
# Output length: 32 hexadecimal characters (128 bits)
# Status: Deprecated due to practical collision attacks`,
        promptText: 'The terminal inspects an obsolete 128-bit cryptographic digest generating 32-character hex hashes, now broken by collision attacks (Wang et al., Flame). Enter the 3-character acronym of this algorithm.',
        answerKey: 'MD5',
        directPasskey: 'HASH_COLLISION',
        isFinalVault: false,
        nextQuestionIdOnCorrect: 'QC-FINAL',
        nextQuestionIdOnPasskey: 'QC-FINAL',
        nextQuestionIdOnWrong: 'TRAP-C2',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-C2',
        difficulty: 'medium',
        score: 150,
        penalty: 40,
        goodClues: [
          { clueId: 'QC2-G1', text: '128-bit digest length represented as exactly 32 hexadecimal characters.', order: 1 },
          { clueId: 'QC2-G2', text: 'Designed by Ronald Rivest in 1991 as successor to MD4.', order: 2 },
          { clueId: 'QC2-G3', text: 'Vulnerable to practical collision attacks where two different inputs yield identical hashes.', order: 3 },
          { clueId: 'QC2-G4', text: 'Acronym stands for Message Digest 5.', order: 4 },
          { clueId: 'QC2-G5', text: '3 characters: M - D - 5.', order: 5 },
          { clueId: 'QC2-G6', text: 'Superseded by SHA-256 for secure digital signatures and integrity checks.', order: 6 }
        ],
        badClues: [
          { clueId: 'QC2-B1', text: 'SHA-1 produces 160-bit hashes (40 hex characters).', order: 1 },
          { clueId: 'QC2-B2', text: 'AES is a symmetric block cipher, not a one-way cryptographic digest.', order: 2 },
          { clueId: 'QC2-B3', text: 'RSA is an asymmetric public-key cryptosystem used for key exchange.', order: 3 },
          { clueId: 'QC2-B4', text: 'CRC32 produces 32-bit checksums for transmission error checking.', order: 4 },
          { clueId: 'QC2-B5', text: 'Blowfish is a symmetric encryption algorithm designed by Bruce Schneier.', order: 5 },
          { clueId: 'QC2-B6', text: 'Bcrypt produces 60-character salted hashes with cost factor prefixes.', order: 6 }
        ]
      },
      {
        questionId: 'QC-FINAL',
        set: 'C',
        setName: 'C',
        title: 'FINAL VAULT: RECURRENCE RELATION MEMOIZATION',
        category: 'Python / Recursion & DP',
        code: `memo = {}
def solve(n):
    if n <= 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = solve(n - 1) + 2 * solve(n - 2)
    return memo[n]

print(solve(4))`,
        promptText: 'Analyze the recurrence relation T(n) = T(n-1) + 2*T(n-2) with base cases T(0)=1, T(1)=1. Compute the exact integer output returned by solve(4).',
        answerKey: '11',
        directPasskey: 'MEMOIZE_2026',
        isFinalVault: true,
        nextQuestionIdOnCorrect: 'WIN',
        nextQuestionIdOnPasskey: 'WIN',
        nextQuestionIdOnWrong: 'TRAP-C3',
        wrongAnswerAction: 'trap',
        wrongPasskeyAction: 'penalty',
        trapId: 'TRAP-C3',
        difficulty: 'hard',
        score: 250,
        penalty: 60,
        goodClues: [
          { clueId: 'QCF-G1', text: 'Base cases: solve(0) = 1, solve(1) = 1.', order: 1 },
          { clueId: 'QCF-G2', text: 'solve(2) = solve(1) + 2 * solve(0) = 1 + 2(1) = 3.', order: 2 },
          { clueId: 'QCF-G3', text: 'solve(3) = solve(2) + 2 * solve(1) = 3 + 2(1) = 5.', order: 3 },
          { clueId: 'QCF-G4', text: 'solve(4) = solve(3) + 2 * solve(2) = 5 + 2(3) = 11.', order: 4 },
          { clueId: 'QCF-G5', text: 'Dictionary memo caches subproblems to achieve O(N) linear time complexity.', order: 5 },
          { clueId: 'QCF-G6', text: 'The final solution is an integer between 10 and 15: exactly 11.', order: 6 }
        ],
        badClues: [
          { clueId: 'QCF-B1', text: 'solve(2) computes 1 + 2 = 3, and solve(4) equals 3^2 = 9.', order: 1 },
          { clueId: 'QCF-B2', text: 'Recursion depth exceeds maximum limit triggering a Python RecursionError.', order: 2 },
          { clueId: 'QCF-B3', text: 'The function returns standard Fibonacci number 5 at n=4.', order: 3 },
          { clueId: 'QCF-B4', text: 'Multiplying by 2 inside the recursive call causes infinite looping.', order: 4 },
          { clueId: 'QCF-B5', text: 'Base case returns 0 for n=0 leading to solve(4) = 8.', order: 5 },
          { clueId: 'QCF-B6', text: 'The memo dictionary is cleared after each function return.', order: 6 }
        ]
      }
    ];

    await Question.insertMany(questions);
    console.log('Seeded 9 Questions across Sets A, B, C with 6 Good + 6 Bad clues + Passkeys.');

    // 6. Seed Traps
    const traps = [
      // SET A TRAPS
      {
        trapId: 'TRAP-A1',
        set: 'A',
        name: 'Laser Security Grid',
        description: 'Red lasers fill the corridor! A control panel requires you to solve a math equation to disable the grid.',
        question: 'Solve this equation to bypass the lasers: 5 + 5 * 5 = ?',
        answer: '30',
        successNextId: 'QA-2',
        failureNextId: 'TRAP-A2',
        active: true
      },
      {
        trapId: 'TRAP-A2',
        set: 'A',
        name: 'Auditory Alarm Trap',
        description: 'An alarm is blaring! Enter the bypass code to silence it.',
        question: 'Type the word "override" to quiet the alarm.',
        answer: 'override',
        successNextId: 'QA-FINAL',
        failureNextId: 'TRAP-A3',
        active: true
      },
      {
        trapId: 'TRAP-A3',
        set: 'A',
        name: 'Toxic Gas Chamber',
        description: 'Toxic gas is entering the ventilation corridor! Identify the chemical formula for Water.',
        question: 'Enter the chemical formula for Water (lowercase).',
        answer: 'h2o',
        successNextId: 'QA-FINAL',
        failureNextId: 'TRAP-A1',
        active: true
      },

      // SET B TRAPS
      {
        trapId: 'TRAP-B1',
        set: 'B',
        name: 'Iron Cage Pitfall',
        description: 'A trapdoor opened and dropped you into a holding cage! Solve the arithmetic key.',
        question: 'Solve the equation: 12 - 3 * 2 = ?',
        answer: '6',
        successNextId: 'QB-2',
        failureNextId: 'TRAP-B2',
        active: true
      },
      {
        trapId: 'TRAP-B2',
        set: 'B',
        name: 'Compressing Hydraulic Wall',
        description: 'Hydraulic pistons are compressing the chamber! Issue emergency halt.',
        question: 'Type the command "stop" to halt the gears.',
        answer: 'stop',
        successNextId: 'QB-FINAL',
        failureNextId: 'TRAP-B3',
        active: true
      },
      {
        trapId: 'TRAP-B3',
        set: 'B',
        name: 'Infrared Tripline Array',
        description: 'Invisible infrared beams detected! Enter the bypass integer.',
        question: 'What is 2 + 2 = ?',
        answer: '4',
        successNextId: 'QB-FINAL',
        failureNextId: 'TRAP-B1',
        active: true
      },

      // SET C TRAPS
      {
        trapId: 'TRAP-C1',
        set: 'C',
        name: 'Patrolling Sentry Drone',
        description: 'A robotic sentry drone locks its laser on your terminal! Hack its CPU clock.',
        question: 'Calculate: 3 * 3 * 3 = ?',
        answer: '27',
        successNextId: 'QC-2',
        failureNextId: 'TRAP-C2',
        active: true
      },
      {
        trapId: 'TRAP-C2',
        set: 'C',
        name: 'Digital Security Firewall',
        description: 'A thick digital firewall locked the terminal. Authorize a bypass.',
        question: 'Type the command "bypass" to disable the network wall.',
        answer: 'bypass',
        successNextId: 'QC-FINAL',
        failureNextId: 'TRAP-C3',
        active: true
      },
      {
        trapId: 'TRAP-C3',
        set: 'C',
        name: 'Electromagnetic Field Lock',
        description: 'A magnetic field locked the latch! Solve the calibration math to reverse the polarity.',
        question: 'Solve: 8 / 2 * 2 = ?',
        answer: '8',
        successNextId: 'QC-FINAL',
        failureNextId: 'TRAP-C1',
        active: true
      }
    ];

    await Trap.insertMany(traps);
    console.log('Trap challenges seeded.');

    console.log('Seeding complete! Database is ready for event play.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
