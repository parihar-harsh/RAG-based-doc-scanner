# 📄 Talk to My Doc

> Upload any document. Ask it anything. Get instant, accurate answers.

A full-stack MERN application that lets users upload documents (PDF, DOCX, TXT) and have an interactive chat conversation with their content — powered by Google Gemini AI, semantic chunking, and vector search.

---

## 🎯 Problem Statement

Reading through lengthy documents to find specific information is time-consuming. **Talk to My Doc** solves this by letting users upload a document and ask natural-language questions, receiving precise answers grounded in the document's content.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐  │
│  │  Upload UI  │  │  Chat Interface │  │  Document Manager     │  │
│  └─────┬──────┘  └───────┬────────┘  └──────────┬────────────┘  │
│        │                 │                       │               │
└────────┼─────────────────┼───────────────────────┼───────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express + Node.js)                  │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐  │
│  │  Upload &   │  │  Query Engine  │  │  Document CRUD        │  │
│  │  Processing │  │  (Embed+Search │  │  (List/Delete/View)   │  │
│  │  Pipeline   │  │   +LLM Answer) │  │                       │  │
│  └─────┬──────┘  └───────┬────────┘  └──────────┬────────────┘  │
│        │                 │                       │               │
└────────┼─────────────────┼───────────────────────┼───────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE (MongoDB)                        │
│  ┌────────────────┐  ┌──────────────────────────────────────┐   │
│  │  documents      │  │  chunks (text + vector embeddings)   │   │
│  │  collection     │  │  collection (with Atlas Vector Search│   │
│  │                 │  │  OR in-memory FAISS/HNSWlib index)   │   │
│  └────────────────┘  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Core Workflow

### 1. Document Upload & Ingestion Pipeline

```
User uploads file
       │
       ▼
 ┌─────────────┐
 │ Validate     │  ← check file type, size limits
 │ & Store file │  ← save to /uploads or cloud storage
 └─────┬───────┘
       │
       ▼
 ┌─────────────┐
 │ Parse &      │  ← extract raw text (pdf-parse, mammoth, etc.)
 │ Extract Text │
 └─────┬───────┘
       │
       ▼
 ┌──────────────────┐
 │ Semantic Chunking │  ← split into sentences → embed each
 │                   │     → detect topic boundaries via
 │                   │     cosine similarity drops → group
 │                   │     sentences into coherent chunks
 └───────┬──────────┘
         │
         ▼
 ┌─────────────┐
 │ Generate     │  ← call Gemini text-embedding-004
 │ Chunk        │     per final chunk → 768-dim vectors
 │ Embeddings   │
 └─────┬───────┘
       │
       ▼
 ┌─────────────┐
 │ Store in DB  │  ← save chunks + vectors in MongoDB
 └─────────────┘
```

### 2. Query / Chat Flow (Advanced RAG Pipeline)

```
User asks a question
       │
       ▼
 ┌──────────────────────┐
 │ 1. Load Conversation │  ← fetch last N Q&A pairs from DB
 │    Memory             │     for follow-up context
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 2. HyDE Expansion    │  ← ask Gemini to generate a hypothetical
 │    (optional)         │     answer, then embed THAT instead of
 │                       │     the raw question → better retrieval
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 3. Embed the Query   │  ← Gemini text-embedding-004
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 4. Hybrid Search     │  ← BOTH vector similarity (semantic)
 │                       │     AND MongoDB text search (keyword)
 │                       │     → merge + deduplicate results
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 5. Build Prompt      │  ← system prompt + conversation memory
 │    + Send to Gemini   │     + retrieved chunks + user question
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 6. Hallucination     │  ← LLM instructed to say "I don't have
 │    Guard              │     enough info" if chunks don't answer
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 7. Stream Answer     │  ← Server-Sent Events to frontend
 │    + Save to History  │     + persist Q&A pair in conversations
 └──────────────────────┘
```

---

## 📁 Proposed Folder Structure

```
talk-to-my-doc/
│
├── client/                      # React frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/              # static images, icons
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx       # main chat interface
│   │   │   ├── MessageBubble.jsx    # individual message + source citations
│   │   │   ├── UploadZone.jsx       # drag-and-drop upload
│   │   │   ├── DocumentList.jsx     # sidebar: uploaded docs
│   │   │   ├── SuggestedQuestions.jsx # auto-generated starter questions
│   │   │   ├── SourceCard.jsx       # expandable source chunk card
│   │   │   ├── ProcessingStatus.jsx  # real-time Socket.io progress
│   │   │   ├── Navbar.jsx
│   │   │   └── Loader.jsx          # skeleton/loading states
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # landing / upload page
│   │   │   └── ChatPage.jsx        # chat with document
│   │   ├── context/
│   │   │   └── DocContext.jsx       # React context for doc state
│   │   ├── hooks/
│   │   │   ├── useSocket.js         # Socket.io connection hook
│   │   │   └── useSSE.js            # Server-Sent Events hook for streaming
│   │   ├── services/
│   │   │   └── api.js               # Axios calls to backend
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # Express + Node backend
│   ├── config/
│   │   ├── db.js                    # MongoDB connection
│   │   └── socket.js                # Socket.io setup
│   ├── controllers/
│   │   ├── documentController.js    # upload, list, delete docs
│   │   └── chatController.js        # handle chat queries (SSE streaming)
│   ├── middleware/
│   │   ├── upload.js                # Multer config
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Document.js              # Mongoose schema: doc metadata
│   │   ├── Chunk.js                 # Mongoose schema: text chunks + embeddings
│   │   └── Conversation.js          # Mongoose schema: chat history per document
│   ├── routes/
│   │   ├── documentRoutes.js
│   │   └── chatRoutes.js
│   ├── services/
│   │   ├── parserService.js         # PDF/DOCX/TXT + Gemini Vision for scanned PDFs
│   │   ├── chunkerService.js        # semantic chunking logic
│   │   ├── embeddingService.js      # Gemini embedding API calls
│   │   ├── searchService.js         # hybrid search (vector + text)
│   │   ├── hydeService.js           # HyDE query expansion
│   │   └── ragService.js            # orchestrator: memory + search + LLM + guard
│   ├── uploads/                     # temp storage for uploaded files
│   ├── app.js                       # Express app setup + Socket.io
│   ├── server.js                    # entry point
│   └── package.json
│
├── .env.example                 # environment variable template
├── .gitignore
└── README.md                    # ← you are here
```

---

## 🗄️ Database Design (MongoDB)

### Collection: `documents`

| Field              | Type       | Description                                 |
|--------------------|------------|---------------------------------------------|
| `_id`              | ObjectId   | Auto-generated                              |
| `fileName`         | String     | Original file name                          |
| `fileType`         | String     | `pdf` / `docx` / `txt`                      |
| `fileSize`         | Number     | Size in bytes                               |
| `totalChunks`      | Number     | Number of chunks created                    |
| `status`           | String     | `processing` / `ready` / `failed`           |
| `suggestedQuestions` | [String] | Auto-generated starter questions (3–5)      |
| `pageCount`        | Number     | Number of pages (for PDFs)                  |
| `uploadedAt`       | Date       | Timestamp                                   |

### Collection: `chunks`

| Field          | Type       | Description                                 |
|----------------|------------|---------------------------------------------|
| `_id`          | ObjectId   | Auto-generated                              |
| `documentId`   | ObjectId   | Reference to parent document                |
| `chunkIndex`   | Number     | Order within document (0, 1, 2, …)          |
| `text`         | String     | The chunk's raw text content                |
| `embedding`    | [Number]   | Vector embedding array (768 floats — Gemini `text-embedding-004`) |
| `tokenCount`   | Number     | Token count for this chunk                  |
| `pageNumber`   | Number     | Source page number (for citation)           |
| `sentenceRange`| Object     | `{ start, end }` — sentence indices this chunk spans |

> **Indexes**:
> - **Vector index** on `embedding` (MongoDB Atlas Vector Search or in-memory HNSWlib)
> - **Text index** on `text` (MongoDB full-text search — used for hybrid search keyword leg)

### Collection: `conversations`

| Field          | Type       | Description                                 |
|----------------|------------|---------------------------------------------|
| `_id`          | ObjectId   | Auto-generated                              |
| `documentId`   | ObjectId   | Which document this conversation is about   |
| `messages`     | [Object]   | Array of `{ role, content, sources, timestamp }` |
| `createdAt`    | Date       | When conversation started                   |
| `updatedAt`    | Date       | Last message timestamp                      |

---

## 🔌 API Endpoints

### Document Routes (`/api/documents`)

| Method   | Endpoint              | Description                          |
|----------|-----------------------|--------------------------------------|
| `POST`   | `/api/documents/upload` | Upload a file, triggers processing pipeline |
| `GET`    | `/api/documents`      | List all uploaded documents          |
| `GET`    | `/api/documents/:id`  | Get single document details + status |
| `DELETE` | `/api/documents/:id`  | Delete document and its chunks       |

### Chat Routes (`/api/chat`)

| Method   | Endpoint              | Description                          |
|----------|-----------------------|--------------------------------------|
| `POST`   | `/api/chat/:documentId` | Send a question, get a streamed AI answer (SSE) |
| `POST`   | `/api/chat/multi`     | Query across multiple documents at once |
| `GET`    | `/api/chat/:documentId/history` | Get full conversation history |
| `DELETE` | `/api/chat/:documentId/history` | Clear conversation history   |

### Request/Response Examples

**POST `/api/documents/upload`**
```
Request:  multipart/form-data  { file: <uploaded-file> }
Response: { id: "abc123", fileName: "report.pdf", status: "processing" }
```

**POST `/api/chat/:documentId`** (SSE stream)
```json
// Request
{ "question": "What are the key findings in section 3?", "conversationId": "conv_xyz" }

// SSE Events
data: { "type": "sources", "sources": [{ "chunkIndex": 12, "text": "...", "page": 7 }] }
data: { "type": "token", "content": "The" }
data: { "type": "token", "content": " key" }
...
data: { "type": "done", "fullAnswer": "The key findings in section 3 include..." }
```

**POST `/api/chat/multi`** (multi-document query)
```json
// Request
{ "question": "Compare the financial outlook", "documentIds": ["doc1", "doc2"] }
```

---

## 📦 Key Dependencies

### Backend (`server/`)

| Package              | Purpose                                      |
|----------------------|----------------------------------------------|
| `express`            | Web framework                                |
| `mongoose`           | MongoDB ODM                                  |
| `multer`             | File upload handling                         |
| `pdf-parse`          | Extract text from PDFs                       |
| `mammoth`            | Extract text from DOCX files                 |
| `@google/generative-ai` | Google Gemini SDK — embeddings + chat + vision |
| `socket.io`          | Real-time processing progress updates        |
| `dotenv`             | Environment variable management              |
| `cors`               | Cross-origin requests                        |
| `express-rate-limit`  | Rate limiting for API protection            |

### Frontend (`client/`)

| Package              | Purpose                                      |
|----------------------|----------------------------------------------|
| `react`              | UI library                                   |
| `react-router-dom`   | Client-side routing                          |
| `axios`              | HTTP client                                  |
| `react-dropzone`     | Drag-and-drop file upload                    |
| `react-markdown`     | Render markdown in chat responses            |
| `react-hot-toast`    | Toast notifications                          |
| `socket.io-client`   | Real-time processing progress (client-side)  |

---

## 🧠 Semantic Chunking — How It Works

Your senior is right — **semantic chunking** is the key differentiator over naive fixed-size splitting. Here's why it matters and exactly how it works.

### The Problem with Fixed-Size Chunking

Fixed-size splitting (e.g., "every 500 tokens") is blind to content:
```
...the company reported record earnings in Q3.
────────────── CHUNK BOUNDARY ──────────────
The CEO attributed this growth to international
expansion into Asian markets...
```
This splits a single idea across two chunks. When the user asks *"What drove the company's growth?"*, neither chunk alone contains the full answer → **poor retrieval quality**.

### Semantic Chunking Algorithm

Semantic chunking splits at **topic boundaries** instead of arbitrary positions:

```
Full Document Text
       │
       ▼
 ┌───────────────────┐
 │ 1. Split into      │  ← use regex or sentence tokenizer
 │    Sentences        │     to get [S1, S2, S3, ..., Sn]
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │ 2. Embed EVERY     │  ← call Gemini text-embedding-004
 │    Sentence         │     in batches → [E1, E2, ..., En]
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │ 3. Compute Cosine  │  ← similarity(E1,E2), similarity(E2,E3), ...
 │    Similarity       │     → [0.92, 0.89, 0.41, 0.93, 0.38, ...]
 │    Between Adjacent │
 │    Sentences         │
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │ 4. Detect Drops    │  ← where similarity falls below threshold
 │    (Breakpoints)    │     threshold = mean - (k × std_dev)
 │                     │     e.g., 0.41 and 0.38 are breakpoints
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │ 5. Group Sentences │  ← sentences between breakpoints
 │    Into Chunks      │     form one chunk
 │                     │     [S1,S2,S3] | [S4,S5] | [S6,S7,S8,...]
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │ 6. Enforce Limits  │  ← if chunk > max_tokens → secondary split
 │    (Guard Rails)    │     if chunk < min_tokens → merge with neighbor
 └─────────────────── ┘
```

### Breakpoint Detection — The Math

```
cosine_similarity(A, B) = (A · B) / (‖A‖ × ‖B‖)

similarities = [sim(S1,S2), sim(S2,S3), ..., sim(Sn-1,Sn)]
mean  = average(similarities)
std   = standard_deviation(similarities)

threshold = mean - (k × std)     // k = 1.0 is a good default

breakpoints = indices where similarities[i] < threshold
```

- **k = 0.5** → fewer breakpoints → larger chunks (more context, less precision)
- **k = 1.0** → balanced (recommended default)
- **k = 1.5** → more breakpoints → smaller chunks (more precision, less context)

### Why This Produces Better Results

| Aspect             | Fixed-Size Chunking        | Semantic Chunking              |
|--------------------|---------------------------|--------------------------------|
| Split logic        | Blind character count     | Topic-boundary aware           |
| Chunk coherence    | Often splits mid-idea     | Each chunk = one complete idea |
| Retrieval quality  | Noisy, partial matches    | Precise, relevant matches      |
| Overlap needed?    | Yes (100+ token overlap)  | No — boundaries are natural    |
| Chunk sizes        | Uniform                   | Variable (but bounded)         |

### Guard Rails for Chunk Sizes

Semantic chunking can produce very small or very large chunks. We handle this:
- **Max chunk size**: ~800 tokens (~3200 chars). If a semantic chunk exceeds this, apply a secondary sentence-level split within the chunk.
- **Min chunk size**: ~50 tokens (~200 chars). If a chunk is too small, merge it with the adjacent chunk that has the highest similarity score.

---

## 📐 Handling Documents of Varying Sizes

This is a core requirement. The strategy adapts both the **processing model** and the **semantic chunking approach** by document size.

### Small Documents (< 50 pages / < 100 KB)
- Process **synchronously** during upload
- Semantic chunking runs fast (few sentences to embed)
- Entire pipeline (parse → chunk → embed → store) completes before response

### Medium Documents (50–200 pages / 100 KB – 5 MB)
- Process **asynchronously** after upload
- Return `{ status: "processing" }` immediately
- Frontend **polls** `GET /api/documents/:id` for status updates
- Batch sentence embeddings in groups of 100 for the semantic chunking step

### Large Documents (200+ pages / 5 MB+)
- Same async approach, but with **two-stage batching**:
  - **Stage 1 (Semantic Chunking)**: Embed sentences in batches of 100, compute breakpoints progressively
  - **Stage 2 (Chunk Embeddings)**: Embed final chunks in batches of 20–50
- Progress tracking: `{ status: "processing", phase: "chunking", progress: "340/500 sentences" }`
- **Stream** the file read for very large files to avoid memory spikes

### Size Limit & Validation
- Hard max file size: **20 MB** (via Multer config)
- Validate file type on both client and server side
- Clear error messages for unsupported or oversized files

---

## 🚀 Advanced Improvements (All Feasible with Your Stack)

These 8 improvements use **only** your existing resources — MERN, Gemini API, MongoDB. No extra paid services. Each one makes a significant difference in answer quality, user experience, or reliability.

---

### 1. 💬 Conversational Memory

**Problem**: Without memory, the chat is stateless. If a user asks *"What is the revenue?"* and then follows up with *"How does that compare to last year?"*, the LLM has no idea what "that" refers to.

**Solution**: Load the last N Q&A pairs from the `conversations` collection and inject them into the prompt.

```
System Prompt:
  "You are a document assistant. Answer based on the provided context."

Conversation History (last 5 exchanges):
  User: What is the company's revenue?
  Assistant: The company reported $4.2B in revenue for FY2024...
  User: How does that compare to last year?     ← current question

Retrieved Chunks:
  [chunk about FY2023 revenue: $3.8B...]
  [chunk about YoY growth: 10.5%...]
```

**Implementation**:
- Store every Q&A exchange in the `conversations` collection
- On each new query, fetch the last `CONVERSATION_MEMORY_LIMIT` messages
- Prepend them to the Gemini prompt before the retrieved chunks
- **Cost**: Zero extra API calls — just a DB read + larger prompt

---

### 2. 🔀 Hybrid Search (Vector + Keyword)

**Problem**: Pure vector search is great at semantic similarity, but it can miss **exact keyword matches**. If a user asks *"What does clause 14.3 say?"*, vector search might not match "14.3" well because it's a number, not a semantic concept.

**Solution**: Run **both** searches in parallel and merge results.

```
User query: "What does clause 14.3 say about termination?"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 ┌──────────────┐       ┌──────────────┐
 │ Vector Search │       │ Text Search  │
 │ (semantic)    │       │ (keyword)    │
 │ embed query → │       │ MongoDB $text│
 │ cosine sim    │       │ search on    │
 │ top-5 chunks  │       │ chunk.text   │
 └──────┬───────┘       └──────┬───────┘
        │                       │
        └───────────┬───────────┘
                    ▼
         ┌──────────────────┐
         │ Merge + Dedupe   │  ← Reciprocal Rank Fusion (RRF)
         │ + Re-rank        │     score = Σ 1/(k + rank_i)
         │ Return top-K     │
         └──────────────────┘
```

**Why Reciprocal Rank Fusion (RRF)?**
- Simple formula: `RRF_score = Σ 1/(k + rank)` where k=60 is standard
- No need to normalize scores across different search systems
- A chunk that appears in **both** result sets gets a higher combined score

**Implementation**:
- Create a MongoDB **text index** on `chunks.text` (one line in the schema)
- `searchService.js` runs both searches in parallel with `Promise.all`
- Merge using RRF, deduplicate by `_id`, return top-K
- **Cost**: Zero extra API calls — MongoDB text search is free and built-in

---

### 3. 🎯 HyDE — Hypothetical Document Embeddings

**Problem**: Short or vague queries produce **poor embeddings**. The query *"problems?"* has almost no semantic signal to match against detailed document chunks.

**Solution**: Ask Gemini to generate a hypothetical answer first, then embed **that** instead of the raw question. The hypothetical answer is linguistically closer to the actual answer chunks in vector space → much better retrieval.

```
User query:  "problems?"

Step 1 — Generate hypothetical answer (Gemini, fast model):
  "The document discusses several key problems including supply chain
   disruptions, rising material costs, and regulatory compliance
   challenges that impacted quarterly performance..."

Step 2 — Embed the hypothetical answer (NOT the original query)
Step 3 — Vector search using the hypothetical embedding → better matches
```

**When to use it**:
- **Short queries** (< 5 words): Always beneficial
- **Long, specific queries**: Marginal benefit, can be skipped
- Toggled via `ENABLE_HYDE=true` env var

**Implementation**:
- `hydeService.js`: One Gemini `generateContent` call with a prompt like:
  *"Given this document context, write a paragraph that would answer this question: {query}"*
- Embed the generated paragraph instead of the raw query
- **Cost**: One extra LLM call per query (use `gemini-2.5-flash` — fast and cheap)

---

### 4. 🛡️ Hallucination Guard

**Problem**: If the retrieved chunks don't actually contain the answer, the LLM will confidently make something up. This destroys user trust.

**Solution**: Prompt engineering — no extra API calls needed.

```
System Prompt (append this):

"CRITICAL RULES:
1. Answer ONLY using the provided context chunks. Do not use prior knowledge.
2. If the provided chunks do not contain sufficient information to answer
   the question, respond EXACTLY with:
   '⚠️ I couldn't find enough information in this document to answer
   that question. Try rephrasing or asking about a different topic.'
3. When you DO answer, cite which chunk(s) you used by referencing
   the page number: [Page 7], [Page 12]."
```

**Why this works**:
- Gemini models are instruction-following — they respect guardrail prompts
- The specific phrasing "respond EXACTLY with" gives the LLM a clear escape hatch
- Page-number citations give users a way to verify the answer
- **Cost**: Zero — it's just prompt engineering

---

### 5. 📚 Multi-Document Chat

**Problem**: Users often need to compare information across documents. *"Compare the financials in Q1 report vs Q2 report"* requires searching both documents simultaneously.

**Solution**: Accept an array of `documentIds` and search across all their chunks.

```
POST /api/chat/multi
{
  "question": "Compare the revenue figures",
  "documentIds": ["doc_q1_report", "doc_q2_report"]
}

Search:
  → Vector search across chunks WHERE documentId IN [doc1, doc2]
  → Tag each retrieved chunk with its source document name
  → Prompt includes: "You are comparing across multiple documents.
     Cite which document each piece of information comes from."
```

**Implementation**:
- Modify `searchService.js` to accept `documentIds[]` filter
- Modify the prompt to instruct Gemini to attribute answers to specific documents
- Frontend: Add a multi-select checkbox in the document sidebar
- **Cost**: Same number of API calls — just a wider search scope

---

### 6. 💡 Auto-Suggested Questions

**Problem**: After uploading a document, users often stare at a blank chat wondering what to ask. This kills engagement.

**Solution**: After processing is complete, send the first few chunks to Gemini and ask it to generate 3–5 starter questions.

```
After document processing completes:

Prompt to Gemini:
  "Based on the following excerpts from a document, generate exactly
   5 interesting questions a reader might ask. Return as JSON array.

   Excerpts:
   [first 3 chunks...]"

Response:
  [
    "What were the key findings of the Q3 analysis?",
    "How does the proposed strategy address market risks?",
    "What timeline is suggested for implementation?",
    "Who are the main stakeholders mentioned?",
    "What budget allocation is recommended?"
  ]

→ Store in documents.suggestedQuestions
→ Display as clickable chips in the chat UI
```

**Implementation**:
- Add one Gemini call at the end of `documentController.js` processing pipeline
- Store the result in `documents.suggestedQuestions`
- `SuggestedQuestions.jsx` renders them as clickable chips above the chat input
- **Cost**: One extra LLM call per document (one-time, during upload)

---

### 7. ⚡ Socket.io Real-Time Processing Updates

**Problem**: Polling (`setInterval` + `GET /documents/:id`) is wasteful, laggy (up to N-second delay), and creates unnecessary server load.

**Solution**: Push real-time progress updates via WebSocket using Socket.io.

```
Client                              Server
  │                                    │
  │──── socket.connect() ────────────→│
  │                                    │
  │      (user uploads document)       │
  │                                    │
  │←── { phase: "parsing" } ──────────│
  │←── { phase: "chunking",           │
  │      progress: "45/120 sentences"} │
  │←── { phase: "embedding",          │
  │      progress: "8/15 chunks" }     │
  │←── { phase: "generating",         │
  │      detail: "suggested questions"}│
  │←── { phase: "ready" } ────────────│
  │                                    │
```

**Implementation**:
- `config/socket.js`: Initialize Socket.io with the Express HTTP server
- Emit events at each stage of the processing pipeline in `documentController.js`
- `useSocket.js` hook on client: connect, listen for document-specific events
- `ProcessingStatus.jsx`: Animated progress bar/stepper driven by socket events
- **Cost**: Zero API calls — Socket.io is free, open-source, and runs on your server

---

### 8. 👁️ Gemini Vision for Scanned PDFs

**Problem**: `pdf-parse` extracts text from digital PDFs only. Scanned PDFs (photos of pages, handwritten notes) produce **empty text** because the content is in images, not text layers.

**Solution**: Detect when `pdf-parse` returns little/no text, then fall back to Gemini's vision capability to extract text from the PDF page images.

```
PDF uploaded
     │
     ▼
┌────────────┐
│ pdf-parse  │ → extracted text
└─────┬──────┘
      │
      ▼
┌────────────────────┐     YES    ┌──────────────────────┐
│ text.length < 100  │──────────→│ Convert PDF pages    │
│ per page?          │           │ to images (pdf2pic   │
│ (likely scanned)   │           │ or similar)          │
└────────┬───────────┘           └──────────┬───────────┘
         │ NO                               │
         ▼                                  ▼
  ┌──────────────┐               ┌──────────────────────┐
  │ Use extracted │               │ Send each page image │
  │ text as-is   │               │ to Gemini Vision     │
  └──────────────┘               │ "Extract all text    │
                                 │  from this page"     │
                                 └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ Concatenate extracted │
                                 │ text → proceed with   │
                                 │ semantic chunking     │
                                 └──────────────────────┘
```

**Implementation**:
- In `parserService.js`: After `pdf-parse`, check if text density is below a threshold
- If scanned: convert PDF pages to images using a library like `pdf2pic`
- Send each page image to Gemini with `generateContent({ parts: [image, "Extract all text"] })`
- Concatenate the results and proceed with the normal pipeline
- **Cost**: One Gemini Vision call per page (only for scanned PDFs — digital PDFs skip this entirely)

---

### Improvement Impact Summary

| Improvement              | Improves            | Extra API Cost        | Complexity |
|--------------------------|--------------------|-----------------------|------------|
| Conversational Memory    | Follow-up answers   | None (just DB read)   | Low        |
| Hybrid Search            | Keyword precision   | None (MongoDB built-in)| Medium     |
| HyDE Query Expansion     | Vague query results | 1 LLM call/query      | Medium     |
| Hallucination Guard      | Trust & accuracy    | None (prompt only)    | Low        |
| Multi-Document Chat      | Cross-doc analysis  | None (wider search)   | Medium     |
| Auto-Suggested Questions | User engagement     | 1 LLM call/document   | Low        |
| Socket.io Progress       | UX during upload    | None (WebSocket)      | Medium     |
| Gemini Vision (scanned)  | Document coverage   | 1 Vision call/page*   | High       |

*\*Only triggered for scanned/image-based PDFs*

---

## 🧩 Implementation Phases

### Phase 1 — Foundation (MVP)
- [ ] Initialize MERN project structure (Vite + Express)
- [ ] Set up MongoDB connection & Mongoose schemas (`Document`, `Chunk`, `Conversation`)
- [ ] Build file upload endpoint with Multer (PDF only first)
- [ ] Implement text extraction using `pdf-parse`
- [ ] Implement semantic chunking service (sentence split → embed → breakpoint detection → grouping)
- [ ] Generate chunk embeddings via Gemini `text-embedding-004`
- [ ] Store chunks + embeddings in MongoDB
- [ ] Build basic RAG query: embed question → cosine similarity search → Gemini LLM answer
- [ ] Build minimal React chat UI (upload + chat in one page)
- [ ] Add hallucination guard prompt ("say I don't know if context is insufficient")

### Phase 2 — Core Improvements
- [ ] Add DOCX and TXT support (`mammoth` + `fs`)
- [ ] **Conversational memory** — load last N exchanges into prompt for follow-up questions
- [ ] **Hybrid search** — combine vector similarity + MongoDB text search, merge results
- [ ] **Suggested questions** — auto-generate 3–5 starter questions after document processing
- [ ] Async processing pipeline for large documents
- [ ] **Socket.io** real-time processing progress (replace polling)
- [ ] Document list sidebar with status indicators
- [ ] Source citations with page numbers in chat responses
- [ ] Error handling & validation (file type, size, etc.)

### Phase 3 — Advanced Features
- [ ] **HyDE query expansion** — generate hypothetical answer → embed → search for better retrieval
- [ ] **Multi-document chat** — query across 2+ documents simultaneously
- [ ] **Gemini Vision** for scanned PDFs / image-based documents
- [ ] **Streaming LLM responses** via Server-Sent Events
- [ ] Chat history persistence + clear/export
- [ ] Response caching for repeated questions (MD5 hash lookup)

### Phase 4 — Polish & Production
- [ ] Responsive, polished UI (dark mode, animations, good UX)
- [ ] Rate limiting & input sanitization
- [ ] MongoDB Atlas Vector Search (replace in-memory similarity)
- [ ] Deploy: frontend on Vercel, backend on Render/Railway, DB on Atlas
- [ ] Add environment variable docs and `.env.example`
- [ ] Write usage docs & demo GIF for README

---

## ⚙️ Environment Variables

```env
# Server
PORT=5001
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/talk-to-my-doc
GEMINI_API_KEY=AIza...                    # Gemini API key
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_CHAT_MODEL=gemini-2.5-flash         # fast + capable for RAG answers
SEMANTIC_CHUNK_THRESHOLD_K=1.0             # breakpoint sensitivity (0.5–1.5)
CONVERSATION_MEMORY_LIMIT=10               # number of past Q&A pairs in context
ENABLE_HYDE=true                           # enable HyDE query expansion
ENABLE_HYBRID_SEARCH=true                  # enable keyword + vector search

# Client
# Optional for production or non-proxy runs.
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

---

## 🚀 How to Run

```bash
# 1. Go to the project
cd /Users/harshparihar/talk-to-my-doc

# 2. Install server dependencies
cd server && npm install

# 3. Install client dependencies
cd ../client && npm install

# 4. Set up server environment variables
cd ../server
cp ../.env.example .env
# Fill in MONGODB_URI, GEMINI_API_KEY, and keep PORT=5001

# 5. Start the backend
npm run dev

# 6. Start the frontend (in a new terminal)
cd ../client && npm run dev

# 7. Open the app
# http://localhost:5173
```

---

## 🧭 Tech Decisions & Rationale

| Decision                          | Rationale                                                                 |
|-----------------------------------|---------------------------------------------------------------------------|
| **Google Gemini API**             | You already have access via Gemini AI Pro; `text-embedding-004` for embeddings + `gemini-2.5-flash` for chat + vision for scanned docs — no extra costs |
| **Semantic Chunking**             | Splits at topic boundaries → coherent chunks → dramatically better retrieval quality |
| **Hybrid Search**                 | Vector search misses exact keywords; text search misses semantic meaning — combining both catches everything |
| **HyDE Query Expansion**          | Vague questions get poor embeddings; generating a hypothetical answer first produces embeddings closer to the actual answer in vector space |
| **Conversational Memory**         | Without it, follow-up questions like "tell me more" or "what about section 4?" completely fail |
| **Hallucination Guard**           | Prompt engineering to force the LLM to admit when retrieved chunks don't contain the answer — builds user trust |
| **Socket.io for progress**        | Polling is wasteful and laggy; WebSocket push gives instant, real-time processing updates |
| **MongoDB for everything**        | Keep the stack simple — Atlas Vector Search + full-text search avoids separate vector/search databases |
| **RAG over fine-tuning**          | No training needed; works with any document instantly                     |
| **Vite for React**                | Fast dev server, simple config, modern DX                                 |

---

## 📌 Notes

- This project uses the **RAG (Retrieval-Augmented Generation)** pattern — the LLM never sees the full document, only the most relevant chunks retrieved via hybrid search.
- No user authentication is planned for MVP. Can be added in a future phase.
- **Semantic chunking costs more API calls during ingestion** (every sentence is embedded to detect breakpoints), but this is a one-time cost per document. The payoff is significantly better retrieval at query time.
- **HyDE adds one extra LLM call per query** — it can be toggled off via env var for cost-sensitive deployments.
- The `k` threshold parameter for breakpoint detection is configurable via env var — tune it per your use case.
- The architecture is model-agnostic. If you later want to swap Gemini for another provider (Cohere, local Ollama, etc.), only `embeddingService.js` and `ragService.js` need changes.
- All 8 advanced improvements use **only your existing resources** (MERN + Gemini API + MongoDB). No additional paid services required.
