# Talk to My Doc — Project Context Summary

> **Last Updated:** 2026-06-13T11:55 IST  
> **Purpose:** Feed this file to any AI to resume work on this project quickly.  
> **Project Path:** `/Users/harshparihar/talk-to-my-doc/`

---

## 1. Project Overview

**Talk to My Doc** is a full-stack authenticated RAG application where users upload documents and chat with their contents. It is built with React/Vite on the frontend, Express/MongoDB on the backend, Redis/BullMQ for persistent document-processing jobs, and Gemini for embeddings/chat.

### Key Features

- Login, signup, logout, and token-based authenticated API access
- User-scoped sessions, documents, and conversations
- Document upload for PDF, DOCX, and TXT
- Persistent Redis/BullMQ queue for document processing
- Separate document worker with controlled concurrency and retries
- Real-time processing progress relayed through Socket.io
- Semantic chunking using Gemini embeddings and cosine similarity breakpoints
- HyDE query expansion
- Hybrid search: vector similarity + MongoDB `$text` + RRF fusion
- SSE streaming chat responses
- Structured RAG prompt for direct answers, summaries, comparisons, missing-info handling, and plain-language explanations
- ChatGPT-style UI with sessions sidebar and default-visible chatbox

---

## 2. Current Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 8 + React Router 7 |
| Styling | Vanilla CSS, dark ChatGPT-inspired theme |
| Backend | Express.js + Node.js CommonJS |
| Auth | Custom signed bearer token + hashed passwords |
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
REDIS_URL=redis://127.0.0.1:6379
DOCUMENT_WORKER_CONCURRENCY=1
DOCUMENT_JOB_ATTEMPTS=5
DOCUMENT_JOB_BACKOFF_MS=15000
MONGODB_URI=mongodb+srv://...@cluster0.seoralq.mongodb.net/talk-to-my-doc?appName=Cluster0

# Gemini
GEMINI_API_KEY=AQ.Ab8RN6JzF-...
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_EMBEDDING_TASK_TYPE=RETRIEVAL_DOCUMENT
GEMINI_QUERY_EMBEDDING_TASK_TYPE=RETRIEVAL_QUERY
GEMINI_EMBEDDING_RETRIES=4
GEMINI_EMBEDDING_RETRY_BASE_MS=1500
GEMINI_CHAT_MODEL=gemini-3.5-flash
GEMINI_CHAT_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-2.5-flash
GEMINI_HYDE_MODEL=gemini-3.1-flash-lite

# RAG
SEMANTIC_CHUNK_THRESHOLD_K=1.0
CONVERSATION_MEMORY_LIMIT=10
ENABLE_HYDE=true
ENABLE_HYBRID_SEARCH=true

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
└── routes/
    ├── authRoutes.js
    ├── sessionRoutes.js
    ├── documentRoutes.js
    └── chatRoutes.js
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
  -> server hashes password / verifies password
  -> server returns { user, token }
  -> client stores token in localStorage
  -> Axios and SSE fetches send Authorization: Bearer <token>
  -> protected routes attach req.user
```

All session, document, and chat routes require auth. Sessions, documents, and conversations are filtered by `userId`.

### Upload + Redis/BullMQ Processing Flow

```txt
User uploads file
  -> POST /api/documents/upload
  -> requireAuth
  -> Multer saves file to server/uploads/
  -> if sessionId is supplied, attach document to that session
  -> otherwise create a new Session
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

### Semantic Chunking Flow

```txt
raw text
  -> regex sentence split
  -> embed each sentence with Gemini Embedding 2
  -> cosine similarity between adjacent sentence embeddings
  -> breakpoints where similarity < mean - k * stddev
  -> group sentences into semantic chunks
  -> split chunks over ~800 estimated tokens
  -> merge very small chunks
  -> embed final chunk texts
  -> store chunks in MongoDB
```

### Chat/RAG Flow

```txt
POST /api/chat/sessions/:sessionId  (SSE)
  -> requireAuth
  -> verify session belongs to req.user
  -> load all documents in the session
  -> require at least one document and wait until all session documents are ready
  -> load/create session-scoped conversation
  -> optional HyDE with helper model
  -> embed query with RETRIEVAL_QUERY task type
  -> hybrid search:
       vector similarity over chunks from all ready session documents
       MongoDB $text search
       RRF fusion
  -> Gemini chat generation:
       primary: gemini-3.5-flash
       fallback: gemini-3.1-flash-lite, gemini-2.5-flash
       structured prompt grounds document-specific facts while allowing plain-language explanations for terms found in context
  -> stream tokens over SSE
  -> send sources
  -> save user/assistant messages
```

Legacy document chat endpoints still exist for compatibility, but the active UI uses session chat.

---

## 6. UI State

Current intended UI behavior:

- Unauthenticated users see the login/signup page first.
- Authenticated users see the main chat app.
- Sidebar title is `Sessions`, not `Documents`.
- Sidebar rows are real sessions. One session can contain multiple uploaded documents.
- Sidebar footer shows signed-in user and `Logout`.
- Chatbox is visible by default even before a document is selected.
- If user sends a message before uploading/selecting a doc, assistant replies: `Push doc first`.
- Upload modal opens from chat input `+`.
- Uploaded document attaches to the current selected session; if no session is selected, upload creates a new session.
- Processing documents auto-refresh in the chat panel until all session documents are ready.
- Chat is disabled until the selected session has at least one document and all documents in that session are ready.

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

---

## 9. Current Verified Status

Verified after latest changes:

- Redis installed with Homebrew and running locally.
- `redis-cli ping` returns `PONG`.
- API server starts on `5001`.
- Worker starts with `DOCUMENT_WORKER_CONCURRENCY=1`.
- Client builds successfully with `npm run build`.
- Auth signup/login/me works.
- Anonymous document routes reject with `Authentication required`.
- Authenticated document upload works.
- Upload enqueues a BullMQ job.
- Worker consumed the queued job.
- Worker completed parse -> semantic chunk -> embed -> ready.
- Document status reached `ready`.
- SSE chat on the queued document streamed a grounded answer.
- Sources returned with the answer.
- Smoke-test documents and local smoke-test files were deleted after verification.

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
- Large documents with hundreds/thousands of sentences can still consume many embedding requests.
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
4. Store `embeddingModel`, `embeddingDimensions`, and `chunkerVersion` on each document/chunk.
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
   Acceptable for small/medium per-document chunk sets. Revisit if chunks per document or users grow significantly.
