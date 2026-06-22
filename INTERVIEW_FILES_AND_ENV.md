# Talk to My Doc - Files And Environment Explanation

Use this file to explain the repository structure and environment variables in an interview.

## How To Explain The Repo

This project is split into:

- `client/`: React frontend.
- `server/`: Express API, worker, database models, RAG services, and queues.
- root deployment files: Docker, Render, README, and environment examples.

The frontend lets the user log in, upload documents, select sessions, and chat. The backend owns authentication, document processing, retrieval, streaming, and persistence.

## Root Files

| File | Meaning |
| --- | --- |
| `README.md` | Main project documentation: features, architecture, setup, deployment, and runtime flow. |
| `PROJECT_CONTEXT.md` | AI handoff/context file that summarizes the current project state, architecture, decisions, and known limitations. |
| `INTERVIEW_TECH_EXPLANATION.md` | Interview notes explaining each technology used and why it was chosen. |
| `INTERVIEW_FILES_AND_ENV.md` | This file. Explains file structure and environment variables. |
| `.env.example` | Safe template showing required environment variables without real secrets. |
| `.gitignore` | Tells Git which files/folders not to track, such as dependencies, builds, uploads, and real `.env` files. |
| `.dockerignore` | Tells Docker what not to copy into images, keeping builds smaller and safer. |
| `Dockerfile` | Multi-stage Docker build for frontend, API server, and worker images. |
| `render.yaml` | Render production deployment config for API, worker, and Redis/key-value service. |
| `render-free.yaml` | Alternate Render config likely optimized for free-tier deployment constraints. |
| `render-env.txt` | Local helper/reference env file. It is currently untracked and should not contain committed secrets. |
| `demo.txt` | Small local demo/test document. |

## Dockerfile

| Section | Meaning |
| --- | --- |
| `client-deps` | Installs frontend dependencies with `npm ci`. |
| `client-build` | Builds the React/Vite client into static files. |
| `server-deps` | Installs production backend dependencies only. |
| `runner` | Creates final runtime image with server code and built frontend. |
| `worker` | Docker target that starts `node worker.js`. |
| `api` | Docker target that starts `node server.js`. |

Interview explanation:

"The Dockerfile is multi-stage so dependencies and builds are separated. It can produce an API image and a worker image from the same codebase."

## Render Files

| File | Meaning |
| --- | --- |
| `render.yaml` | Defines production services: web API, worker, and Redis/key-value instance. |
| `render-free.yaml` | Similar deployment config, likely adjusted for free Render limits. |

Important Render idea:

The API and worker are separate services. Because they may not share a filesystem, production uses `UPLOAD_STORAGE=gridfs` so both services can access uploaded files through MongoDB GridFS.

## Client Files

### Client Root

| File | Meaning |
| --- | --- |
| `client/package.json` | Frontend dependencies and scripts: `dev`, `build`, and `preview`. |
| `client/package-lock.json` | Locked frontend dependency versions for reproducible installs. |
| `client/index.html` | HTML entry point where Vite mounts the React app. |
| `client/vite.config.js` | Vite configuration for React build/dev behavior. |
| `client/vercel.json` | Vercel-specific frontend deployment config. |
| `client/public/favicon.svg` | Browser tab icon. |
| `client/public/icons.svg` | Shared SVG icon asset file. |

### Client Source

| File | Meaning |
| --- | --- |
| `client/src/main.jsx` | React entry point. Mounts the app into the DOM and wraps providers. |
| `client/src/App.jsx` | Top-level app component. Handles auth gate and decides whether to show auth page or chat app. |
| `client/src/index.css` | Main CSS file for the full frontend UI and dark theme. |

### Client Pages

| File | Meaning |
| --- | --- |
| `client/src/pages/AuthPage.jsx` | Login/signup page UI. |
| `client/src/pages/ChatPage.jsx` | Main authenticated app layout with sidebar, chat window, and upload modal. |

### Client Components

| File | Meaning |
| --- | --- |
| `client/src/components/ChatWindow.jsx` | Main chat UI. Handles composer, streaming messages, document status, retry/delete controls, and session document list. |
| `client/src/components/DocumentList.jsx` | Sidebar for sessions, selected session state, upload button, and logout footer. |
| `client/src/components/UploadModal.jsx` | Modal for uploading documents into the current session or a new session. |
| `client/src/components/MessageBubble.jsx` | Renders user/assistant messages and attached sources. |
| `client/src/components/SourceCard.jsx` | Shows retrieved source snippets returned by the RAG pipeline. |
| `client/src/components/Loader.jsx` | Reusable loading/spinner UI. |

### Client Context

| File | Meaning |
| --- | --- |
| `client/src/context/AuthContext.jsx` | Stores authenticated user/token state and exposes login, signup, logout, and current-user loading. |
| `client/src/context/DocContext.jsx` | Stores sessions/documents, selected session, messages, conversation ID, and document/session actions. |

### Client Hooks

| File | Meaning |
| --- | --- |
| `client/src/hooks/useSSE.js` | Handles streaming chat responses from the backend. Parses streamed token/source/done/error events. |
| `client/src/hooks/useSocket.js` | Connects to Socket.io and listens for document processing progress. |

### Client Services

| File | Meaning |
| --- | --- |
| `client/src/services/api.js` | Central frontend API layer. Configures Axios, auth headers, REST calls, upload calls, and streaming chat fetch calls. |

## Server Files

### Server Root

| File | Meaning |
| --- | --- |
| `server/package.json` | Backend dependencies and scripts. Important scripts: `start`, `dev`, `worker`, `worker:dev`, and `start:all`. |
| `server/package-lock.json` | Locked backend dependency versions. |
| `server/server.js` | Main API server entry point. Loads env, validates production env, connects MongoDB, creates HTTP server, starts Socket.io, starts queue event relay, and listens on `PORT`. |
| `server/app.js` | Express app setup. Adds CORS, body parsers, static uploads, rate limiting, health route, API routes, production frontend serving, 404 handler, and error handler. |
| `server/worker.js` | BullMQ worker entry point. Connects MongoDB and Redis, consumes document-processing jobs, and calls `processDocument`. |
| `server/startAll.js` | Local helper to start multiple app processes together. |
| `server/uploads/` | Local upload directory used when `UPLOAD_STORAGE=local`. In production, GridFS is preferred when API and worker are separate. |

### Server Config

| File | Meaning |
| --- | --- |
| `server/config/db.js` | Connects to MongoDB through Mongoose. |
| `server/config/env.js` | Validates required production environment variables. |
| `server/config/cors.js` | Determines allowed frontend origin for CORS. |
| `server/config/socket.js` | Initializes Socket.io and provides progress-emitting helpers. |

### Server Routes

| File | Meaning |
| --- | --- |
| `server/routes/authRoutes.js` | Maps auth endpoints like signup, login, me, and logout. |
| `server/routes/sessionRoutes.js` | Maps session endpoints: list, create, get, delete. |
| `server/routes/documentRoutes.js` | Maps document endpoints: upload, list, get, retry, delete. |
| `server/routes/chatRoutes.js` | Maps chat endpoints for session chat, legacy document chat, and conversation management. |

Interview explanation:

"Routes only define HTTP paths and attach middleware/controllers. The real business logic is in controllers and services."

### Server Controllers

| File | Meaning |
| --- | --- |
| `server/controllers/authController.js` | Handles signup, login, logout response, and current-user response. |
| `server/controllers/sessionController.js` | Handles session listing, hydration with attached documents, session creation, deletion, and legacy document migration into sessions. |
| `server/controllers/documentController.js` | Handles upload, retry, delete, list/get documents, and the background `processDocument` pipeline. |
| `server/controllers/chatController.js` | Handles SSE chat endpoints and conversation endpoints. Streams tokens, sources, done, and errors. |

### Server Middleware

| File | Meaning |
| --- | --- |
| `server/middleware/auth.js` | Verifies JWT bearer token and attaches authenticated user info to `req.user`. |
| `server/middleware/upload.js` | Configures Multer for PDF/DOCX/TXT uploads and file limits. |
| `server/middleware/errorHandler.js` | Central Express error response handler. |

### Server Models

| File | Meaning |
| --- | --- |
| `server/models/User.js` | User account schema, including email/name/password hash fields. |
| `server/models/Session.js` | Chat session schema. A session belongs to a user and can contain many documents. |
| `server/models/Document.js` | Uploaded document metadata, storage location, status, errors, chunk/token counts, and processing metadata. |
| `server/models/Chunk.js` | RAG chunk schema. Stores chunk text, embedding vector, token count, sentence range, and text index. |
| `server/models/Conversation.js` | Chat history schema. Stores messages for a session or legacy document chat. |

### Server Services

| File | Meaning |
| --- | --- |
| `server/services/authService.js` | Auth business logic such as password hashing/checking and JWT creation. |
| `server/services/parserService.js` | Extracts text from uploaded PDF, DOCX, and TXT files. |
| `server/services/chunkerService.js` | Semantic chunking logic: sentence splitting, semantic units, embedding-based breakpoints, chunk sizing, and merging. |
| `server/services/embeddingService.js` | Gemini embedding calls, retries, batching, dimensionality, and cosine similarity helper. |
| `server/services/searchService.js` | Vector search, MongoDB text search, and reciprocal rank fusion for hybrid retrieval. |
| `server/services/hydeService.js` | Generates hypothetical answers for HyDE retrieval. |
| `server/services/ragService.js` | Main RAG pipeline: load docs, load memory, rewrite query, optional HyDE, embed query, retrieve chunks, prompt Gemini, stream answer, save conversation. |
| `server/services/fileStorageService.js` | Saves, reads, and deletes uploaded files from local disk or MongoDB GridFS. |

### Server Queue

| File | Meaning |
| --- | --- |
| `server/queues/documentQueue.js` | Creates BullMQ queue, Redis connections, queue event listeners, retry behavior, and progress relay helpers. |

## Server Scripts

From `server/package.json`:

| Script | Meaning |
| --- | --- |
| `npm start` | Runs production API server with `node server.js`. |
| `npm run dev` | Runs API server in Node watch mode for local development. |
| `npm run worker` | Runs production document worker with `node worker.js`. |
| `npm run worker:dev` | Runs worker in Node watch mode for local development. |
| `npm run start:all` | Runs local helper that starts combined processes. |

## Client Scripts

From `client/package.json`:

| Script | Meaning |
| --- | --- |
| `npm run dev` | Starts Vite development server. |
| `npm run build` | Builds frontend static files for production. |
| `npm run preview` | Locally previews the production frontend build. |

## Environment Variables

Use `.env.example` as the safe source of truth. Do not commit real `.env` secrets.

### Server Environment

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | Runtime mode. `production` enables production checks and defaults. |
| `PORT` | Port where Express API listens, commonly `5001`. |
| `SERVE_CLIENT` | If not `false`, Express can serve built React files from `server/public`. Useful for single-container Docker deployment. |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS, such as the deployed frontend URL. |
| `MONGODB_URI` | MongoDB Atlas connection string. Stores users, sessions, documents, chunks, conversations, and GridFS uploads if enabled. |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens. Must be long and private. |
| `JWT_EXPIRES_IN` | Token lifetime, for example `7d`. |

### Upload Storage Environment

| Variable | Meaning |
| --- | --- |
| `UPLOAD_STORAGE` | Chooses upload storage backend. `local` stores files on disk; `gridfs` stores files in MongoDB GridFS. |

When to use each:

- `local`: easier for development when API and worker run on the same machine.
- `gridfs`: better for production when API and worker are separate services without shared disk.

### Redis / BullMQ Environment

| Variable | Meaning |
| --- | --- |
| `REDIS_URL` | Redis connection string used by BullMQ. |
| `DOCUMENT_WORKER_CONCURRENCY` | Number of document jobs the worker processes at the same time. Current default is `1` to protect Gemini quota. |
| `DOCUMENT_JOB_ATTEMPTS` | Number of retry attempts for failed document-processing jobs. |
| `DOCUMENT_JOB_BACKOFF_MS` | Base delay for exponential retry backoff. |

Interview explanation:

"Redis stores queue state, not app data. BullMQ uses it to track pending, active, failed, retried, and completed jobs."

### Gemini Environment

| Variable | Meaning |
| --- | --- |
| `GEMINI_API_KEY` | Secret API key for Gemini calls. |
| `GEMINI_EMBEDDING_MODEL` | Embedding model used for document chunks and queries, currently `gemini-embedding-2`. |
| `GEMINI_EMBEDDING_DIMENSIONS` | Output vector size. Current value is `768` to reduce storage and similarity-computation cost. |
| `GEMINI_EMBEDDING_TASK_TYPE` | Task type for document/chunk embeddings, usually `RETRIEVAL_DOCUMENT`. |
| `GEMINI_QUERY_EMBEDDING_TASK_TYPE` | Task type for user query embeddings, usually `RETRIEVAL_QUERY`. |
| `GEMINI_EMBEDDING_RETRIES` | Number of retry attempts for transient embedding failures. |
| `GEMINI_EMBEDDING_RETRY_BASE_MS` | Base delay between embedding retries. |
| `GEMINI_EMBEDDING_BATCH_SIZE` | Number of texts sent per embedding batch. |
| `GEMINI_CHAT_MODEL` | Primary chat model for final answer generation. |
| `GEMINI_CHAT_FALLBACK_MODELS` | Comma-separated fallback chat models if the primary model fails before streaming. |
| `GEMINI_HYDE_MODEL` | Model used to generate hypothetical answers for HyDE retrieval. |
| `GEMINI_QUERY_REWRITE_MODEL` | Model used to rewrite follow-up questions into standalone retrieval queries. |

Model count from current config:

The app uses 4 unique Gemini model names:

1. `gemini-embedding-2`
2. `gemini-3.5-flash`
3. `gemini-3.1-flash-lite`
4. `gemini-2.5-flash`

Those models are used across these roles:

| Env Variable | Model Role |
| --- | --- |
| `GEMINI_EMBEDDING_MODEL` | Embeds document chunks and query text. |
| `GEMINI_CHAT_MODEL` | Primary model for final streamed answers. |
| `GEMINI_CHAT_FALLBACK_MODELS` | Backup answer-generation models. |
| `GEMINI_HYDE_MODEL` | Generates hypothetical answers for better retrieval. |
| `GEMINI_QUERY_REWRITE_MODEL` | Rewrites follow-up questions into standalone search queries. |

Interview explanation:

"There are four unique model names, but more than four model roles. The same lightweight model can be reused for helper tasks like HyDE and query rewriting, while a stronger model is used for final answers and an embedding model is used for retrieval."

### RAG / Chunking Environment

| Variable | Meaning |
| --- | --- |
| `SEMANTIC_CHUNK_THRESHOLD_K` | Controls how aggressively semantic breakpoints are detected. Higher values usually mean fewer breakpoints. |
| `SEMANTIC_UNIT_TARGET_TOKENS` | Target size for semantic units before final chunk grouping. |
| `SEMANTIC_UNIT_MAX_SENTENCES` | Maximum sentences per semantic unit. |
| `MAX_CHUNK_TOKENS` | Upper target for final chunk size. Oversized chunks are split. |
| `MIN_CHUNK_TOKENS` | Lower target for final chunk size. Very small chunks may be merged. |
| `CHUNK_INSERT_BATCH_SIZE` | Number of chunk documents inserted into MongoDB per batch. |
| `CONVERSATION_MEMORY_LIMIT` | Number of recent conversation exchanges used as memory. |
| `RAG_TOP_K_FACTUAL` | Number of chunks retrieved for factual questions. |
| `RAG_TOP_K_DEFAULT` | Number of chunks retrieved for normal questions. |
| `RAG_TOP_K_BROAD` | Number of chunks retrieved for broad summary-style questions. |
| `RAG_TOP_K_COMPARE` | Number of chunks retrieved for comparison questions. |
| `ENABLE_QUERY_REWRITE` | Enables follow-up query rewriting. |
| `ENABLE_HYDE` | Enables HyDE retrieval for short/vague questions. |
| `ENABLE_HYBRID_SEARCH` | Enables vector + keyword hybrid retrieval. If false, retrieval uses vector search only. |

### Client Environment

These variables are read by Vite and must start with `VITE_` to be exposed to frontend code.

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | Backend API base URL used by the browser, for example `http://localhost:5001/api`. |
| `VITE_SOCKET_URL` | Socket.io server URL, for example `http://localhost:5001`. |

Interview explanation:

"Backend secrets like `JWT_SECRET` and `GEMINI_API_KEY` stay on the server. Frontend variables must use the `VITE_` prefix because Vite only exposes prefixed variables to browser code."

## Environment Variables By Runtime

### API Server Needs

- `PORT`
- `CLIENT_ORIGIN`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REDIS_URL`
- Gemini variables for chat, query rewrite, HyDE, and embeddings
- RAG retrieval variables
- `UPLOAD_STORAGE`

### Worker Needs

- `MONGODB_URI`
- `REDIS_URL`
- `GEMINI_API_KEY`
- Gemini embedding variables
- Chunking variables
- `UPLOAD_STORAGE`
- `DOCUMENT_WORKER_CONCURRENCY`

### Frontend Needs

- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Interview-Friendly File Flow

This section explains the files in the same order a user experiences the app.

## User Operating Flow With Files

### 1. User Opens The App

User action:

The user opens the frontend in the browser.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/index.html` | Browser loads this HTML shell. |
| `client/src/main.jsx` | Mounts the React app into the page. |
| `client/src/App.jsx` | Decides whether to show login/signup or the main chat app. |
| `client/src/context/AuthContext.jsx` | Checks whether a saved JWT token exists and loads the current user. |
| `client/src/services/api.js` | Sends `GET /api/auth/me` if a token exists. |
| `server/app.js` | Registers the `/api/auth` routes. |
| `server/routes/authRoutes.js` | Maps `/me` to the auth controller. |
| `server/middleware/auth.js` | Verifies the JWT token. |
| `server/controllers/authController.js` | Returns current user details. |
| `server/models/User.js` | Reads user data from MongoDB. |

Interview explanation:

"When the app opens, React mounts through `main.jsx`, `App.jsx` checks auth state, and `AuthContext` asks the backend who the current user is if a token exists."

### 2. User Signs Up Or Logs In

User action:

The user enters name/email/password or email/password.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/pages/AuthPage.jsx` | Shows signup/login form and collects credentials. |
| `client/src/context/AuthContext.jsx` | Calls login/signup and stores the returned user/token. |
| `client/src/services/api.js` | Sends `POST /api/auth/signup` or `POST /api/auth/login`. |
| `server/routes/authRoutes.js` | Defines auth endpoints. |
| `server/controllers/authController.js` | Handles request/response for signup/login. |
| `server/services/authService.js` | Hashes passwords, checks passwords, and creates JWTs. |
| `server/models/User.js` | Creates or reads the user record. |
| `server/config/db.js` | Provides MongoDB connection used by the model. |

Interview explanation:

"The frontend submits credentials through `api.js`. The backend controller delegates security logic to `authService`, which hashes passwords and signs JWTs."

### 3. User Enters Main Chat Screen

User action:

After login, the user sees the chat layout with a sessions sidebar and chat area.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/App.jsx` | Shows `ChatPage` for authenticated users. |
| `client/src/pages/ChatPage.jsx` | Creates the main layout: sidebar, chat window, upload modal. |
| `client/src/components/DocumentList.jsx` | Shows session list in sidebar. |
| `client/src/components/ChatWindow.jsx` | Shows selected session chat area and composer. |
| `client/src/context/DocContext.jsx` | Fetches and stores sessions, selected session, messages, and conversation ID. |
| `client/src/services/api.js` | Calls `/api/sessions`. |
| `server/routes/sessionRoutes.js` | Defines session routes. |
| `server/controllers/sessionController.js` | Lists sessions and attaches documents to each session. |
| `server/models/Session.js` | Reads session records. |
| `server/models/Document.js` | Reads documents inside each session. |

Interview explanation:

"The main screen is session-based. `DocContext` loads sessions, `DocumentList` renders them, and `ChatWindow` renders the active session."

### 4. User Starts A New Session Or Selects Existing Session

User action:

The user clicks a session or starts fresh.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/components/DocumentList.jsx` | Handles session row clicks and new-session UI. |
| `client/src/context/DocContext.jsx` | Calls `getSession`, stores selected session, then loads latest conversation. |
| `client/src/services/api.js` | Calls `GET /api/sessions/:id`, `GET /api/chat/sessions/:sessionId/conversations`, and `GET /api/chat/conversations/:conversationId`. |
| `server/controllers/sessionController.js` | Returns one hydrated session with its documents. |
| `server/controllers/chatController.js` | Returns conversation list and selected conversation messages. |
| `server/models/Conversation.js` | Reads saved chat history. |

Interview explanation:

"Selecting a session hydrates both document status and previous chat history, so the user can continue where they left off."

### 5. User Uploads A Document

User action:

The user clicks the plus/upload button and selects a PDF, DOCX, or TXT file.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/components/UploadModal.jsx` | Provides upload UI and file selection. |
| `client/src/services/api.js` | Sends multipart `POST /api/documents/upload` with optional `sessionId`. |
| `server/routes/documentRoutes.js` | Maps upload route. |
| `server/middleware/auth.js` | Ensures only authenticated users can upload. |
| `server/middleware/upload.js` | Multer parses and validates the uploaded file. |
| `server/controllers/documentController.js` | Creates/reuses session, stores file, creates document record, enqueues processing job. |
| `server/services/fileStorageService.js` | Saves file to local disk or GridFS. |
| `server/models/Session.js` | Creates or updates the session. |
| `server/models/Document.js` | Stores uploaded document metadata and status `uploaded`. |
| `server/queues/documentQueue.js` | Adds BullMQ job to Redis. |

Interview explanation:

"Upload does not process the whole document inside the HTTP request. It stores metadata and queues a background job, so the request returns quickly."

### 6. Worker Processes The Uploaded Document

User-visible result:

The UI shows progress like parsing, chunking, embedding, and ready.

Files involved:

| File | Role In This Step |
| --- | --- |
| `server/worker.js` | Starts the BullMQ worker and consumes document-processing jobs. |
| `server/queues/documentQueue.js` | Provides Redis connection, queue name, retries, backoff, and progress events. |
| `server/controllers/documentController.js` | `processDocument` runs the full processing pipeline. |
| `server/services/fileStorageService.js` | Reads the uploaded file from local disk or GridFS. |
| `server/services/parserService.js` | Extracts raw text from PDF, DOCX, or TXT. |
| `server/services/chunkerService.js` | Splits text into semantic chunks. |
| `server/services/embeddingService.js` | Calls Gemini to embed semantic units and final chunks. |
| `server/models/Chunk.js` | Stores final chunk text and embedding vectors. |
| `server/models/Document.js` | Updates status, metadata, total chunks, token count, and errors. |

Interview explanation:

"The worker owns the expensive pipeline: parse file, chunk text, create embeddings, store chunks, and mark the document ready."

### 7. User Sees Real-Time Processing Updates

User-visible result:

The browser updates document status automatically without refresh.

Files involved:

| File | Role In This Step |
| --- | --- |
| `server/worker.js` | Calls `job.updateProgress`. |
| `server/queues/documentQueue.js` | Listens to BullMQ QueueEvents in the API process. |
| `server/config/socket.js` | Emits progress events through Socket.io. |
| `server/server.js` | Initializes Socket.io when the API server starts. |
| `client/src/hooks/useSocket.js` | Connects browser to Socket.io. |
| `client/src/context/DocContext.jsx` | Refreshes or updates selected document/session state. |
| `client/src/components/ChatWindow.jsx` | Shows progress labels, retry button, delete button, and ready state. |
| `client/src/components/DocumentList.jsx` | Shows session/document status in sidebar. |

Interview explanation:

"The worker updates BullMQ progress, the API relays it through Socket.io, and the React UI updates the session status."

### 8. User Asks A Question

User action:

The user types a question in the chat box and presses send.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/components/ChatWindow.jsx` | Adds user message, creates streaming assistant placeholder, and starts chat stream. |
| `client/src/hooks/useSSE.js` | Reads streamed response events. |
| `client/src/services/api.js` | Sends `POST /api/chat/sessions/:sessionId`. |
| `server/routes/chatRoutes.js` | Maps session chat route. |
| `server/controllers/chatController.js` | Opens SSE response and streams token/source/done/error events. |
| `server/services/ragService.js` | Runs the full RAG pipeline. |
| `server/models/Session.js` | Verifies the session belongs to the user. |
| `server/models/Document.js` | Ensures session documents exist and are ready. |
| `server/models/Conversation.js` | Loads conversation memory or creates a new conversation. |

Interview explanation:

"When the user sends a question, the backend opens an SSE stream. The frontend receives tokens as they are generated, so the answer appears progressively."

### 9. Backend Retrieves Relevant Document Chunks

User-visible result:

The assistant answer is grounded in the uploaded documents.

Files involved:

| File | Role In This Step |
| --- | --- |
| `server/services/ragService.js` | Classifies question type, rewrites follow-ups, optionally runs HyDE, embeds the query, and builds the final prompt. |
| `server/services/hydeService.js` | Generates hypothetical answer text for vague questions. |
| `server/services/embeddingService.js` | Embeds the retrieval query or HyDE text. |
| `server/services/searchService.js` | Runs vector search, MongoDB text search, and RRF fusion. |
| `server/models/Chunk.js` | Provides stored chunk text and embeddings for retrieval. |

Interview explanation:

"Retrieval is hybrid. Vector search finds semantically similar chunks, text search catches exact keywords, and RRF merges both rankings."

### 10. Backend Generates And Streams The Answer

User-visible result:

The assistant response streams into the chat window with sources.

Files involved:

| File | Role In This Step |
| --- | --- |
| `server/services/ragService.js` | Builds the structured prompt and calls Gemini streaming generation. |
| `server/controllers/chatController.js` | Writes SSE events for `token`, `sources`, `done`, and `error`. |
| `client/src/hooks/useSSE.js` | Parses incoming SSE events. |
| `client/src/components/ChatWindow.jsx` | Updates the assistant message as tokens arrive. |
| `client/src/components/MessageBubble.jsx` | Renders the final assistant message. |
| `client/src/components/SourceCard.jsx` | Displays source snippets returned by retrieval. |
| `server/models/Conversation.js` | Saves user and assistant messages after completion. |

Interview explanation:

"The answer is streamed token by token. Once generation finishes, the backend sends sources and saves the conversation."

### 11. User Returns Later And Continues Chat

User action:

The user logs in later and selects the same session.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/context/AuthContext.jsx` | Restores auth using saved token. |
| `client/src/context/DocContext.jsx` | Loads sessions and latest conversation. |
| `server/controllers/sessionController.js` | Returns session with documents. |
| `server/controllers/chatController.js` | Returns conversation history. |
| `server/models/Conversation.js` | Stores previous messages. |

Interview explanation:

"Because sessions, documents, chunks, and conversations are persisted in MongoDB, the user can return and continue the same document chat."

### 12. User Deletes Or Retries Documents

User action:

The user deletes a document/session or retries failed processing.

Files involved:

| File | Role In This Step |
| --- | --- |
| `client/src/components/ChatWindow.jsx` | Shows retry/delete actions for session documents. |
| `client/src/components/DocumentList.jsx` | Shows session delete behavior. |
| `client/src/services/api.js` | Calls document/session delete or retry endpoints. |
| `server/controllers/documentController.js` | Deletes document chunks/files or requeues failed document processing. |
| `server/controllers/sessionController.js` | Deletes session, documents, chunks, conversations, and files. |
| `server/services/fileStorageService.js` | Deletes uploaded file from local storage or GridFS. |
| `server/queues/documentQueue.js` | Requeues retry jobs. |
| `server/models/Document.js` | Updates retry status or deletes document record. |
| `server/models/Chunk.js` | Deletes stored chunks. |
| `server/models/Conversation.js` | Deletes related conversations if needed. |

Interview explanation:

"Retry resets document processing state and requeues the job. Delete cleans up database records, chunks, conversations, and the stored uploaded file."

## Short End-To-End Flow

1. User opens app: `index.html` -> `main.jsx` -> `App.jsx`.
2. User logs in: `AuthPage.jsx` -> `AuthContext.jsx` -> `authRoutes.js` -> `authController.js` -> `authService.js` -> `User.js`.
3. User sees sessions: `ChatPage.jsx` -> `DocContext.jsx` -> `sessionRoutes.js` -> `sessionController.js` -> `Session.js` + `Document.js`.
4. User uploads document: `UploadModal.jsx` -> `api.js` -> `documentRoutes.js` -> `upload.js` -> `documentController.js`.
5. Backend queues job: `documentController.js` -> `fileStorageService.js` -> `Document.js` -> `documentQueue.js` -> Redis.
6. Worker processes document: `worker.js` -> `processDocument` -> `parserService.js` -> `chunkerService.js` -> `embeddingService.js` -> `Chunk.js`.
7. User sees progress: worker progress -> `documentQueue.js` -> `socket.js` -> `useSocket.js` -> UI.
8. User asks question: `ChatWindow.jsx` -> `useSSE.js` -> `chatRoutes.js` -> `chatController.js`.
9. RAG retrieves context: `ragService.js` -> `hydeService.js` -> `embeddingService.js` -> `searchService.js` -> `Chunk.js`.
10. Answer streams back: Gemini -> `ragService.js` -> `chatController.js` -> `useSSE.js` -> `MessageBubble.jsx`.
11. Conversation persists: `ragService.js` -> `Conversation.js`.

Upload:

1. `UploadModal.jsx` sends file through `api.js`.
2. `documentRoutes.js` maps request to `documentController.js`.
3. `upload.js` uses Multer to parse the upload.
4. `documentController.js` stores the file with `fileStorageService.js`.
5. `Document.js` stores metadata in MongoDB.
6. `documentQueue.js` enqueues a BullMQ job in Redis.
7. `worker.js` consumes the job.
8. `parserService.js`, `chunkerService.js`, and `embeddingService.js` process the file.
9. `Chunk.js` stores chunk text and vectors.
10. `socket.js` and `useSocket.js` update the UI.

Chat:

1. `ChatWindow.jsx` sends the question through `useSSE.js` and `api.js`.
2. `chatRoutes.js` maps request to `chatController.js`.
3. `chatController.js` opens an SSE stream.
4. `ragService.js` runs memory, query rewrite, HyDE, embedding, retrieval, prompt, and Gemini streaming.
5. `searchService.js` retrieves relevant chunks.
6. `Conversation.js` saves the final user and assistant messages.

## Short Interview Closing

"The file structure follows separation of concerns: routes define endpoints, controllers handle request workflows, services hold business logic, models define MongoDB data, queues manage background jobs, and the client is split into pages, components, context, hooks, and API services. Environment variables separate secrets and deployment-specific configuration from code."
