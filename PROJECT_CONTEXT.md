# DoxChat AI - Project Context Summary

> **Last Updated:** 2026-06-27T14:00 IST
> **Purpose:** Feed this file to any AI to resume work on this project quickly.  
> **Project Path:** `/Users/harshparihar/talk-to-my-doc/`

---

## 1. Project Overview

**DoxChat AI** is a full-stack authenticated RAG application where users upload documents and chat with their contents. It is built with React/Vite on the frontend, Express/MongoDB on the backend, Redis/BullMQ for persistent document-processing jobs, and Gemini for embeddings/chat.

### Key Features

- Login, signup, logout, and token-based authenticated API access
- Zod-backed signup/signin validation on both client and server
- User-scoped sessions, documents, and conversations
- Document upload for PDF, DOCX, and TXT
- Upload validation for type, empty files, max size, and bad session IDs
- Persistent Redis/BullMQ queue for document processing
- Separate document worker with controlled concurrency and retries
- Real-time processing progress relayed through Socket.io
- Semantic chunking using Gemini embeddings and cosine similarity breakpoints
- HyDE query expansion
- Follow-up query rewriting for retrieval
- Dynamic retrieval depth by question type
- Hybrid search: vector similarity + MongoDB `$text` + RRF fusion
- SSE streaming chat responses
- Structured RAG prompt for direct answers, summaries, comparisons, missing-info handling, and plain-language explanations
- Document-workspace UI with searchable sessions, horizontal document cards, and responsive mobile navigation
- Session rename/delete menus and accessible confirmation dialogs
- Authenticated PDF/text previews and citation evidence side panel
- Retrieval scope controls for all documents, one selected document, or comparison mode
- Answer copy, regenerate, shorten, simplify, and Markdown export actions
- Selected-session document list with per-document preview/delete/retry controls
- Defensive handling for invalid ObjectIds, duplicate retries, empty chunks, empty retrieval results, stream errors, and too-long questions

---

## 2. Current Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 8 + React Router 7 |
| Styling | Vanilla CSS, responsive editorial document-workspace theme |
| Backend | Express.js + Node.js CommonJS |
| Auth | JWT bearer token + hashed passwords + Zod |
| Database | MongoDB Atlas + Mongoose |
| Queue | Redis + BullMQ |
| Worker | Separate Node worker process |
| AI/LLM | Gemini API |
| Embeddings | `gemini-embedding-2`, 768 dimensions |
| Chat | `gemini-3.5-flash` primary, fallback models configured |
| Real-time | Socket.io for processing progress, SSE for chat streaming |
| File parsing | `pdf-parse`, `mammoth`, Node `fs` |

---

## 3. Environment Configuration

**File:** `server/.env`

```env
# Server
PORT=5001
JWT_SECRET=...
JWT_EXPIRES_IN=7d
REDIS_URL=redis://<host>:<port>
DOCUMENT_WORKER_CONCURRENCY=1
DOCUMENT_JOB_ATTEMPTS=5
DOCUMENT_JOB_BACKOFF_MS=15000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/talk-to-my-doc

# Gemini
GEMINI_API_KEY=<gemini-api-key>
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_EMBEDDING_TASK_TYPE=RETRIEVAL_DOCUMENT
GEMINI_QUERY_EMBEDDING_TASK_TYPE=RETRIEVAL_QUERY
GEMINI_EMBEDDING_RETRIES=4
GEMINI_EMBEDDING_RETRY_BASE_MS=1500
GEMINI_EMBEDDING_BATCH_SIZE=100
GEMINI_CHAT_MODEL=gemini-3.5-flash
GEMINI_CHAT_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-2.5-flash
GEMINI_HYDE_MODEL=gemini-3.1-flash-lite
GEMINI_QUERY_REWRITE_MODEL=gemini-3.1-flash-lite

# RAG
SEMANTIC_CHUNK_THRESHOLD_K=1.0
SEMANTIC_UNIT_TARGET_TOKENS=140
SEMANTIC_UNIT_MAX_SENTENCES=8
MAX_CHUNK_TOKENS=800
MIN_CHUNK_TOKENS=50
CHUNK_INSERT_BATCH_SIZE=500
CONVERSATION_MEMORY_LIMIT=10
RAG_TOP_K_FACTUAL=6
RAG_TOP_K_DEFAULT=8
RAG_TOP_K_BROAD=12
RAG_TOP_K_COMPARE=14
ENABLE_QUERY_REWRITE=true
ENABLE_HYDE=true
ENABLE_HYBRID_SEARCH=true
MAX_QUESTION_LENGTH=4000

# Client
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

Important model finding:

- `ListModels` for the current API key shows `gemini-embedding-2` is available.
- `gemini-embedding-2-flash-001` is **not** available through the current Gemini API key/endpoint; it returned 404 for `batchEmbedContents`.
- `gemini-3.5-flash` is available but can return temporary 503 high-demand errors, so chat fallback models are configured.
- Earlier quota errors explicitly referenced free-tier API quota metrics. Gemini app subscriptions do not automatically upgrade API quota; the AI Studio/Cloud project needs billing/Tier 1 for higher API limits.

---

## 4. File Structure

### Server

```txt
server/
├── .env
├── package.json
├── server.js                         # API server, DB, Socket.io, queue-event relay
├── worker.js                         # BullMQ document worker
├── app.js                            # Express app, CORS, rate limit, routes
├── config/
│   ├── db.js
│   └── socket.js
├── queues/
│   └── documentQueue.js              # BullMQ queue, QueueEvents, Redis connections
├── models/
│   ├── User.js
│   ├── Session.js                    # userId-scoped chat session; one session can contain many documents
│   ├── Document.js                   # userId-scoped document metadata/status
│   ├── Chunk.js                      # chunk text + embedding + text index
│   └── Conversation.js               # userId/sessionId-scoped messages; documentId kept for legacy compatibility
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── errorHandler.js
├── schemas/
│   └── authSchemas.js               # Zod auth validation and normalization
├── services/
│   ├── authService.js
│   ├── parserService.js
│   ├── chunkerService.js
│   ├── embeddingService.js           # raw Gemini SDK single + batch embeddings
│   ├── searchService.js
│   ├── hydeService.js
│   └── ragService.js
├── controllers/
│   ├── authController.js
│   ├── sessionController.js          # session list/get/create/delete + legacy document migration
│   ├── documentController.js         # upload, enqueue, processing pipeline, CRUD
│   └── chatController.js
├── routes/
│   ├── authRoutes.js
│   ├── sessionRoutes.js
│   ├── documentRoutes.js
│   └── chatRoutes.js
└── utils/
    └── objectId.js                   # shared Mongo ObjectId validation
```

### Client

```txt
client/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                       # Auth gate -> ChatPage
    ├── index.css
    ├── context/
    │   ├── AuthContext.jsx
    │   └── DocContext.jsx
    ├── hooks/
    │   ├── useSocket.js
    │   └── useSSE.js
    ├── services/
    │   └── api.js                    # Axios auth headers + API helpers
    ├── schemas/
    │   └── authSchemas.js            # Zod auth form validation
    ├── pages/
    │   ├── AuthPage.jsx              # Login/signup UI
    │   └── ChatPage.jsx
    └── components/
        ├── ChatWindow.jsx
        ├── DocumentList.jsx          # Sessions sidebar + logout footer
        ├── MessageBubble.jsx
        ├── UploadModal.jsx
        ├── SourceCard.jsx
        └── Loader.jsx
```

---

## 5. Current Architecture

### Auth Flow

```txt
Signup/Login
  -> POST /api/auth/signup or /api/auth/login
  -> client validates form payloads with Zod
  -> server validates and normalizes payloads with Zod
  -> server hashes password / verifies password
  -> server signs JWT and returns { user, token }
  -> client stores token in localStorage
  -> Axios and SSE fetches send Authorization: Bearer <token>
  -> requireAuth verifies JWT issuer/audience and attaches req.user
```

All session, document, and chat routes require auth. Sessions, documents, and conversations are filtered by `userId`.

Current auth edge behavior:

- `/api/auth/signin` is an alias for `/api/auth/login`.
- Signup normalizes name and email before storage.
- Login normalizes email before lookup.
- Passwords are limited to 8-128 characters and must include at least one letter and one number.
- Duplicate email conflicts return `409`.
- Login validation and bad credentials return generic invalid-credentials errors.
- Bearer token parsing accepts extra whitespace and case-insensitive `Bearer`.

### Upload + Redis/BullMQ Processing Flow

```txt
User uploads file
  -> POST /api/documents/upload
  -> requireAuth
  -> Multer receives PDF/DOCX/TXT only, max 20 MB
  -> reject empty files
  -> validate optional sessionId before attaching
  -> if sessionId is supplied, attach document to that session
  -> otherwise create a new Session
  -> save upload to local disk or GridFS depending on UPLOAD_STORAGE
  -> Document created with status: uploaded, userId, and sessionId
  -> BullMQ job added to Redis: process-document-<documentId>
  -> HTTP response returns 201

Worker process
  -> npm run worker or npm run worker:dev
  -> BullMQ Worker consumes document-processing queue
  -> processDocument(documentId, { throwOnError: true, onProgress })
  -> parsing
  -> semantic chunking
  -> chunk embeddings
  -> status ready
```

Progress path:

```txt
Worker job.updateProgress(...)
  -> BullMQ QueueEvents in API process
  -> emitProgress(...)
  -> Socket.io processing events
  -> client sidebar/progress state
```

Job reliability:

- Redis persists queued jobs.
- BullMQ retries failed jobs.
- Current attempts: `DOCUMENT_JOB_ATTEMPTS=5`.
- Current backoff: exponential, starting at `DOCUMENT_JOB_BACKOFF_MS=15000`.
- Worker concurrency defaults to `1` to avoid hammering Gemini quota.
- Retry is blocked while the document is already `uploaded`, `parsing`, `chunking`, or `embedding`.
- Local files from rejected uploads are cleaned up.
- Processing clears stale error/chunk metadata when it starts.
- Processing fails clearly if no text, no chunks, or mismatched embeddings are produced.

### Semantic Chunking Flow

```txt
raw text
  -> regex sentence split
  -> pack sentences into semantic units
  -> embed semantic units with Gemini Embedding 2
  -> cosine similarity between adjacent semantic unit embeddings
  -> breakpoints where similarity < mean - k * stddev
  -> group semantic units into semantic chunks
  -> split chunks over ~800 estimated tokens
  -> merge very small chunks
  -> embed final chunk texts
  -> store chunks in MongoDB
```

### Chat/RAG Flow

```txt
POST /api/chat/sessions/:sessionId  (SSE)
  -> requireAuth
  -> validate sessionId and optional conversationId before starting SSE
  -> trim question and enforce MAX_QUESTION_LENGTH
  -> verify session belongs to req.user
  -> load all documents in the session
  -> require at least one document and wait until all session documents are ready
  -> load/create session-scoped conversation
  -> classify question type
  -> rewrite follow-up questions using recent conversation memory
  -> optional HyDE with helper model
  -> embed query with RETRIEVAL_QUERY task type
  -> hybrid search:
       vector similarity over chunks from all ready session documents
       MongoDB $text search
       RRF fusion
       dynamic top-K by question type
  -> Gemini chat generation:
       primary: gemini-3.5-flash
       fallback: gemini-3.1-flash-lite, gemini-2.5-flash
       structured prompt grounds document-specific facts while allowing plain-language explanations for terms found in context
  -> stream tokens over SSE
  -> stream clear error if retrieval/model fails after SSE begins
  -> send sources
  -> save user/assistant messages
```

Legacy document chat endpoints still exist for compatibility, but the active UI uses session chat.

---

## 6. UI State

Current intended UI behavior:

- Unauthenticated users see the login/signup page first.
- Authenticated users see the main chat app.
- Visible product name is `DoxChat AI`.
- Sidebar rows are real sessions. One session can contain multiple uploaded documents.
- Sessions can be searched, renamed, or deleted through a menu.
- Sidebar footer shows the signed-in user and a sign-out icon.
- Chatbox is visible by default even before a document is selected.
- Before upload, the composer opens the upload dialog instead of sending an invalid chat request.
- Upload modal opens from chat input `+`.
- Uploaded document attaches to the current selected session; if no session is selected, upload creates a new session.
- Processing documents auto-refresh in the chat panel until all session documents are ready.
- Chat is disabled until the selected session has at least one document and all documents in that session are ready.
- Chat questions are capped at 4000 characters by default.
- SSE stream errors become a completed failed assistant message instead of an indefinitely streaming bubble.
- Upload modal shows immediate errors for rejected file type, file size, or invalid files.
- Document cards show page count when available, otherwise file size.
- Newer uploaded documents appear before older ones inside the selected session.
- Document cards open an authenticated preview; citations open an evidence panel.
- Chat scope can be all documents, one selected document, or compare mode.
- Answer actions support copy, regenerate, shorter, simple explanation, and Markdown export.
- Processing shows parsing, organizing, indexing, and ready stages with retry on failure.

---

## 7. How To Run Locally

Redis is required now.

### Start Redis

Redis was installed locally with Homebrew:

```bash
brew services start redis
redis-cli ping
```

Expected:

```txt
PONG
```

Alternative if Docker daemon is running:

```bash
docker run -d --name talk-to-my-doc-redis -p 6379:6379 redis:7-alpine
```

### Start App

```bash
# Terminal 1 - API server
cd /Users/harshparihar/talk-to-my-doc/server
npm run dev

# Terminal 2 - Document worker
cd /Users/harshparihar/talk-to-my-doc/server
npm run worker:dev

# Terminal 3 - Client
cd /Users/harshparihar/talk-to-my-doc/client
npm run dev
```

Open:

```txt
http://localhost:5173
```

API:

```txt
http://localhost:5001
```

---

## 8. API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account, return token |
| POST | `/api/auth/login` | Login, return token |
| POST | `/api/auth/signin` | Login alias, return token |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/logout` | Stateless logout acknowledgement |

### Documents

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload file and enqueue processing job |
| GET | `/api/sessions` | List current user's sessions with attached documents |
| POST | `/api/sessions` | Create an empty session |
| GET | `/api/sessions/:id` | Get one session with attached documents |
| DELETE | `/api/sessions/:id` | Delete session, documents, chunks, conversations, and files |
| GET | `/api/documents` | Legacy/current user's documents list |
| GET | `/api/documents/:id` | Get one current-user document |
| POST | `/api/documents/:id/retry` | Retry processing for one document |
| DELETE | `/api/documents/:id` | Delete document, chunks, and file; deletes session only if it was the last document |

### Chat

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/sessions/:sessionId` | Chat with all documents in a session via SSE |
| GET | `/api/chat/sessions/:sessionId/conversations` | List session conversations |
| POST | `/api/chat/:documentId` | Legacy single-document chat via SSE |
| GET | `/api/chat/:documentId/conversations` | Legacy document conversations |
| GET | `/api/chat/conversations/:conversationId` | Get conversation |
| DELETE | `/api/chat/conversations/:conversationId` | Delete conversation |

Chat request:

```json
{
  "question": "What is this document about?",
  "conversationId": "optional-existing-conversation-id"
}
```

SSE response:

```txt
data: {"type":"connected"}
data: {"type":"token","content":"..."}
data: {"type":"sources","sources":[...]}
data: {"type":"done","conversationId":"..."}
```

Chat validation:

- `question` is required, trimmed, and limited by `MAX_QUESTION_LENGTH`.
- `sessionId`, `documentId`, and `conversationId` must be valid Mongo ObjectIds.
- Chat starts only when every document in the selected session is ready.

---

## 9. Current Verified Status

Verified after latest changes:

- Client builds successfully with `npm run build`.
- Changed backend files pass `node --check`.
- Auth signup/login validation uses Zod on both client and server.
- Document/chat/session controllers validate invalid IDs before DB queries or SSE setup.
- Upload edge handling covers empty files, invalid sessions, unsupported types, and cleanup of rejected local uploads.
- Processing edge handling covers stale errors, duplicate retry, empty chunks, and embedding count mismatch.
- SSE chat handling covers empty/too-long questions, invalid IDs, empty retrieval, empty model response, and stream errors.

Observed external API behavior:

- `gemini-3.5-flash` can return temporary 503 high-demand errors.
- Chat fallback successfully handled this during testing.
- Free-tier API quota can still limit large documents or repeated tests.
- Suggested-question generation is intentionally disabled to avoid extra Gemini generation calls during upload.

---

## 10. Larger Document Suitability

Current status: **better, but not fully large-document-ready yet.**

What is now suitable:

- More reliable than fire-and-forget processing.
- Server restarts no longer lose queued upload jobs.
- Worker concurrency is controlled.
- Failed jobs retry with exponential backoff.
- Embedding calls retry transient Gemini errors.
- Processing no longer runs inside the request lifecycle.

Remaining bottleneck:

- The semantic chunker still embeds every sentence before final chunking.
- Large documents are cheaper than before because semantic chunking embeds sentence groups, not every single sentence, but they can still consume significant embedding quota.
- Gemini API quota and model availability remain the limiting factor, especially on free-tier API quota.

Practical assessment:

- Small documents: suitable.
- Medium documents: suitable if quota is available.
- Large single documents: possible, but can still hit embedding quota or take time.
- Many users uploading large docs concurrently: not suitable yet without more throttling and chunking optimization.
- Production-grade large-doc support: needs additional changes listed below.

Recommended next improvements for large documents:

1. Add a non-semantic fallback chunker when embedding quota is hit during sentence embedding.
2. Do coarse section/paragraph chunking before semantic refinement to reduce sentence embedding volume.
3. Cache embeddings by text hash.
4. Store `embeddingModel`, `embeddingDimensions`, semantic-unit settings, and `chunkerVersion` on each document/chunk.
5. Add queue rate limiting for Gemini calls.
6. Add per-user upload/job limits.
7. Add worker dashboard or queue status endpoint.
8. Consider Atlas Vector Search or a local vector index if documents get very large or many chunks per user.

---

## 11. Design Decisions

1. **Redis/BullMQ over in-memory background jobs**  
   Needed for persistence, retries, controlled concurrency, and safer large-doc handling.

2. **Separate worker process**  
   Keeps upload/API responses fast and avoids long-running processing in web handlers.

3. **Worker concurrency defaults to 1**  
   Protects Gemini API quota and avoids parallel large-doc embedding spikes.

4. **Gemini Embedding 2 with 768 dimensions**  
   Keeps retrieval quality reasonable while reducing MongoDB storage and cosine compute compared with full 3072 dimensions.

5. **Raw Gemini SDK for embeddings**  
   Single-query and batch embeddings now use the same SDK/config, including task types and dimensionality.

6. **Chat model fallback**  
   `gemini-3.5-flash` is primary, but fallback handles high-demand 503s.

7. **SSE for chat, Socket.io for processing**  
   SSE fits one-way streamed chat responses. Socket.io fits real-time processing progress updates.

8. **In-memory vector search for now**  
   Current vector search streams chunks with a MongoDB cursor and keeps only top-K in memory. Acceptable for small/medium per-document chunk sets. Revisit with Atlas Vector Search or another vector index if chunks per document or users grow significantly.
