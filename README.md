# 3AM SDC Hackathon

> A one-sentence description of what your project does and who it is for.

## Development: Next.js + FastAPI

The application source is under `src/`: Next.js is in `src/frontend/`, and the
FastAPI entry point is `src/main.py`. Replit starts the web and API services
through their managed workflows. The web service serves `/`; `/api/*` is routed
to FastAPI.

For local development, install the Python requirements and frontend workspace
dependencies, then run the API and frontend in separate terminals:

```bash
python -m pip install -r requirements.txt
python -m uvicorn src.main:app --host 0.0.0.0 --port 8080 --reload
```

```bash
pnpm install
pnpm --filter 3am-sdc-frontend run dev
```

Open the frontend at `http://localhost:3000`. The frontend proxies `/api/*` to
`http://127.0.0.1:8080`; FastAPI's interactive docs are at
`http://127.0.0.1:8080/docs`.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | 3AM                                         |
| **Team Domain**        | Domain 1                                    |
| **SDG Track (1–17)**   | SDG 4  — Quality Education                  |
| **Team Leader**        | Ooi Wei Lun                                 |
| **University**         | Asia Pacific University                     |
| **Number of Members**  | 3                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/weiiilunnnn/3am-sdc-hackathon  |
| Replit Project    | https://replit.com/@your-username/your-project |
| Live Demo         | https://your-project.replit.app                |
| RunPod Endpoint   | https://api.runpod.ai/v2/your-endpoint-id      |
| Slide Deck        | https://example.com/slides                     |
| Demo Video        | https://example.com/demo-video                 |

---

## Overview

### Problem

Describe the real-world problem you are solving in 2–4 sentences. Who is affected, and why does it matter?

### Solution

Explain how your project uses AI to solve the problem and what makes it valuable.

### Key Features

- **Feature 1** — Short description.
- **Feature 2** — Short description.
- **Feature 3** — Short description.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | e.g. HTML, React             |
| Backend       | e.g. Python, Flask / FastAPI |
| Database      | e.g. PostgreSQL, SQLite      |
| AI / Compute  | RunPod (GPU)                 |
| Hosting / Dev | Replit                       |

---

## Project Structure

```
.
├── docs/                    # Screenshots, diagrams
├── src/
│   ├── frontend/            # Next.js application
│   ├── main.py              # FastAPI application entry point
│   └── utils.py             # Backend helper functions
├── submission/              # Required submission documents
│   ├── REPLIT PROOF OF USE.pdf
│   ├── RUNPOD PROOF OF USE.pdf
│   └── Submission Template SDC Hackathon.pdf
├── tests/
│   └── test_utils.py        # Unit tests
├── .env.example             # Example environment variables
├── .gitignore
├── .replit                  # Replit run configuration
├── LICENSE
├── requirements.txt         # FastAPI and Uvicorn dependencies
└── README.md
```

### Architecture

```
User ──► Replit (App / API) ──► RunPod Endpoint (GPU model)
                │
                └──► Response returned to user
```

---

## How to Run

### Run on Replit

Open the Replit project and start the **Project** workflow. The managed web and
API services start Next.js and FastAPI respectively. No RunPod credentials or
external services are needed for the starter application.

### Run Locally

```bash
# Install dependencies as shown above, then run the API and frontend in
# separate terminals.
```

### Run Tests

```bash
python -m unittest discover tests
```

---

## How We Use Replit *(Required)*

Describe how your team used Replit. For example:

- **Development:** Collaborative coding in a shared Repl using Multiplayer.
- **Hosting:** The app is deployed with Replit Deployments at the Live Demo link above.
- **Secrets:** API keys are stored in Replit Secrets, never in the code.

📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf)

## How We Use RunPod *(Required)*

RunPod has not been configured for the starter baseline. Update this section
with the team's actual usage only after an endpoint is implemented.

📄 Proof of use: [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf)

---

## Challenges & Learnings

- What challenges did you face, and how did you overcome them?
- What did your team learn?

## Future Improvements

- [ ] Improvement 1
- [ ] Improvement 2

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Member Name | Team Lead / Backend | [@username](https://github.com/username) |
| Member Name | Frontend            | [@username](https://github.com/username) |
| Member Name | AI / RunPod         | [@username](https://github.com/username) |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Submission template completed in `submission/`
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
