# HireHub — AI-Powered Multi-Agent Recruitment Platform

> An intelligent, autonomous recruitment system that streamlines end-to-end talent acquisition — from resume parsing and semantic candidate search to live AI-driven interviews and data-driven hiring decisions.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

---

## Overview

**HireHub** transforms traditional recruitment pipelines into autonomous, AI-driven workflows. Built on a multi-agent architecture powered by **LangGraph** and **LangChain**, the platform enables HR teams and hiring managers to:

- Automatically parse and score resumes against job profiles
- Discover top candidates using semantic (vector) search
- Conduct adaptive AI-powered interviews in real time
- Generate objective hiring recommendations backed by scoring data

The project consists of a **FastAPI** backend with a **React + Vite** frontend, designed to be self-hosted and fully configurable.

---

## Key Features

| Feature | Description |
|---|---|
| 📄 **Resume Parsing** | Extracts skills, experience, education, and contact details from uploaded PDFs |
| 🔍 **Semantic Search (RAG)** | ChromaDB + Sentence Transformers for deep candidate-to-job matching |
| 🎙️ **AI Interview Agent** | Adaptive, multi-turn technical and behavioral interviews with live evaluation |
| 📊 **Decision & Scoring Engine** | Generates detailed hiring recommendations from interview transcripts and scores |
| 💬 **Engagement Agent** | Automates candidate communication, status updates, and scheduling |
| 🧠 **Memory Agent** | Retains cross-session candidate state and interview history |
| 🔐 **JWT Authentication** | Secure role-based access for HR admins and candidates |
| 📧 **Email Notifications** | SMTP-based email alerts integrated into the engagement workflow |

---

## Architecture

HireHub uses a **multi-agent orchestration** pattern. A central FastAPI server coordinates six specialized AI agents:

```
                         ┌────────────────────────┐
                         │     FastAPI Server     │
                         └───────────┬────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
       ▼                             ▼                             ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   Candidate     │        │   Knowledge     │        │   Interview     │
│  Intelligence   │        │  Agent (RAG)    │        │     Agent       │
│ (Parse + Score) │        │  (ChromaDB)     │        │ (Live AI Chat)  │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                           │
         └──────────────────────────┼───────────────────────────┘
                                    │
       ┌─────────────────────────────┼─────────────────────────────┐
       ▼                             ▼                             ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│    Decision     │        │   Engagement    │        │    Memory       │
│     Agent       │        │     Agent       │        │     Agent       │
│ (Hiring Recs)   │        │ (Email/Comms)   │        │ (State/History) │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

Agent workflows are defined as **LangGraph state graphs**, enabling conditional branching, parallel execution, and persistent state across sessions.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.10+ | Runtime |
| FastAPI + Uvicorn | REST API server |
| LangGraph + LangChain | Multi-agent orchestration |
| OpenAI-compatible API | LLM provider (configurable) |
| ChromaDB + Sentence Transformers | Vector database & semantic search |
| SQLite + SQLModel + aiosqlite | Async relational database |
| PyMuPDF + BeautifulSoup4 + spaCy | Document parsing |
| python-jose + passlib | JWT auth & password hashing |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite 5 | UI framework & build tool |
| Tailwind CSS 4 | Utility-first styling |
| React Router DOM v6 | Client-side routing |
| Lucide React | Icon library |
| Axios | HTTP client |

---

## Project Structure

```
HireHub/
├── .gitignore
├── README.md
│
├── backend/                        # FastAPI backend
│   ├── .env.example                # Environment variable template
│   ├── requirements.txt            # Python dependencies
│   └── app/
│       ├── main.py                 # Application entry point
│       ├── config.py               # Pydantic settings
│       ├── agents/                 # AI agent definitions
│       │   ├── candidate_intelligence.py
│       │   ├── decision_agent.py
│       │   ├── engagement_agent.py
│       │   ├── interview_agent.py
│       │   ├── knowledge_agent.py
│       │   └── memory_agent.py
│       ├── api/                    # REST API route handlers
│       ├── db/                     # SQLModel schemas & session management
│       ├── graph/                  # LangGraph workflow definitions
│       ├── services/               # External integrations (LLM client)
│       └── utils/                  # Parsing helpers & utilities
│
└── frontend/                       # React + Vite frontend
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx                 # Root component & routing
        ├── index.css               # Global styles
        ├── components/             # Reusable UI components
        ├── pages/                  # Application views
        └── services/               # API request wrappers
```

---

## Prerequisites

Ensure the following are installed before proceeding:

| Tool | Version | Download |
|---|---|---|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 18.x+ | [nodejs.org](https://nodejs.org/) |
| npm | (bundled with Node.js) | — |
| Git | Latest | [git-scm.com](https://git-scm.com/) |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/HireHub.git
cd HireHub
```

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create a virtual environment
python -m venv venv

# 3. Activate the virtual environment
#    Windows (PowerShell)
.\venv\Scripts\Activate.ps1
#    macOS / Linux
source venv/bin/activate

# 4. Install Python dependencies
pip install -r requirements.txt

# 5. Set up environment variables
cp .env.example .env
# Open .env and fill in your API keys and secrets

# 6. Start the backend server
uvicorn app.main:app --reload --port 8000
```

✅ The backend will be running at **`http://localhost:8000`**

---

### Frontend Setup

Open a **new terminal** from the project root:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node.js dependencies
npm install

# 3. Start the development server
npm run dev
```

✅ The frontend will be running at **`http://localhost:5173`**

---

## Environment Variables

Copy the example file and configure your values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXUS_API_BASE_URL` | ✅ | Base URL for the LLM API | `https://api.openai.com/v1` |
| `NEXUS_API_KEY` | ✅ | API key for your LLM provider | `sk-...` |
| `JWT_SECRET_KEY` | ✅ | Secret for signing JWT tokens | `a-long-random-secret` |
| `JWT_ALGORITHM` | ✅ | JWT signing algorithm | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | ✅ | Token expiry (minutes) | `480` |
| `DATABASE_URL` | ✅ | SQLite async connection string | `sqlite+aiosqlite:///./data/agenthire.db` |
| `CHROMA_PERSIST_DIR` | ✅ | ChromaDB vector storage path | `./data/chroma_store` |
| `SMTP_HOST` | ⚠️ Optional | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | ⚠️ Optional | SMTP port | `587` |
| `SMTP_USER` | ⚠️ Optional | SMTP username/email | `you@gmail.com` |
| `SMTP_PASSWORD` | ⚠️ Optional | SMTP password or app password | `your-app-password` |
| `SENDER_EMAIL` | ⚠️ Optional | Sender email address | `you@gmail.com` |
| `SENDER_NAME` | ⚠️ Optional | Sender display name | `HireHub Talent Acquisition` |

> **⚠️ Security Note:** Never commit your `.env` file to version control. It is already listed in `.gitignore`.

---

## API Documentation

Once the backend server is running, interactive API docs are available at:

| Interface | URL |
|---|---|
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |

---

## Contributing

Contributions are welcome! To get started:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

<div align="center">
  Built with ❤️ using FastAPI · LangGraph · React · ChromaDB
</div>
