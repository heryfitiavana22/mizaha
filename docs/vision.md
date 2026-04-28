# Vision

## The Idea

A natural language-driven company search engine.

The user describes in natural language what they are looking for.
The system finds, qualifies, and presents matching companies with the right contact.

---

## The Problem Solved

Existing tools (Apollo, Hunter, LinkedIn Sales Navigator) have rigid, manual filters.
Nobody allows you to say:

> "I'm a React/Node.js dev, find me French SaaS startups that recently raised funding and are hiring a developer"

and get a qualified list automatically.

What people do manually today:

1. Define criteria in their head
2. Browse LinkedIn, Google, Crunchbase for hours
3. Visit each site to qualify manually
4. Find the right contact
5. Write a message

All of this takes days. The system automates it in minutes.

---

## Who Uses It

### Phase 1 — MVP for personal use

A freelance developer looking for clients in France.
No login, no multi-user. Personal use only.

### Phase 2 — Product for others

- Freelancers (dev, design, consulting) looking for clients
- Small agencies doing manual prospecting (copy-pasting into Excel)
- Sales people spending their days on LinkedIn

### Phase 3 — SaaS Platform

Multi-tenant, paid plans, CRM integrations, external API, automatic recurring searches.
Any type of user, any use case.

---

## What We Are NOT Building Now

| What we skip            | When it comes                                    |
| ----------------------- | ------------------------------------------------ |
| Auth / login            | Phase 2 (multi-user)                             |
| Automated email sending | After MVP — we generate a draft, the human sends |
| International support   | After France is validated                        |
| CRM integrations        | Phase 3                                          |
| Plans and billing       | Phase 3                                          |

---

## Far Future

The pipeline is generic by design. Any use case can be added without touching the engine:

- Investor looking for startups to fund
- Supplier looking for client companies
- Recruiter looking for companies that are hiring
- Journalist looking for companies for an article
- Partner looking for integrators

The platform becomes a configurable engine where each user defines their own use case in natural language.
