# Universal AI API Hub — 2 Minute 30 Second Video Demo Script & Voiceover Guide

**Total Duration:** 2:30 (150 seconds)  
**Audio File Generated:** `demo_voiceover.wav` (located in project root)

---

## ⏱️ Timeline Overview

| Time Interval | Screen Action | Voiceover Focus |
|---|---|---|
| **0:00 – 0:30** (30s) | On **Dashboard** page, showing summary cards, health, metrics | Platform intro, real-time observability, health, and throughput |
| **0:30 – 0:35** (5s) | Click **Connectors** tab | Defining custom AI endpoints, schemas & prompts |
| **0:35 – 0:40** (5s) | Click **Providers** tab | Secure credentials, key pooling & multi-model failover |
| **0:40 – 0:45** (5s) | Click **API Keys** tab | Scoped cryptographic keys with instant revocation |
| **0:45 – 0:50** (5s) | Click **API Docs** tab | Interactive OpenAPI documentation & ready cURL snippets |
| **0:50 – 0:55** (5s) | Click **Test API** tab | Transition to live test execution |
| **0:55 – 2:00** (65s) | Enter customer text in **Test API**, click **Execute**, inspect JSON output & telemetry | Real execution, JSON schema enforcement, latency, token metering & cost |
| **2:00 – 2:30** (30s) | Click **Request Logs** tab, open log details modal | SQLite WAL persistence, full audit trail, closing wrap-up |

---

## 🎙️ Full Voiceover Script (Word-for-Word)

### [0:00 – 0:30] Part 1: Dashboard Overview
> *(Visual: Start on the Dashboard page. Mouse scrolls slightly across the active metrics, status badge, and charts.)*

"Welcome to the Universal AI API Hub — an enterprise-grade API gateway and management platform designed to turn AI models into standardized, production-ready REST endpoints. 
Starting here on the Dashboard, we have a real-time overview of our system health, active AI connectors, cumulative request throughput, and live cost analytics. Every execution is tracked with millisecond latency and exact token metering, giving teams complete observability over their AI operations."

---

### [0:30 – 0:55] Part 2: 5-Second Tour of Core Pages

#### [0:30 – 0:35] Connectors Page
> *(Visual: Click 'Connectors' in navbar. Briefly show the active connector cards.)*

"Moving over to Connectors, this is where we configure our custom AI endpoints — defining system prompts, input parameters, and strict JSON output schemas."

#### [0:35 – 0:40] Providers Page
> *(Visual: Click 'Providers' in navbar. Show the Google Gemini, OpenAI, Groq, Anthropic cards.)*

"In the Providers tab, we manage our AI credentials securely, supporting key pooling, automatic load balancing, and multi-model failover across Google Gemini, OpenAI, Groq, and Anthropic."

#### [0:40 – 0:45] API Keys Page
> *(Visual: Click 'API Keys' in navbar. Show the generated keys table.)*

"Next, the API Keys page allows developers to generate scoped, cryptographically secure access keys with instant one-click revocation."

#### [0:45 – 0:50] API Docs Page
> *(Visual: Click 'API Docs' in navbar. Show interactive schema & cURL sample.)*

"In API Docs, interactive, auto-generated documentation provides ready-to-use cURL snippets, schema specifications, and response envelopes for seamless client integration."

#### [0:50 – 0:55] Transition to Live Testing
> *(Visual: Click 'Test API' in navbar.)*

"Now, let's head over to the Live Test API interface to execute a real request."

---

### [0:55 – 2:00] Part 3: Live Execution & Telemetry Inspection
> *(Visual: In Test API, select 'Customer Support Ticket Triage' connector. In the `ticket_text` field, type or paste: "I was charged twice for my subscription renewal yesterday. Please refund the duplicate charge immediately." Then click "Execute Request" button. Watch the loading spinner and then the Live Response Inspector populate on the right.)*

"Here in the Live Test API interface, we can test our generated endpoints dynamically. 
I will select the Customer Support Ticket Triage connector. Notice how the form automatically generates input fields based on the connector's schema definition. 

I will enter a real-world customer message: 
*'I was charged twice for my subscription renewal yesterday. Please refund the duplicate charge immediately.'* 

Now, let's hit Execute. 

In just a fraction of a second, the gateway processes the request, injects the system prompt and dynamic parameters, calls the AI provider, and validates the output strictly against our JSON schema. 

On the right, the Live Response Inspector shows our standardized HTTP 200 envelope:
It extracted the category as 'billing', flagged the priority as 'high', urgency as frustrated, and generated a structured suggested action for our support team. 
Best of all, we see exact execution telemetry: real latency in milliseconds, prompt and completion token counts, and transparent micro-cost calculations."

---

### [2:00 – 2:30] Part 4: Persistent Request Logs & Closing
> *(Visual: Click 'Request Logs' in navbar. Point to the newest row showing status 200, duration, and token count. Click 'Inspect' button to open the log details modal showing client IP, timestamp, raw input payload, and validated response payload.)*

"Finally, let's navigate to the Request Logs page. 
Every single API call through the hub is permanently recorded in our SQLite database with Write-Ahead Logging. 
Clicking into our latest execution reveals a complete audit trail: client IP, timestamp, raw input payload, the validated JSON response, and execution metadata. 

From dynamic connector configuration to enterprise-grade failover and auditable telemetry, the Universal AI API Hub provides the complete infrastructure to scale AI APIs reliably. Thank you for watching!"

---

## 🎧 Generated Voiceover Audio File
The complete synchronized narration audio file has already been synthesized and saved to your project at:
`d:\projects\AIAPIconnector\demo_voiceover.wav`
