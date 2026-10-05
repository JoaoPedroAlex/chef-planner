# ChefOps Planner

ChefOps Planner is a web application concept for a chef or culinary operations team to manage client requests, event schedules, grocery costs, and net profit calculations.

## Project Vision

This application helps a chef manage:

- Google Calendar integration for events and daily schedule
- Daily operational workload and planning
- Client requests, event details, and preferences
- Menu-document attachments managed with each client request
- Quoted prices and grocery cost inputs
- Net profit calculation from revenue minus grocery costs

## Product Requirements

### Core Features

1. Dashboard for calendar, daily schedule, and workload
2. Client request management with externally prepared menu-document attachments
3. Quoted price and grocery cost tracking
4. Net profit calculation and reporting
5. Multi-client planning for chefs handling private events and catering work

### Planned Technical Stack

The project currently uses a static HTML, CSS, and JavaScript prototype. A production version can later evolve into:

- Frontend: React, Vue, or plain JavaScript
- Backend: Node.js, Python Flask, or NestJS
- Database: PostgreSQL or SQLite
- Calendar integration: Google Calendar API
- Single-chef workflow with no authentication layer

## Local Usage

Open the static HTML file directly in a browser: <https://joaopedroalex.github.io/chef-planner/>

or run a local static server:

python3 -m http.server 8000

Then visit <http://localhost:8000>.
