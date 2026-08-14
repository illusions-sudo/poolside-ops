# Poolside Pro

Build a Production-Ready Pool Service Management SaaS — Version 1

I want you to build a functional, production-quality web application for a pool service company.

This is Version 1 of a larger SaaS product. The goal of Version 1 is to create the core business management system for pool-service companies.

Do NOT build a simple prototype or static demo. Build the actual application architecture, database, authentication, CRUD functionality, relationships between records, calculations, and working workflows.

The application should be designed so that future versions can add technician scheduling, route optimization, mobile technician workflows, customer portals, automated SMS/email, advanced reporting, inventory, chemical tracking, and other features without requiring the core architecture to be rebuilt.

1. TECHNOLOGY AND ARCHITECTURE

Use a modern, scalable architecture.

Preferred stack:

React

TypeScript

Tailwind CSS

Supabase for PostgreSQL database, authentication, and storage

Stripe for payment processing when payment functionality is implemented

GitHub-compatible source code

Responsive design for desktop, tablet, and mobile

Use Supabase Row Level Security so that one company's data can never be accessed by another company.

Structure the application as a multi-tenant SaaS from the beginning.

Every business/customer/company account must have its own isolated data.

Do not hard-code demo data into the application.

Create proper database tables, relationships, indexes, validation, error handling, loading states, empty states, and confirmation dialogs.

2. USER TYPES

Version 1 should support these roles:

Company Owner / Administrator

Can:

Manage company information

Create/edit/delete customers

Create/edit/delete properties

Create/edit/delete pools

Create/edit/delete service plans

Create/edit/delete invoices

Record payments

View financial dashboards

View customer history

Manage application settings

Employee

Can:

View customers

View properties

View pools

View service information

View invoices

Add service notes

Add customer notes

Employees should not have access to sensitive company-level settings unless specifically authorized.

Build the role system so additional roles can easily be added later.

3. AUTHENTICATION

Create a complete authentication system.

Include:

Sign up

Login

Logout

Forgot password

Reset password

Change password

User profile

Company account creation

When a new company signs up, create the company/organization record and associate the first user as the owner.

A user must belong to one company/organization.

Prepare the architecture for users to potentially belong to multiple organizations in a future version.

4. MAIN NAVIGATION

Create a clean professional SaaS dashboard with a left-hand navigation menu.

Navigation:

Dashboard

Customers

Properties

Service Plans

Service History

Invoices

Payments

Reports

Settings

Use a clean, modern interface designed specifically for a professional pool-service company.

The application should feel like serious business software, not a generic AI-generated dashboard.

5. DATABASE STRUCTURE

Create a relational PostgreSQL database.

At minimum create these tables:

organizations

Fields:

id

name

business_name

email

phone

website

address

city

state

zip

logo_url

created_at

updated_at

users / profiles

Fields:

id

organization_id

first_name

last_name

email

phone

role

active

created_at

updated_at

customers

Fields:

id

organization_id

first_name

last_name

company_name

email

phone

alternate_phone

billing_address

billing_city

billing_state

billing_zip

notes

active

created_at

updated_at

properties

A customer may have multiple properties.

Fields:

id

organization_id

customer_id

property_name

address

city

state

zip

access_notes

gate_code

property_notes

active

created_at

updated_at

pools

A property may have one or more pools.

Fields:

id

organization_id

property_id

pool_name

pool_type

approximate_volume

surface_type

equipment_notes

special_instructions

active

created_at

updated_at

service_plans

Fields:

id

organization_id

customer_id

property_id

pool_id

service_name

description

frequency

price

billing_frequency

next_service_date

active

created_at

updated_at

Support at minimum:

Weekly

Every 2 weeks

Monthly

One-time

Custom

service_records

Fields:

id

organization_id

customer_id

property_id

pool_id

service_plan_id

service_date

technician_id

status

notes

customer_visible_notes

created_at

updated_at

Statuses:

Scheduled

Completed

Cancelled

Skipped

Prepare this table for future chemical readings, photos, equipment readings, and technician data.

invoices

Fields:

id

organization_id

customer_id

property_id

invoice_number

invoice_date

due_date

subtotal

tax

discount

total

amount_paid

amount_due

status

notes

created_at

updated_at

Invoice statuses:

Draft

Sent

Paid

Partially Paid

Overdue

Void

Automatically calculate:

subtotal
tax
discount
total
amount_paid
amount_due

Do not allow users to manually enter calculated totals.

invoice_items

Fields:

id

invoice_id

description

quantity

unit_price

total

service_plan_id

created_at

Automatically calculate line-item totals.

payments

Fields:

id

organization_id

customer_id

invoice_id

payment_date

amount

payment_method

transaction_reference

notes

status

created_at

Payment methods:

Cash

Check

Credit Card

ACH

Other

Payment status:

Pending

Completed

Failed

Refunded

customer_notes

Fields:

id

organization_id

customer_id

property_id

note

created_by

created_at

Create the database with appropriate foreign keys and cascading behavior.

6. CUSTOMER MANAGEMENT

Create a Customers page with:

Search

Filtering

Sorting

Add Customer

Edit Customer

Archive Customer

Customer detail page

Customer detail page should contain tabs:

Overview

Show:

Contact information

Properties

Active service plans

Current balance

Recent invoices

Recent payments

Recent service records

Properties

List all properties belonging to the customer.

Billing

Show:

Current balance

Total outstanding

Invoice history

Payment history

Service History

Show all service records chronologically.

Notes

Show internal customer notes.

Allow adding and editing notes.

7. PROPERTY MANAGEMENT

Within each customer, allow adding properties.

Property page should show:

Property address

Pool information

Access instructions

Gate information

Service plans

Service history

Invoices associated with the property

Notes

Allow multiple properties per customer.

8. SERVICE PLAN MANAGEMENT

Create a Service Plans page.

Allow users to:

Create service plan

Edit service plan

Pause service plan

Cancel service plan

Reactivate service plan

Service plan should include:

Customer

Property

Pool

Service name

Frequency

Price

Billing frequency

Next service date

Description

Active/inactive status

Display service plans in a clear table.

Include filters:

Active

Inactive

Weekly

Biweekly

Monthly

9. SERVICE HISTORY

Create a Service History page.

Display service records in a table.

Columns:

Date

Customer

Property

Pool

Service plan

Technician

Status

Notes

Allow users to:

Add service record

Edit service record

Mark completed

Cancel

Add notes

Create a service record detail view.

Prepare the UI for future functionality where technicians can enter:

Chemical readings

Chemicals added

Equipment readings

Photos

Customer signatures

Do not implement those advanced features yet.

10. INVOICING

Create a complete invoicing system.

Users should be able to:

Create invoice

Edit draft invoice

Add invoice items

Delete invoice items

Set invoice date

Set due date

Apply tax

Apply discount

Add notes

Save draft

Mark invoice as sent

Void invoice

Invoice numbers should automatically generate sequentially for each organization.

Example:

INV-1001
INV-1002
INV-1003

Do not allow duplicate invoice numbers.

Calculate:

Subtotal

Tax

Discount
= Total

Then:

Total

Payments
= Amount Due

Automatically determine invoice status based on payment and due date.

If amount due = $0:

Paid

If amount paid > $0 but amount due > $0:

Partially Paid

If due date has passed and amount due > $0:

Overdue

Otherwise:

Sent

11. INVOICE DETAIL PAGE

Create a professional invoice layout.

Include:

Company information
Customer information
Property information
Invoice number
Invoice date
Due date
Line items
Subtotal
Tax
Discount
Total
Amount paid
Amount due
Notes

Include buttons:

Edit

Record Payment

Mark Sent

Void

Print

Download PDF

Generate a professional PDF invoice.

The invoice should look suitable for a real business sending it to a paying customer.

12. PAYMENT MANAGEMENT

Create a Payments page.

Display:

Payment date

Customer

Invoice

Amount

Payment method

Status

Reference number

Allow manually recording payments.

When a payment is recorded:

Add the payment to the payments table.

Update the invoice amount_paid.

Recalculate amount_due.

Automatically update invoice status.

Example:

Invoice = $500

Payment = $200

Amount paid = $200

Amount due = $300

Status = Partially Paid

If another $300 payment is made:

Amount paid = $500

Amount due = $0

Status = Paid

Do not allow payments greater than the remaining invoice balance unless explicitly marked as an overpayment.

13. DASHBOARD

Create a useful business dashboard.

Display:

Revenue

Revenue this month

Revenue this year

Revenue last month

Accounts Receivable

Total outstanding

Current

Overdue

Number of overdue invoices

Customers

Total customers

Active customers

New customers this month

Service

Active service plans

Services completed this month

Services scheduled

Cancelled/skipped services

Recent Activity

Show recent:

Payments

New customers

Invoices

Service records

Attention Required

Display:

Overdue invoices

Unpaid invoices

Failed payments if applicable

Inactive service plans

Dashboard numbers must come from the actual database.

Do not use fake statistics.

14. REPORTS

Create a basic Reports page.

Version 1 reports:

Revenue Report

Filter by:

Date range

Show:

Total revenue

Number of invoices

Number of payments

Average invoice amount

Accounts Receivable Report

Show:

Customer

Invoice

Invoice date

Due date

Total

Amount paid

Amount due

Days overdue

Customer Revenue Report

Show:

Customer

Total invoiced

Total paid

Current balance

Allow exporting reports to CSV.

15. SETTINGS

Create Settings sections:

Company

Business name

Contact information

Address

Logo

Invoice Settings

Invoice prefix

Starting invoice number

Default payment terms

Default tax rate

Default invoice notes

Users

Show company users.

Owner can:

Invite employee

Deactivate employee

Change role

Account

User profile

Password

Logout

16. SEARCH

Implement global search.

Users should be able to search:

Customers

Properties

Invoices

Invoice numbers

Service plans

Search should return useful results and allow clicking directly into the relevant record.

17. DESIGN REQUIREMENTS

The design should be:

Professional

Clean

Modern

Simple

Fast

Easy to understand

Designed for daily business use

Do not over-design it.

Prioritize usability over decorative elements.

Use clear typography, cards, tables, badges, forms, dropdowns, modals, and confirmation dialogs.

The application should work beautifully on:

Desktop

Laptop

Tablet

Mobile

Use responsive layouts.

18. IMPORTANT DATA RULES

This application must be multi-tenant.

Every database query must respect organization_id.

A user must NEVER be able to see another organization's customers, invoices, payments, properties, or other data.

Implement Supabase Row Level Security policies.

Do not rely solely on frontend filtering for security.

Validate permissions server-side/database-side.

19. ERROR HANDLING

Implement proper error handling.

Examples:

Failed database request

Invalid form input

Duplicate invoice number

Missing customer

Missing property

Invalid payment

Unauthorized access

Display helpful user-facing messages.

Do not expose technical database errors to normal users.

20. EMPTY STATES

Every major page needs a useful empty state.

Examples:

"No customers yet"

[Add Your First Customer]

"No invoices yet"

[Create Invoice]

"No service records yet"

[Add Service Record]

Do not leave blank screens.

21. SAMPLE DATA

Create an optional development/demo seed dataset so the application can be tested.

Use clearly fictional data.

Example company:

"Mountain View Pool Service"

Example customers:

John Smith
Sarah Johnson
Robert Williams

Include:

Several properties

Pools

Service plans

Service records

Invoices

Payments

Make it possible to remove/reset demo data.

Do not mix demo data into a real customer's account.

22. FUTURE ARCHITECTURE

Do NOT implement these yet, but design the database and UI so they can be added later:

Technician mobile app

Route optimization

Calendar

Drag-and-drop scheduling

Chemical tracking

Chemical inventory

Equipment tracking

Pool water chemistry

Customer portal

Customer login

Online payments

Stripe

ACH

Recurring automatic billing

Automatic invoice generation

Automatic payment retries

Email

SMS

Push notifications

QuickBooks integration

Estimates/quotes

Contracts

Inventory

Employee time tracking

GPS/location

Photos

Customer signatures

Advanced analytics

Do not build these features now.

However, do not create an architecture that prevents them from being added later.

23. IMPORTANT DEVELOPMENT RULES

Before implementing, analyze the requirements and create the database schema and relationships.

Build the application in logical stages.

After each major stage, verify that the application still works.

Do not replace working functionality with placeholder screens.

Do not create buttons that do nothing.

Every button displayed in the UI should perform a real action or be clearly marked as unavailable/future functionality.

Do not use fake backend responses.

Do not hard-code dashboard numbers.

Do not store important application data only in browser local storage.

Use the database as the source of truth.

Use reusable components.

Use TypeScript types.

Keep the code organized and maintainable.

Use migrations for database schema changes.

Create proper indexes for frequently queried fields.

24. SUCCESS CRITERIA

Version 1 should allow me to perform this complete workflow:

Create an account.

Create my pool-service company.

Log in.

Create a customer.

Add a property.

Add a pool.

Create a recurring service plan.

Create a service record.

Create an invoice for that customer.

Add invoice line items.

Calculate the invoice automatically.

Record a payment.

See the payment reflected on the invoice.

See the remaining balance.

See the invoice change to Paid when fully paid.

See the customer balance update.

See the dashboard update.

See the transaction in the payment history.

See the invoice and service history on the customer profile.

Generate/print a professional invoice PDF.

The entire workflow must use real persistent database data.

25. FINAL INSTRUCTION

Build this as the foundation of a real commercial SaaS product.

Do not attempt to copy PoolBrain's branding, proprietary interface, wording, code, or other protected material.

The product should be an independently designed pool-service business management application that competes in the same general market.

Start by establishing the database architecture, authentication, multi-tenant security, and core application shell.

Then implement the customer/property/service/invoicing/payment workflows.

After implementation, test the complete workflow end-to-end and fix any errors you find.

Do not stop at a visual prototype.

The result should be a genuinely functional Version 1 application.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ea6f7817-c984-404a-8f13-757af200214c).

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
