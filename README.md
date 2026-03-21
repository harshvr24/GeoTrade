# GeoTrade

GeoTrade is a global intelligence dashboard that ingests real-time geopolitical news and visualises its impact on trade and markets. It aggregates live news feeds from around the world, applies AI/NLP analysis to summarize the key insights, and plots events on an interactive world map. For example, comparable projects collect hundreds of curated news feeds and overlay them on a globe or flat map【34†L471-L480】【37†L260-L268】. GeoTrade’s interface likely allows users to track supply chain disruptions, trade policy changes, and economic indicators in a unified view.

## Features

- **Real-Time News Aggregation:** Pulls live headlines on conflicts, trade deals, sanctions, and other geopolitical events. Similar dashboards aggregate 400+ news sources and generate AI-driven briefs【34†L471-L480】. GeoTrade uses this data to keep the map and feeds updated.
- **Interactive World Map:** Displays events on a 3D globe and flat map with multiple overlays (e.g. conflict zones, trade routes, resource flows). Users can zoom/pan and click on countries or markers to get details. (Other projects use libraries like globe.gl or deck.gl for such layered maps【34†L471-L480】.)
- **Event Feed & Filters:** A sidebar lists current events or alerts. Users can filter by category (e.g. “Conflict,” “Economy,” “Diplomacy”) or severity (Critical/High/Medium/Low). This is akin to the “real-time filterable event feed” in the Global Threat Map project【40†L321-L327】.
- **AI-Powered Analysis:** Applies machine learning to assess news sentiment and predict market impact. For example, World Monitor “AI-synthesizes” news into briefs【34†L471-L480】, and GeoTrade may similarly highlight key takeaways and trading signals.
- **Market & Commodity Data:** Integrates stock indices, commodity prices (oil, metals), currency rates or trade volumes. A built-in “finance radar” could show how indices react to events, inspired by finance-tracking features in similar tools【34†L471-L480】.
- **Alerts and Notifications:** Allows setting up keyword or region-based alerts. (E.g. notify on any news containing “tariff” or when trade in/out volume spikes.) These alerts complement the filtered event feed.

## Architecture & Dependencies

GeoTrade is likely built with modern web technologies. A plausible stack is Node.js with a React/Next.js frontend and a Python/Flask or Node backend.  For example, the Global Threat Map uses Next.js (React) and Mapbox GL JS for mapping【45†L369-L372】. GeoTrade may use libraries like Mapbox GL or Deck.gl for the map, and TensorFlow/PyTorch or Hugging Face for any NLP models. Key dependencies might include:

- **Mapping:** Mapbox GL JS or Leaflet (for 3D globe or interactive map layers).
- **Frontend Framework:** React or Vue (possibly with Vite or Next.js for development)【45†L369-L372】.
- **Backend & Data:** Node.js/Express or Python/Flask for APIs. Possibly Redis or MongoDB for caching event data.
- **Machine Learning:** Transformers (via Hugging Face) or an AI API (OpenAI) for news summarization.
- **APIs:** News API (e.g. Reuters, Google News), and possibly a data API for market prices.
- **Other:** Docker for deployment (common in such projects), and standard tools like npm/Yarn, pip, etc.

The repository may include files like `package.json` (Node dependencies) or `requirements.txt` (Python). There could also be configuration for a mapping API key and environment variables, similar to other projects.

## Installation & Setup

1. **Clone the repository:**  
   ```bash
   git clone https://github.com/harshvr24/GeoTrade.git
   cd GeoTrade
   ```
2. **Install dependencies:**  
   If it’s a Node project:  
   ```bash
   npm install
   ```  
   If it’s Python:  
   ```bash
   pip install -r requirements.txt
   ```
3. **Configuration:**  
   Create a `.env` file (or similar) to store API keys. For example:  
   ```
   MAPBOX_TOKEN=your_mapbox_token
   NEWS_API_KEY=your_news_api_key
   # Other keys as needed
   ```
4. **Run the app:**  
   ```bash
   npm run dev  # or `npm start`, or `python app.py`, depending on implementation
   ```  
   Open your browser to `http://localhost:3000` (or the specified port) to view the dashboard.

(*Note:* Details may vary depending on the actual code. For example, if the project uses Docker, there might be a `docker-compose.yml` or `Dockerfile` to build the application.)

## Usage

Once running, GeoTrade provides:

- **Map Exploration:** Navigate the world map to see hotspots. Click markers to view event details (headline, date, location, market effect).
- **Event Sidebar:** The side panel shows a live list of events. You can filter by keywords or categories. (For example, an event feed may show “Trending: Trade disruptions” vs. “Rising tensions” categories.)
- **Data Visualization:** Charts or gauges may display metrics like “Global Trade Index” or “Risk Score”. Hovering or clicking on a chart could link you to relevant news.
- **Search:** A search bar (if present) can find events or countries.  
- **Alerts:** If configured, the app can send email or push notifications for certain events.

As an example, in the Global Threat Map dashboard, clicking on a country opens a panel with historical and current conflicts【40†L321-L327】. GeoTrade might similarly allow clicking a country to see recent trade agreements or disputes affecting that nation.

## Examples / Screenshots


<!-- Example images might be embedded here in a real README, e.g.:  
![GeoTrade Map View](path/to/map_view.png)  
![Event Feed](path/to/event_feed.png)  
-->

Below is a conceptual example of what the interface might look like:

<img width="1916" height="957" alt="Screenshot 2026-03-21 234458" src="https://github.com/user-attachments/assets/fc6f2d7a-58d8-46ec-9ca0-c06502891787" />


- *Interactive Global Map:* Shows colored markers for events.

<img width="1914" height="957" alt="Screenshot 2026-03-21 234518" src="https://github.com/user-attachments/assets/23b165af-4363-4449-8353-f799cfe6f182" />


- *Filter Panel:* Offers checkboxes or dropdowns to filter event categories.

<img width="1912" height="953" alt="Screenshot 2026-03-21 234526" src="https://github.com/user-attachments/assets/461106e0-14a2-484e-9e52-25e723c91a06" />


- *Event Details:* Pop-up windows with news summaries and impact analysis.

<img width="1912" height="953" alt="Screenshot 2026-03-21 234541" src="https://github.com/user-attachments/assets/1f567f59-d4f4-4bb2-b65c-2c81b850fadf" />


These elements combine to give traders and analysts a “big picture” of how world events are influencing markets and trade flows in real time【34†L471-L480】【40†L321-L327】.

