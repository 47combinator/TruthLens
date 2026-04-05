# 🔍 TruthLens: AI-Powered Fake News Detection

![TruthLens Overview](https://img.shields.io/badge/Status-Active-success) ![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue) ![License](https://img.shields.io/badge/License-MIT-blue.svg)

**TruthLens** is an intelligent, web-based fake news detection tool designed to help users quickly verify the authenticity of news claims. Built as part of the ASEP (Applied Science and Engineering Projects) initiative at Vishwakarma University, it combats digital misinformation by combining advanced Large Language Models (LLMs) with real-time web search.

---

## ✨ Key Features

- 🧠 **Two-Pass AI Pipeline (RAG Engine)**:
  - **Pass 1 (Query Extraction)**: Uses AI to extract factual, unbiased search queries (WHO, WHAT, WHEN, WHERE) from raw user claims.
  - **Pass 2 (Evidence Analysis)**: Analyzes the retrieved real-time evidence against the claim to deliver an informed verdict.
- 🌐 **Real-Time Web Search**: Grounds the AI’s reasoning in up-to-date, verifiable evidence using the DuckDuckGo News API, rather than relying on static training data.
- 🏛️ **Source Credibility Tiering**: Evaluates search results against a curated database of 44 reputed sources, prioritizing professional Fact-Checking organizations (like Alt News, Snopes), followed by Indian & International News Outlets.
- 📊 **Transparent & Explainable Results**: Delivers a clear verdict (`REAL`, `FAKE`, or `UNCERTAIN`) accompanied by a confidence score (0-100%), a detailed explanation, and clickable source links for independent verification.
- 🎨 **Modern, Responsive UI**: Features a sleek, dark-themed glassmorphism interface with an animated confidence ring and categorized evidence badges.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Backend Framework** | Python 3.10, Flask 3.0 |
| **LLM Inference** | [Groq Cloud API](https://console.groq.com/) (LLaMA 3.3 70B) |
| **Search Engine** | DuckDuckGo Search API (`duckduckgo-search`) |
| **Frontend** | Vanilla HTML5, CSS3, JavaScript |

---

## 🚀 Installation & Setup

Follow these steps to run TruthLens locally on your machine.

### Prerequisites
- Python 3.10 or higher
- A free API key from [Groq](https://console.groq.com/)

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/TruthLens.git
   cd TruthLens
   ```

2. **Set up a virtual environment (Optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(If `requirements.txt` is missing, manually install: `pip install flask groq duckduckgo-search python-dotenv`)*

4. **Configure Environment Variables:**
   - Create a file named `.env` in the root directory.
   - Add your Groq API key:
     ```env
     GROQ_API_KEY=your_actual_api_key_here
     ```

5. **Run the Application:**
   ```bash
   python app.py
   ```

6. **Access the Web Interface:**
   Open your browser and navigate to: `http://localhost:5000`

---

## 📂 Project Structure

```text
TruthLens/
├── app.py                  # Core Flask server and AI pipeline logic
├── .env                    # API keys and environment variables (not tracked)
├── requirements.txt        # Python dependencies
├── static/
│   ├── script.js           # Frontend logic, API handling, and UI updates
│   └── style.css           # UI styling and animations
├── templates/
│   └── index.html          # Main web application interface
└── documentation/          # Contains the academic literature review and reports
```

---

## 🧠 Why TruthLens?

Unlike static fact-checking aggregators or purely dataset-trained classification models, TruthLens fundamentally understands that **news changes every minute.** 

By leveraging **Retrieval-Augmented Generation (RAG)**, TruthLens acts exactly like a human researcher: it reads your claim, formulates targeted search queries, scours the open web for the latest articles from reputable sources, and logically compares the findings to give you an unbiased, evidence-backed answer.

---

## 👨‍💻 Authors & Academic Context

Developed as part of the First Year B.Tech (CSE), Semester 2 curriculum for applied science.

- **Developer:** Pratyush Chaudhari (Roll No. 31, Div E)
- **Institution:** Vishwakarma University, Pune
- **Project Guide:** Prof. Vikas Katakdaund

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
