# Deacon Schedule

Build a production-ready, simple, mobile-first web app for managing Coptic Orthodox deacons Friday liturgy service scheduling.

TECH STACK
- Frontend: Lovable UI (clean, minimal, mobile-first, RTL Arabic support)
- Backend: Supabase (Auth, Database, RLS, Storage, Realtime)
- Authentication: Email/password + Google OAuth

MAIN IDEA
This app is a manual service scheduling tool used by church servants to organize Friday liturgy for deacons.

NO AUTOMATION RULE
- The system must NOT auto-assign users to any service.
- The system must NOT suggest assignments.
- All assignments are fully manual by the servant (admin).

ROLES SYSTEM
- admin (servant/khadem - main scheduler)
- deacon (shamas)
- servant (khadem - optional secondary admins)
- pending (default for all new users)

IMPORTANT ADMIN
The only initial admin account is:
- noopsboba@gmail.com

USER REGISTRATION
Users register with:
- full_name (4-part name)
- age
- profile_image
- whatsapp_number
- optional_phone_number
- address
- church_name
- spiritual_father_name
- email + password OR Google login
- role request (deacon or servant)

After registration:
- all users are set to "pending"
- users cannot access full schedule until approved

ADMIN APPROVAL SYSTEM
Admin can:
- view pending users
- approve or reject users
- assign role (deacon or servant)
- write rejection reason if rejected

Once approved:
- user becomes active and visible in system

SCHEDULING SYSTEM (FULLY MANUAL)
Admin creates weekly Friday liturgy schedule manually.

For each service, admin must select users from a list of approved deacons.

Service structure:
- Morning incense (Bakhour)
- Gospel readings:
  - First hour
  - Third hour
  - Sixth hour
  - Ninth hour
- Paul epistle
- Catholic epistle
- Acts reading
- Altar service (multi-select users)
- Screen service (multi-select users)

UI REQUIREMENTS:
- Each service has a "Select users" button
- Opens a list of approved deacons
- Admin manually selects users
- Multi-select allowed where needed
- No automatic assignment or suggestions

PUBLISH FLOW
- Admin creates schedule as draft
- Admin reviews it
- Admin publishes it to all users

USER DASHBOARD
Each user sees:
- their assigned services only
- full schedule overview (read-only)
- attendance response section

ATTENDANCE SYSTEM
Each assigned user must respond:
- "I will attend"
- "I cannot attend"

If user selects "cannot attend":
- must select reason:
  - exams
  - travel
  - illness
  - family reasons
  - other (text required)

REPLACEMENT SYSTEM
If a user declines:
- admin receives notification
- admin manually selects replacement from approved deacons list

CONTACT SYSTEM
Each user profile shows:
- WhatsApp number
- phone number

Next to each number provide:
- Call button (tel:)
- WhatsApp button (wa.me link)

USER MANAGEMENT FEATURES (ADMIN)
Admin can:
- view all users
- filter users by:
  - alphabetical order
  - age
  - role
  - status (pending/approved/rejected)
  - attendance history
- search users by name

DATABASE DESIGN (SUPABASE TABLES)

1. users
- id
- full_name
- age
- role
- status (pending/approved/rejected)
- whatsapp
- phone
- address
- church_name
- spiritual_father
- profile_image_url

2. schedules
- id
- week_date
- status (draft/published)
- created_by

3. schedule_assignments
- id
- schedule_id
- user_id
- service_type
- status (assigned/declined/confirmed)

4. attendance_responses
- id
- user_id
- schedule_id
- response (attend/decline)
- reason

SECURITY (VERY IMPORTANT)
- Only admin (noopsboba@gmail.com) can:
  - create schedules
  - publish schedules
  - approve/reject users
- Users can only:
  - view their own assignments
  - respond to attendance
- Use Supabase Row Level Security (RLS) properly to enforce this

UI STYLE
- minimal and clean
- mobile-first
- Arabic RTL support
- simple cards layout
- fast navigation
- designed for students (very simple UX)
- WhatsApp-first communication

PRIORITY
- Simplicity over complexity
- Manual control over automation
- Real-world usability for church service organization

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://abanoub-church.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6747c034-e333-43f8-b377-0f853253b7d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
