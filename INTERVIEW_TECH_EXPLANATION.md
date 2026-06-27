# DoxChat AI - Interview Tech Explanation

Interview date context: current version updated on June 26, 2026.

## Project In One Line

DoxChat AI is an authenticated RAG workspace where users upload PDF, DOCX, or TXT files, the backend processes and embeds them asynchronously, and users chat with all documents, one selected document, or a comparison scope through streamed AI responses.

## Architecture Summary

The project has a React/Vite frontend, an Express API server, a BullMQ document worker, MongoDB for persistent app data, Redis for queue state, and Gemini for embeddings/chat. The main design choice is separating upload/API work from long-running document processing so the app stays responsive and failed processing jobs can retry. In deployment, the frontend can run on Vercel while the API and worker run on Render.

## Frontend Tech

| Tech | Used For | Why It Is Used |
| --- | --- | --- |
| React | Document workspace, previews, citation panel, auth, session controls, and streamed answers | The app has interactive state for sessions, retrieval scope, previews, processing, messages, and streaming. React components and hooks keep those concerns manageable. |
| Vite | Frontend dev server and production build | Fast local development, hot reload, and simple static build output that Express can serve in production. |
| React Router | Client-side page flow | Keeps authenticated and unauthenticated screens organized without full page reloads. |
| Axios | Normal REST API calls | Centralized API client, easy JWT headers, and upload progress support for multipart file uploads. |
| Fetch | Streaming chat requests | Gives direct access to streamed response bodies for SSE-style token streaming. |
| Socket.io Client | Processing progress updates | Receives real-time document status such as parsing, chunking, embedding, ready, and error. |
| react-dropzone | File selection/upload UX | Makes drag-and-drop document upload easier to implement. |
| react-hot-toast | Toast notifications | Shows upload, delete, retry, and error feedback in the UI. |
| react-markdown | Assistant answer rendering | Lets AI answers render Markdown like bullets, code, and formatted text. |
| Zod | Auth form validation | Keeps signup/signin validation rules consistent with the backend. |

## Backend Tech

| Tech | Used For | Why It Is Used |
| --- | --- | --- |
| Node.js | Runs API server and worker | Good for I/O-heavy work: database calls, file reads, Redis jobs, Gemini API calls, and streaming responses. |
| Express | HTTP API framework | Provides routes, middleware, error handling, rate limiting, SSE responses, and production static file serving. |
| CommonJS | Server module format | Keeps backend module style consistent and compatible with the current Node setup. |
| Mongoose | MongoDB schemas/models | Adds structure for User, Session, Document, Chunk, and Conversation models, plus indexes and validation. |
| MongoDB Atlas | Main database | Stores users, sessions, document metadata, chunks, embeddings, and conversations. Also supports text search on chunks. |
| Redis | Queue infrastructure | Stores BullMQ jobs, job states, retries, and progress. It is not the main app database. |
| BullMQ | Background job queue | Moves document parsing/chunking/embedding out of the upload request and gives retries, backoff, progress, and concurrency control. |
| Separate Worker | Document processing | Keeps the API responsive while the worker handles long-running parsing and embedding work. |
| Socket.io Server | Real-time progress relay | API listens to BullMQ QueueEvents and emits document progress to the browser. |
| Server-Sent Events | Streaming chat responses | Chat is one-way server-to-client token streaming, so SSE is simpler than WebSockets. |
| JWT | Authentication | Stateless bearer-token auth. Each protected route filters data by `userId`. |
| Zod | Request validation | Validates and normalizes auth payloads before database or password logic runs. |
| Password Hashing | Secure password storage | Passwords are never stored in plaintext; login verifies against the hash. |
| CORS | Frontend/backend communication | Required because Vite and Express run on different origins during development. |
| express-rate-limit | API protection | Limits request spikes and helps protect expensive API/AI routes. |
| Multer | File uploads | Parses multipart uploads and provides file metadata/buffer/path to the backend. |
| GridFS | Production upload storage option | Useful when API and worker are separate services and cannot share local disk. |
| Node fs | Local upload storage | Reads/deletes uploaded files during local development. |

## Validation And Edge-Case Handling

| Area | Edge Cases Covered |
| --- | --- |
| Auth | Signup/signin validates with Zod on both frontend and backend, normalizes email/name, limits password length, handles duplicate email conflicts, and returns generic login errors. |
| Bearer tokens | The auth middleware accepts case-insensitive `Bearer` and trims extra spaces before JWT verification. |
| Uploads | The app rejects unsupported types, empty files, oversized files, invalid session IDs, and cleans up rejected local uploads. |
| Processing | Retry is blocked while a document is already queued or processing; stale errors/chunk counts are cleared before reprocessing; empty chunks and embedding mismatches fail clearly. |
| Chat | Session/document/conversation IDs are validated before SSE starts, questions are trimmed and length-limited, empty retrieval results produce a clear error, and frontend SSE errors stop the loading message. |

Interview answer:

"I tried to avoid only handling the happy path. Auth uses Zod on both client and server, upload validates file type/size/session ownership, chat validates IDs before opening the SSE stream, and document processing has guards for empty text, empty chunks, embedding mismatch, and duplicate retry clicks."

## AI / RAG Tech

| Tech | Used For | Why It Is Used |
| --- | --- | --- |
| Gemini API | Embeddings, query rewrite, HyDE, chat generation | One provider handles both retrieval and answer generation. |
| Embeddings | Semantic representation of chunks and queries | Finds relevant content even when user wording differs from document wording. |
| `gemini-embedding-2` | Document/query embeddings | Produces vectors used for semantic retrieval. The app uses 768 dimensions to reduce storage and compute. |
| Semantic Chunking | Splitting documents into meaningful chunks | Keeps related sentences together instead of splitting blindly by character count. |
| Cosine Similarity | Vector comparison | Ranks chunks by semantic closeness to the user query and helps detect semantic breakpoints during chunking. |
| MongoDB `$text` Search | Keyword retrieval | Catches exact names, dates, clauses, numbers, and terms that vector search may miss. |
| Hybrid Search | Vector + keyword retrieval | Improves retrieval quality by combining semantic and exact-match search. |
| Reciprocal Rank Fusion | Merging search rankings | Combines vector and text results without needing to normalize incompatible scores. |
| HyDE | Better retrieval for vague queries | Generates a hypothetical answer and embeds that richer text for retrieval. |
| Query Rewriting | Follow-up question handling | Turns questions like "what does it mean?" into standalone retrieval queries using conversation memory. |
| Structured Prompting | Grounded final answers | Tells Gemini to answer from retrieved chunks, cite sources, handle missing info, and avoid unsupported document claims. |
| Model Fallbacks | Reliability | If the primary chat model is overloaded or fails before streaming, fallback models can answer. |

## How Many AI Models Are Used?

The app uses 4 unique Gemini model names across 6 model roles.

| Role | Model | Why It Is Used |
| --- | --- | --- |
| Document embeddings | `gemini-embedding-2` | Converts document chunks into vectors for semantic search. |
| Query embeddings | `gemini-embedding-2` | Converts the user's question or HyDE text into a vector so it can be compared with document chunks. It is the same embedding model, but with query-specific task type. |
| Primary chat generation | `gemini-3.5-flash` | Main model used to generate the final answer from retrieved document context. |
| Chat fallback 1 | `gemini-3.1-flash-lite` | Used if the primary chat model fails or is temporarily overloaded before streaming starts. |
| Chat fallback 2 | `gemini-2.5-flash` | Second fallback model to improve reliability. |
| HyDE generation | `gemini-3.1-flash-lite` | Generates a short hypothetical answer for vague questions, which is then embedded for better retrieval. |
| Query rewriting | `gemini-3.1-flash-lite` | Rewrites follow-up questions into standalone retrieval queries using conversation memory. |

Important distinction:

- Unique model names: 4
- Model roles/usages: 6 main roles

The unique models are:

1. `gemini-embedding-2`
2. `gemini-3.5-flash`
3. `gemini-3.1-flash-lite`
4. `gemini-2.5-flash`

Interview answer:

"We use four unique Gemini models, but they serve multiple roles. `gemini-embedding-2` handles both document and query embeddings. `gemini-3.5-flash` is the primary answer-generation model. `gemini-3.1-flash-lite` is used as a cheaper/faster helper for HyDE, query rewriting, and as a fallback chat model. `gemini-2.5-flash` is another fallback for reliability. So the architecture separates embedding, retrieval improvement, query rewriting, and final answer generation instead of using one model for everything."

## File Parsing Tech

| Tech | Used For | Why It Is Used |
| --- | --- | --- |
| pdf-parse | PDF text extraction | Converts PDFs into raw text for chunking and embeddings. |
| mammoth | DOCX text extraction | Converts Word documents into plain text. |
| Plain text parser | TXT files | Reads text files directly with minimal processing. |

## Data Models

| Model | Purpose |
| --- | --- |
| User | Stores account data and password hash. |
| Session | Represents a chat workspace; one session can contain many documents. |
| Document | Stores uploaded file metadata, storage location, processing status, errors, chunk count, and token count. |
| Chunk | Stores chunk text, embedding vector, token count, and text-search index data. |
| Conversation | Stores chat messages and provides memory for follow-up questions. |

## Deployment Tech

| Tech | Used For | Why It Is Used |
| --- | --- | --- |
| Docker | Packaging API/frontend and worker | Gives repeatable builds and supports separate production services. |
| Render YAML | Deployment configuration | Defines API, worker, environment variables, and service settings as config. |
| Render | Backend deployment | Hosts the Express API, BullMQ worker/background process, and Redis/Key Value service. |
| Vercel | Frontend deployment | Hosts the static Vite frontend and injects `VITE_API_URL` / `VITE_SOCKET_URL` at build time. |
| Environment Variables | Runtime configuration | Keeps secrets and deployment-specific settings outside source code. |

## Strong Interview Explanation

"The most important design decision was making document processing asynchronous. Uploading a document only creates metadata and enqueues a BullMQ job. A worker parses the file, creates semantic chunks, generates embeddings with Gemini, and stores chunks in MongoDB. Redis keeps the queue reliable with retries and progress updates. The API remains responsive, Socket.io shows processing status, and SSE streams the final chat answer token by token. Retrieval uses hybrid search, combining vector similarity with MongoDB text search, then Gemini generates a grounded answer from the retrieved chunks. I also added validation around auth, upload, IDs, retry, and SSE errors so the app handles failure cases predictably."

## Limitations To Mention Honestly

- Large documents can still hit Gemini embedding quota.
- Current vector search scans chunk embeddings in app code; production scale should use Atlas Vector Search or another vector index.
- More per-user limits, queue rate limiting, and embedding caching would improve production readiness.
- The architecture is solid for small and medium documents, but large multi-user production workloads need more retrieval and quota optimizations.
