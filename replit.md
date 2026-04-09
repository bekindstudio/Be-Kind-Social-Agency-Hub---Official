# Agency Hub - Portale Interno

## Overview

Agency Hub is an internal portal designed for marketing and communication agencies to manage clients, projects, tasks, teams, and shared files. It aims to streamline agency operations, enhance collaboration, and provide comprehensive insights into project performance and client relationships.

Key capabilities include:
- Client and project management with advanced filtering and privacy settings.
- Task management with Kanban view, prioritization, and team assignments.
- Real-time chat channels for project-specific and general communication.
- Secure file sharing with direct upload and object storage integration.
- Comprehensive reporting features, including AI-generated summaries and PDF exports.
- Centralized social media and advertising account management with real-time data integration.
- AI Assistant for contextual help and content generation.
- Editorial Calendar for content planning, scheduling, and analysis.
- Daily Focus tool for prioritized task management.
- Time tracking for project billing and productivity monitoring.

The project's vision is to be the central nervous system for agencies, providing a unified platform for all operational needs, from client acquisition to project delivery and performance analysis.

## User Preferences

- The user wants the agent to manage all aspects of the agency's internal portal, including client, project, task, team, chat, and file management.
- The agent should focus on implementing and maintaining the specified features and integrating external services.
- The agent should prioritize the use of `pnpm` for package management and `TypeScript` for development.
- The agent should ensure the application is responsive and works well on various devices.
- The agent should be aware of the different user roles and their associated permissions when making changes or suggesting features.
- The agent should pay attention to the specific requirements for PDF exports and email notifications, ensuring professional formatting and reliable delivery.
- The agent should handle AI assistant integrations by ensuring proper context awareness and conversation management.

## System Architecture

The Agency Hub is built as a monorepo using `pnpm workspaces`.

**Technology Stack:**
- **Node.js**: Version 24
- **Package Manager**: `pnpm`
- **TypeScript**: Version 5.9
- **Frontend**: React with Vite and Tailwind CSS (`agency-portal`)
- **Backend API**: Express 5 (`api-server`)
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)

**UI/UX Decisions:**
- **Dashboard**: Features statistics, project status, recent activity, Recharts graphs (task trends, project distribution), revenue forecasts, conversion rates, and team statistics.
- **Dark Mode**: Toggleable via sidebar, preference saved in localStorage, uses a sage green dark theme.
- **Responsive Layout**: Collapsible sidebar for mobile/tablet, hamburger menu for navigation.
- **Kanban View**: Drag-and-drop interface for task management.
- **Search**: Global search functionality (Ctrl+K) across clients, projects, tasks, quotes, and contracts, with grouped results.
- **Notifications**: Bell icon in sidebar, polling every 30 seconds, read/unread status, navigation links, badge counter, automatic deadline notifications.
- **PDF Export**: Professional formatting for quotes, reports, and editorial plans using `jsPDF` and `html2canvas`.

**Core Features & Implementations:**
- **Authentication**: Clerk (`@clerk/react`, `@clerk/express`) for user authentication and authorization, with `RequireAuth` middleware on all routes.
- **Roles & Permissions**: Four defined roles (admin, account_manager, creative, viewer) with granular access control. Admin access is controlled via `ADMIN_CLERK_USER_IDS` environment variable and `user_roles` table.
- **Client-Level Access Control**: Team members can only view assigned clients, implemented via `team_client_access` table and helper functions (`getAccessibleClientIds()`, `filterByClientAccess()`).
- **Activity Log**: Tracks user actions (`activity_log` table) with API for recording and listing activities.
- **File Management**: Direct upload to Object Storage (Google Cloud Storage) using presigned URLs, with drag-and-drop, multi-file support, progress bars, and search/filter capabilities.
- **AI Assistant**: Integrates Anthropic's Claude (`claude-sonnet-4-6`) via Replit AI Integrations proxy. Provides context-aware conversations, history management, and streaming SSE responses.
- **Editorial Plan**: Comprehensive content calendar with content slots, status workflow, default categories, system templates, and PDF export.
- **Daily Focus**: A daily popup using the Eisenhower Matrix to prioritize tasks, with timers, completion tracking, and celebration animations.
- **Time Tracker**: Persistent timer in the top bar, manual and automatic start, detailed logging modal, and a dashboard for time entries, statistics, and weekly/daily timelines.
- **Brief & Strategy**: Section within client details for structured brief input, AI-powered parsing into 11 sections, and generation of 10-chapter strategies with SSE streaming and HTML sanitization.
- **Report System**: Manages client reports with various types (weekly, monthly, quarterly), 7 sections, KPI JSON, workflow (draft, in_review, approved, sent), PDF export, and email functionality.

## External Dependencies

- **Database**: PostgreSQL
- **Object Storage**: Google Cloud Storage (for file uploads)
- **Authentication**: Clerk (for user management)
- **AI Integration**: Anthropic Claude (via Replit AI Integrations proxy)
- **Social Media APIs**:
    - Meta Graph API (for Instagram profile data, Meta Ads data)
- **Advertising APIs**:
    - Google Ads API (for campaign data and summary)
- **Email Service**: SMTP (configurable via environment variables for `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`)
- **PDF Generation**: `jsPDF` and `html2canvas` (client-side)
- **Charting**: Recharts