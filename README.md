#  AI Data Analyst

A natural language to SQL system that reads CSV/Excel files with multiple tables, embeds schema metadata using Azure OpenAI, stores embeddings in Qdrant (persistent local), and answers user questions by generating + executing SQL queries.

---

##  Architecture

```
User Question (NL)
       ↓
[React Frontend]
       ↓ POST /api/query
[FastAPI Backend]
       ↓
1. Embed user question (Azure text-embedding-ada-002)
2. Search Qdrant → retrieve relevant table/column descriptions
3. Build prompt with schema context
4. GPT-4.1 generates SQL
5. Execute SQL on in-memory DuckDB (loaded from CSV/Excel)
6. Return results + SQL
```

---

##  Project Structure

```
ai-analyst/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Azure OpenAI & Qdrant config
│   ├── routers/
│   │   ├── upload.py            # CSV upload & schema extraction
│   │   ├── query.py             # NL → SQL → execute
│   │   └── schema.py            # Schema/table management
│   ├── services/
│   │   ├── schema_extractor.py  # Parse CSV → 8 tables → JSON schema
│   │   ├── embedder.py          # Azure text-embedding-ada-002
│   │   ├── qdrant_service.py    # Store/search embeddings (persistent)
│   │   ├── sql_generator.py     # GPT-4.1 SQL generation
│   │   └── sql_executor.py      # DuckDB query execution on CSV data
│   ├── utils/
│   │   └── helpers.py
│   ├── data/                    # Uploaded CSV/Excel files stored here
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── ChatInterface.jsx
    │   │   ├── ResultTable.jsx
    │   │   ├── SqlViewer.jsx
    │   │   ├── SchemaViewer.jsx
    │   │   └── FileUpload.jsx
    │   ├── pages/
    │   │   ├── Home.jsx
    │   │   └── Schema.jsx
    │   ├── hooks/
    │   │   └── useAnalyst.js
    │   └── utils/
    │       └── api.js
    ├── package.json
    └── vite.config.js
```

---

##  Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in your Azure OpenAI credentials
```

### 2. Start Qdrant (Local Persistent — No Docker)

```bash
# Download Qdrant binary
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
./qdrant  # Runs on http://localhost:6333, stores data in ./storage/
```

### 3. Start Backend

```bash
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

---

##  CSV Format

Your CSV file should have a column named `__table__` (or use sheet names in Excel) to distinguish between tables.

**OR** the system auto-detects tables by a blank-row separator.

Example multi-table CSV structure:
```
__table__,id,name,amount,...
sales,1,Product A,500,...
sales,2,Product B,300,...

__table__,id,customer_name,...
customers,1,John Doe,...
