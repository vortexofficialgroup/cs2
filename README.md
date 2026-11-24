<div align="center">

![Header](https://capsule-render.vercel.app/api?type=waving&color=CC0000&height=200&section=header&text=UE%20Campus%20Portal&fontSize=52&fontColor=ffffff&animation=fadeIn)

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&pause=1000&color=CC0000&center=true&vCenter=true&width=600&lines=UE+Smart+Campus+Portal;Find+your+classroom+in+seconds;Live+timetable+-+no+more+guessing;Indoor+navigation+via+QR+code;Built+for+UE+Dubai)](https://git.io/typing-svg)

<br/>

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Vercel Functions](https://img.shields.io/badge/Vercel-Functions-000000?style=for-the-badge&logo=vercel&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

<br/>

> A smart campus web portal for **University of Europe for Applied Sciences — Dubai**  
> Check classroom availability, find your class by matric number, and navigate the building — all in one place.

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗓️ **Live Timetable Engine** | Weekly schedule with a live/simulated clock — rooms show as taken or free in real time |
| 🔍 **Find My Class** | Enter your matriculation number and instantly see your current or next class + room |
| 🧭 **Indoor Navigation** | "You Are Here" map with `?from=` QR code support for room-to-room directions |
| 🏫 **Room Details on Click** | Click any occupied room to see course name, professor, and schedule details |
| 📐 **Smart Capacity Rule** | Rooms with 45+ students automatically suggest merging with Room 2 |
| 🔎 **Course Search** | Search any course to see if it has started and which room it's in |
| 🛠️ **Admin Dashboard** | Staff can manage timetables, rooms, and view occupancy at a glance |
| 💬 **Complaint Box** | Anonymous complaint and feedback submission for students |
| 🤖 **Campus Chatbot** | AI-powered assistant for campus FAQs and room queries |

---

## 🏗️ Project Structure

```
Ue-portal/
├── frontend/
│   ├── index.html          # Main portal entry
│   ├── timetable.html      # Live weekly timetable
│   ├── find-class.html     # Find My Class (matric number search)
│   ├── navigation.html     # Indoor navigation map
│   ├── admin.html          # Admin / staff dashboard
│   ├── complaint.html      # Complaint box
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── timetable.js
│   │   ├── navigation.js
│   │   └── chatbot.js
│   └── assets/
│       └── rooms/          # Classroom photos (add your own)
│
├── backend/
│   ├── server.js           # Express entry point
│   ├── routes/
│   │   ├── timetable.js
│   │   ├── rooms.js
│   │   └── complaints.js
│   └── data/
│       └── timetable.json  # Timetable seed data
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- npm v9+
- Git

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/astrax-gif/Ue-portal.git
cd Ue-portal

# 2. Install backend dependencies
cd backend
npm install

# 3. Start the backend
npm start
# Server runs at http://localhost:3000

# 4. Open the frontend
# Open frontend/index.html in your browser
# or use Live Server in VS Code
```

---

## ☁️ Deploying to Vercel

The production project is connected to this GitHub repository. Push to `main`
to trigger a Vercel deployment; deployment status is available in the Vercel
project dashboard.

For shared admin state, run [`db/supabase-shared-state.sql`](db/supabase-shared-state.sql)
in your Supabase project's SQL Editor. If your database was set up with an older
script, run [`db/migrations-2026-11-24.sql`](db/migrations-2026-11-24.sql) once to
add the staff setup flag and the staff change log. Add `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` to the Vercel project's Production environment
variables, then redeploy. Keep the service-role key server-only.

---

## 🎨 Design

- **Color palette:** UE Dubai red `#CC0000` + white
- **Fonts:** Inter / system-ui
- **Style:** Clean, minimal — optimized for quick room lookups on mobile

---



## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js serverless functions |
| Data | JSON (timetable seed) |
| Hosting | Vercel |

---

## 👨‍💻 Author

**Made for UE Dubai

---

<div align="center">

![Footer](https://capsule-render.vercel.app/api?type=waving&color=CC0000&height=100&section=footer&animation=fadeIn)

</div>
