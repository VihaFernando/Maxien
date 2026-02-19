Maxien — Personal Life OS

Maxien is a personal productivity web application designed to centralize and manage all aspects of daily life — including work, university, personal tasks, clients, knowledge, and documentation — in one unified system.

It is built as a modular platform that grows over time, allowing features to be added gradually while maintaining a simple and clean workflow.

✨ Overview

Maxien acts as a personal control center where you can organize tasks, manage projects, store documents, track reminders, and integrate external tools like Google services — all in one place.

The goal is to create a flexible system tailored to personal workflows instead of forcing rigid productivity structures.

🚀 Features (Planned & In Progress)

🔐 Authentication & User Profile

📊 Dashboard Overview

📝 Notes & Documentation

✅ Task & Reminder Management

📅 Calendar Integration

💼 Project & Client Management

📁 File & Attachment System

🔔 Notifications

🔗 Google Integrations (Drive, Docs, Sheets, Gmail)

🧩 Modular Feature Expansion

📚 Knowledge Base

🎯 Goals & Life Tracking

🏗️ Tech Stack

Frontend

React (Vite)

Tailwind CSS

Zustand / React Query

Backend / Services

Supabase (Database & Auth)

Supabase Edge Functions

Storage

Google Drive API

Integrations

Google APIs

🧠 Architecture

Maxien follows a modular architecture where features are built as independent modules connected through a central database.

The application uses Supabase as a backend-as-a-service, reducing infrastructure overhead while allowing secure and scalable data handling.

🎯 Project Goals

Create a single source of truth for daily life management

Reduce context switching between tools

Build a flexible productivity system

Maintain a lightweight and fast user experience

Keep the project fully free and self-maintained

Continuously evolve based on personal workflow needs

📂 Project Structure
maxien/
│
├── src/
│   ├── components/
│   ├── modules/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── styles/
│
├── public/
├── supabase/
└── README.md

🔒 Security

Authentication and access control are handled through Supabase. Sensitive operations and integrations are managed through secure serverless functions.

🛠️ Development Approach

Maxien is built incrementally, with features added one at a time to ensure stability and maintainability.

The focus is on usability and real-world practicality rather than feature overload.

🌱 Future Vision

Maxien aims to evolve into a fully integrated personal operating system that intelligently connects tasks, knowledge, projects, and life planning into a seamless workflow.

👤 Author

Vihanga Fernando
Software Engineer

📜 License

This project is for personal use and development.
