# Hero GraphQL API – Vollständiges Schema

_Stand: 2026-04-30 – Endpoint: https://login.hero-software.de/api/external/v7/graphql_

Query-Root: `PartnerQuery`  ·  Mutation-Root: `PartnerMutation`

## Query Root: `PartnerQuery`

| Feld | Args | Typ | Beschreibung |
|------|------|------|--------------|
| `echo` | message: String | `String` | For testing. Echoes the given string |
| `user` | — | `User` | Returns the current user |
| `configuration` | — | `Configuration` | Returns the global platform configuration |
| `company` | — | `Company` | Returns the current company |
| `contacts` | orderBy: String, first: Int, last: Int, offset: Int, ids: Int[], category: CustomerCategoryEnum, search: String, show_deleted: Boolean | `Customer[]` | Find contacts |
| `countries` | — | `Country[]` | Returns all countries |
| `project_match` | project_match_id: Int | `ProjectMatch` | Find single project |
| `project_matches` | orderBy: String, first: Int, last: Int, offset: Int, type: String, ids: Int[], customer_id: Int, search: String, statuses: Int[], step_ids: Int[], assigned_user_ids: Int[], relative_id: String, type_ids: Int[], measure_ids: Int[], overdue: Boolean | `ProjectMatch[]` | Find projects |
| `notifications` | orderBy: String, first: Int, last: Int, offset: Int | `Notification[]` | Find notifications |
| `file_uploads` | orderBy: String, first: Int, last: Int, offset: Int, uuids: String[]! | `FileUpload[]` | Get file uploads by UUID |
| `tasks` | orderBy: String, first: Int, last: Int, offset: Int, project_match_id: Int, start: DateTime, end: DateTime, is_done: Boolean, show_deleted: Boolean, ids: Int[], target_user_ids: Int[], author_user_ids: Int[] | `Task[]` | Find tasks |
| `tracking_times` | orderBy: String, first: Int, last: Int, offset: Int, project_match_id: Int, start: Date, end: Date, ids: Int[], show_all_partners: Boolean, partner_ids: Int[], statuses: Employees_TrackingTimeStatusEnum[], tracking_times_category_ids: Int[] | `Employees_TrackingTime[]` | Returns a list of timetracking entries for the current user |
| `tracking_times_categories` | is_working_time: Boolean, is_active: Boolean, is_protected: Boolean, orderBy: String, first: Int, last: Int, offset: Int | `Employees_TrackingTimesCategory[]` | Find categories for time tracking entries |
| `upload_image_categories` | orderBy: String, first: Int, last: Int, offset: Int, project_match_id: Int, target: LinkTargetEnum, target_id: Int | `String[]` | Find image categories for file uploads |
| `histories` | orderBy: String, first: Int, last: Int, offset: Int | `History[]` | Find logbook history entries |
| `project_histories` | orderBy: String, first: Int, last: Int, offset: Int, project_match_id: Int, user_ids: Int[], show_system_histories: Boolean, search_term: String | `History[]` | Find logbook history entries for a given project |
| `project_match_checklists` | orderBy: String, first: Int, last: Int, offset: Int, project_match_id: Int | `FieldService_Checklist[]` | Find checklists for given project |
| `file_upload_folders` | orderBy: String, first: Int, last: Int, offset: Int, show_deleted: Boolean | `FileUploadFolder[]` | Find file upload folders |
| `global_search` | orderBy: String, first: Int, last: Int, offset: Int, category: SearchCategoryEnum, term: String | `SearchResult[]` | Search for project_matches, jobs, contacts, documents, partners |
| `project_types` | orderBy: String, first: Int, last: Int, offset: Int, ids: Int[], is_active: Boolean | `ProjectType[]` | Get all active project pipeline types |
| `email_template` | email_template_id: Int | `EmailTemplate` | Find single email template |
| `search_calendar_events` | orderBy: String, first: Int, last: Int, offset: Int, search: String, startDate: String, showDeleted: Boolean | `CalendarEvent[]` | Search calendar events by event, customer or project name |
| `calendar_events` | start: DateTime, end: DateTime, project_match_id: Int, partner_ids: Int[], resource_ids: Int[], show_deleted: Boolean, ids: Int[], orderBy: String, first: Int, last: Int, offset: Int | `CalendarEvent[]` |  |
| `calendar_imports` | — | `CalendarImport[]` |  |
| `calendar_event_categories` | show_deleted: Boolean | `CalendarEventCategories[]` |  |
| `holidays` | start: Date, end: Date, state_ids: Int[] | `Holiday[]` |  |
| `resources` | show_deleted: Boolean | `CompanyResource[]` | Get the company resources |
| `customer_documents` | ids: Int[], file_upload_folder_ids: Int[], document_type_ids: Int[], project_match_ids: Int[], status_codes: Int[], invoice_style: InvoiceStyle, orderBy: String, first: Int, last: Int, offset: Int | `CustomerDocument[]` |  |
| `customer_document_types` | — | `CustomerDocumentType[]` |  |
| `document_types` | ids: Int[]!, show_deleted: Boolean, user_write_allowed: Boolean, base_types: String[], context: String, orderBy: String, first: Int, last: Int, offset: Int | `Documents_DocumentType[]` |  |
| `supply_texts` | orderBy: String, first: Int, last: Int, offset: Int | `Documents_SupplyText[]` |  |
| `field_service_jobs` | project_match_id: Int, partner_id: Int, start: DateTime, end: DateTime, status: Int[], partners: Int[], contact_id: Int, search: String, orderBy: String, first: Int, last: Int, offset: Int | `FieldService_Job[]` | Note: partner_id argument is deprecated. |
| `job_checklists` | job_id: Int, orderBy: String, first: Int, last: Int, offset: Int | `FieldService_Checklist[]` |  |
| `field_service_job` | id: Int | `FieldService_Job` |  |
| `field_service_checklist_template` | id: Int | `FieldService_ChecklistTemplate` |  |
| `field_service_checklist_templates` | ids: Int[], orderBy: String, first: Int, last: Int, offset: Int | `FieldService_ChecklistTemplate[]` |  |
| `field_service_object` | id: Int | `FieldService_ServiceObject` |  |
| `absences` | orderBy: String, first: Int, last: Int, offset: Int, start: Date, end: Date, ids: Int[], show_all_partners: Boolean, partner_ids: Int[], statuses: Employees_AbsenceStatusEnum[] | `Employees_Absence[]` | Get a list of filtered absences for the current user |
| `absence_balance` | year: Int, partner_id: Int | `AbsencesBalances` | Fetch the absence balance for given year |
| `tracking_time_balance` | start: Date, end: Date, partner_id: Int | `Employees_TimeTrackingBalance` |  |
| `absence_budget` | start: Date!, end: Date!, type: Employees_AbsenceTypeEnum!, start_budget: Employees_AbsenceBudgetTypeEnum, end_budget: Employees_AbsenceBudgetTypeEnum | `Employees_Absence` |  |
| `partner_birthdays` | nextDays: Int, orderBy: String, first: Int, last: Int, offset: Int | `Employees_PartnerBirthday[]` | Returns the list of the next upcoming birthdays |
| `project_leads` | ids: Int[], orderBy: String, first: Int, last: Int, offset: Int | `Leads_ProjectLead[]` |  |
| `supply_products` | orderBy: String, first: Int, last: Int, offset: Int, search: String | `Documents_SupplyProduct[]` | Query to get supply products (deprecated, use supply_product_versions) |
| `supply_product_versions` | orderBy: String, first: Int, last: Int, offset: Int, product_ids: String[], search: String | `Documents_SupplyProductVersion[]` | Query to get supply product versions |
| `new_supply_product_version` | — | `Documents_SupplyProductVersion[]` | Create a new supply product version template |
| `supply_services` | orderBy: String, first: Int, last: Int, offset: Int, service_ids: Int[], search: String | `Documents_SupplyService[]` | Query to get supply services |
| `new_supply_service` | — | `Documents_SupplyService[]` | Create a new supply service template |
| `costcenters` | orderBy: String, first: Int, last: Int, offset: Int, ids: Int[], number: String, skr_number: Int | `Accounting_CostCenter[]` | Query the cost centers |
| `bookaccounts` | orderBy: String, first: Int, last: Int, offset: Int, ids: Int[], name: String, type: String | `Accounting_BookAccount[]` | Query bookaccounts |
| `receipts` | orderBy: String, first: Int, last: Int, offset: Int, ids: Int[], status_code: Int, number: String, tax_id: Int, customer_id: Int | `Accounting_Receipt[]` | Query to get receipts |
| `aggregate_webhooks` | providers: String[], is_active: Boolean! | `Int` | Aggregate webhooks |
| `webhooks` | orderBy: String, first: Int, last: Int, offset: Int, providers: String[], ids: Int[] | `Webhooks_Webhook[]` | Find configured webhooks |
| `webhook_event_types` | — | `Webhooks_WebhookEventType[]` | List available webhook event types |
| `custom_fields_schemas` | orderBy: String, first: Int, last: Int, offset: Int, schemaIds: String[] | `CustomFields_Schema[]` | Retrieve custom field schemas for company. |
| `custom_field_records` | orderBy: String, first: Int, last: Int, offset: Int, relation: CustomFields_SchemaRelationTypeEnum!, schemaIds: String[], relationIds: Int[] | `CustomFields_Record[]` | Retrieve all custom field records a company and relation type. |
| `EmailTemplate_EmailTemplates` | filters: EmailTemplate_EmailTemplateFiltersInput, before: String, after: String, first: Int, offset: Int, sortings: EmailTemplate_EmailTemplateSortingInput[]! | `EmailTemplate_EmailTemplateConnection` | Returns a list of email templates for the current partner |
| `Receipt_Receipts` | filters: Receipt_ReceiptFiltersInput, before: String, after: String, first: Int, offset: Int, sortings: Receipt_ReceiptSortingInput[]! | `Receipt_ReceiptConnection` | Returns a paginated list of receipts. |

## Object Types (112)

### AbsencesBalances

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `budget` | `Float!` |  |
| `notSent` | `Float!` |  |
| `requestedBudget` | `Float!` |  |
| `totalApprovedBudget` | `Float!` |  |
| `availableBudget` | `Float!` |  |
| `plannedBudget` | `Float!` |  |

### Accounting_BookAccount

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `name` | `String` |  |
| `type` | `String` |  |
| `skr03_number` | `Int` |  |
| `skr04_number` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |

### Accounting_CostCenter

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `name` | `String` |  |
| `number` | `String` |  |
| `color` | `String` |  |
| `company` | `Company` |  |
| `skr_number` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Accounting_Receipt

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `file_upload` | `FileUpload` |  |
| `receipt_positions` | `Accounting_ReceiptPosition[]` |  |
| `customer` | `Customer` |  |
| `company` | `Company` |  |
| `tax_id` | `Int` |  |
| `type` | `String` |  |
| `status_code` | `Int` |  |
| `receipt_date` | `DateTime` |  |
| `due_date` | `DateTime` |  |
| `number` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `export_date` | `DateTime` |  |
| `paid_date` | `DateTime` |  |
| `paid_sum` | `Float` |  |
| `value` | `Float` |  |

### Accounting_ReceiptPosition

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `description` | `String` |  |
| `value` | `Float` |  |
| `vat` | `Float` |  |
| `vat_incl` | `Boolean` |  |
| `receipt` | `Accounting_Receipt` |  |
| `book_account` | `Accounting_BookAccount` |  |
| `cost_center` | `Accounting_CostCenter` |  |
| `project_match` | `ProjectMatch` |  |
| `value_incl_vat` | `Float` |  |
| `value_excl_vat` | `Float` |  |
| `deleted` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Acl

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `key` | `String` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `group` | `String` |  |
| `value` | `String` |  |
| `level` | `String` |  |

### Action

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `key` | `String` |  |
| `title` | `String` |  |
| `icon` | `String` |  |
| `href` | `String` |  |
| `data_action` | `String` |  |
| `data_url` | `String` |  |
| `data` | `JSON` |  |

### Address

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `street` | `String` |  |
| `city` | `String` |  |
| `zipcode` | `String` |  |
| `country` | `Country` |  |
| `country_id` | `Int` |  |
| `full_address` | `String` |  |
| `basic_address` | `String` |  |
| `maps_link` | `String` |  |
| `customer_address` | `CustomerAddress` |  |
| `latitude` | `Float` |  |
| `longitude` | `Float` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `line_1` | `String` |  |
| `line_2` | `String` |  |
| `state_id` | `Int` |  |

### CalendarEvent

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `category` | `CalendarEventCategory` |  |
| `category_id` | `Int` |  |
| `project_match` | `ProjectMatch` |  |
| `project_match_id` | `Int` |  |
| `title` | `String` |  |
| `description` | `String` |  |
| `start` | `DateTime` |  |
| `end` | `DateTime` |  |
| `all_day` | `Boolean` |  |
| `deleted` | `Boolean` |  |
| `color` | `String` |  |
| `partners` | `Partner[]` |  |
| `resources` | `CompanyResource[]` |  |
| `is_done` | `Boolean` |  |
| `is_recurring` | `Boolean` |  |
| `provider` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `type` *(deprecated)* | `String` |  |
| `localized_type` *(deprecated)* | `String` |  |
| `url` *(deprecated)* | `String` |  |
| `full_address` *(deprecated)* | `String` |  |
| `title_lines` *(deprecated)* | `String[]` |  |
| `partner_id` *(deprecated)* | `Int` |  |
| `readonly` | `Boolean` |  |

### CalendarEventCategories

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `color` | `String` |  |
| `deleted` | `Boolean` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### CalendarEventCategory

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `color` | `String` |  |
| `deleted` | `Boolean` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### CalendarImport

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `uid` | `String` |  |
| `title` | `String` |  |
| `resource` | `String` |  |
| `url` | `String` |  |
| `is_hidden` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### CalendarShareLink

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `id` | `Int` |  |
| `token` | `String` |  |
| `calendar_url` | `String` |  |
| `webcal_url` | `String` |  |

### Company

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `legal_form` | `String` |  |
| `founding_date` | `Date` |  |
| `cooperation_date` | `Date` |  |
| `street` | `String` |  |
| `city` | `String` |  |
| `zipcode` | `String` |  |
| `default_phone` | `String` |  |
| `default_fax` | `String` |  |
| `is_test` | `Boolean` |  |
| `measures` | `Measure[]` |  |
| `layout` | `String` |  |
| `company_logo` *(deprecated)* | `Mixed` |  |
| `address` | `Address` |  |
| `address_id` | `Int` |  |
| `signup_wizard` | `Int` |  |
| `company_branches` | `CompanyBranch[]` |  |
| `bank_name` | `String` |  |
| `iban` | `String` |  |
| `bic` | `String` |  |
| `account_holder` | `String` |  |
| `currency` | `String` |  |
| `currency_sign` | `String` |  |
| `country` *(deprecated)* | `Country` |  |
| `tax` | `String` |  |
| `hrb_number` | `String` |  |
| `ust_id_number` | `String` |  |
| `website` | `String` |  |
| `default_mobile` | `String` |  |
| `support_enabled` | `Boolean` |  |
| `general_manager_title` | `String` |  |
| `general_manager` | `String` |  |
| `status_saas` | `String` |  |
| `ai_feature_consent` | `Boolean` |  |
| `location_tracking_consent` | `Boolean` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `features` | `CompanyFeature[]` |  |
| `partners` | `Partner[]` |  |
| `is_paid` | `Boolean` |  |
| `referral_codes` *(deprecated)* | `Referral_ReferralCode[]` |  |

### CompanyBranch

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `address` | `Address` |  |
| `radius` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `marker_color` | `String` |  |
| `id` | `Int` |  |
| `partners` | `Partner[]` |  |

### CompanyFeature

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `title` | `String` |  |
| `is_active` | `Boolean` |  |
| `settings` | `Mixed` |  |
| `end` | `Date` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### CompanyResource

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `company_id` | `Int` |  |
| `type_id` | `Int` |  |
| `name` | `String` |  |
| `resource_type` | `CompanyResourceType` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `type` *(deprecated)* | `String` |  |
| `company_branch` *(deprecated)* | `CompanyBranch` |  |

### CompanyResourceType

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `company_id` | `Int` |  |
| `name` | `String` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Configuration

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `domain` | `String` |  |
| `design` | `String` |  |
| `name` | `String` |  |
| `name_html` | `String` |  |
| `company_logo` | `FileUpload` |  |
| `company_logo_id` | `Int` |  |
| `currency` | `String` |  |
| `locale` | `String` |  |
| `timezone` | `String` |  |
| `country_id` | `Int` |  |
| `country` | `Country` |  |
| `favicon_id` | `Int` |  |
| `favicon` | `FileUpload` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `instance` | `Configuration` |  |

### Country

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `code` | `String` |  |
| `name` | `String` |  |
| `vat` | `Float` |  |
| `red_vat` | `Float` |  |
| `currency` | `String` |  |
| `id` | `Int` |  |

### CountryState

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |

### Customer

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `user_id` | `Int` |  |
| `type` | `String` |  |
| `title` | `String` |  |
| `title_custom` | `String` |  |
| `first_name` | `String` |  |
| `last_name` | `String` |  |
| `company_name` | `String` |  |
| `company_legal_form` | `String` |  |
| `phone_home` | `String` |  |
| `phone_mobile` | `String` |  |
| `phone_fax` | `String` |  |
| `url` | `String` |  |
| `address_id` | `Int` |  |
| `reachability` | `Int` |  |
| `source` | `String` |  |
| `position` | `String` |  |
| `user` | `User` |  |
| `address` | `Address` |  |
| `customer_addresses` | `CustomerAddress[]` |  |
| `project_matches` | `ProjectMatch[]` |  |
| `category` | `String` |  |
| `company_id` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `nr` | `String` |  |
| `parent_customer_id` | `Int` |  |
| `email` | `String` |  |
| `offer_options` | `JSON` |  |
| `parent_customer` | `Customer` |  |
| `contacts` | `Customer[]` |  |
| `is_deleted` | `Boolean` |  |
| `full_name` | `String` |  |
| `phone_home_formatted` | `String` |  |
| `phone_mobile_formatted` | `String` |  |
| `is_invoice_recipient` | `Boolean` |  |
| `reachability_string` | `String` |  |
| `initial_name` | `String` |  |
| `category_name` | `String` |  |
| `contact_match_id` | `Int` |  |
| `is_contact_person` | `Boolean` |  |
| `contact_match` | `ProjectMatch` |  |
| `id` | `Int` |  |
| `partner_notes` | `String` |  |
| `birth_date` | `Date` |  |

### Customer_Address

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `street` | `String!` |  |
| `line1` | `String` |  |
| `line2` | `String` |  |
| `city` | `String!` |  |
| `zipcode` | `String!` |  |
| `countryId` | `Int!` |  |
| `country` | `Customer_Country!` |  |

### Customer_Country

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `code` | `String!` |  |
| `name` | `String!` |  |

### Customer_Customer

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `email` | `String!` |  |
| `nr` | `String!` |  |
| `title` | `String!` |  |
| `category` | `Customer_CustomerCategory!` |  |
| `companyName` | `String!` |  |
| `firstName` | `String!` |  |
| `lastName` | `String!` |  |
| `isHeroWallet` | `Boolean!` |  |
| `isDeleted` | `Boolean!` |  |
| `addressId` | `Int!` |  |
| `phoneHome` | `String!` |  |
| `phoneMobile` | `String!` |  |
| `phoneFax` | `String!` |  |
| `address` | `Customer_Address` |  |

### CustomerAddress

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `customer` | `Customer` |  |
| `address` | `Address` |  |
| `address_id` | `Int` |  |
| `title` | `String` |  |
| `description` | `String` |  |
| `customer_id` | `Int` |  |
| `is_deleted` | `Boolean` |  |
| `id` | `Int` |  |

### CustomerDocument

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `nr` | `String` |  |
| `status_code` | `Int` |  |
| `type` | `String` |  |
| `document_type_id` | `Int` |  |
| `project_match_id` | `Int` |  |
| `company_id` | `Int` |  |
| `contact_id` | `Int` |  |
| `partner_id` | `Int` |  |
| `customer_invoice_id` | `Int` |  |
| `file_upload_id` | `Int` |  |
| `file_upload` | `FileUpload` |  |
| `file_upload_folder_id` | `Int` |  |
| `file_upload_folder` | `FileUploadFolder` |  |
| `date` | `Date` |  |
| `value` | `Float` |  |
| `vat` | `Float` |  |
| `currency` | `String` |  |
| `published_customer_document_draft_id` | `Int` |  |
| `selected_document_id` | `Int` |  |
| `source` | `String` |  |
| `source_id` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `document_type` | `Documents_DocumentType` |  |
| `company` | `Company` |  |
| `contact` | `Customer` |  |
| `partner` | `Partner` |  |
| `project_match` | `ProjectMatch` |  |
| `published_customer_document_draft` | `Documents_CustomerDocumentDraft` |  |
| `status_name` | `String` |  |
| `origin_link` *(deprecated)* | `Mixed` |  |
| `document_links` | `DocumentLink[]` |  |
| `metadata` | `CustomerDocumentMetadata` |  |
| `localized_type` *(deprecated)* | `String` |  |
| `customer_document_booking` | `CustomerDocumentBooking` |  |
| `booking_relevant` *(deprecated)* | `Boolean` |  |
| `link_view` | `String` |  |
| `customer` | `Customer` |  |
| `is_gaeb` | `Boolean` |  |
| `id` | `Int` |  |
| `actions` | `Action[]` |  |

### CustomerDocumentBooking

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `status` | `String` |  |
| `status_name` | `String` |  |
| `is_open` | `Boolean` |  |
| `discount_rate` | `Float` |  |
| `discount_time` | `Int` |  |
| `discount_date` | `Date` |  |
| `due_date` | `Date` |  |
| `paid_date` | `Date` |  |
| `show_vat` | `Boolean` |  |
| `payments` | `Payment[]` |  |
| `customer_document` | `CustomerDocument` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `balance` | `Float` |  |

### CustomerDocumentLayoutOption

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `disable_unit_price` | `Boolean` |  |
| `show_vat` | `Boolean` |  |
| `tax_exempt` *(deprecated)* | `Boolean` |  |
| `positions_order_quantity` | `Boolean` |  |
| `positions_col_image` | `Boolean` |  |
| `number_prefix` | `String` |  |
| `subject_prefix` | `String` |  |
| `project_address_prefix` | `String` |  |
| `text_preamble` | `Documents_SupplyText` |  |
| `text_closing` | `Documents_SupplyText` |  |
| `booking_category` | `CustomerDocumentBookingCategoryEnum` | The booking category of the document. This is used to determine the tax rate of the document. For possible values lookup `CustomerDocumentBookingCategoryEnum` |

### CustomerDocumentMetadata

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `is_signed` | `Boolean` |  |
| `positions` | `CustomerDocumentPosition[]` |  |
| `invoice_style` | `InvoiceStyle` |  |

### CustomerDocumentPosition

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `type` | `String` |  |
| `name` | `String` |  |
| `net_value` | `Float` |  |
| `vat` | `Float` |  |
| `cost_center_id` | `Int` |  |
| `cost_center_number` | `String` |  |
| `nr` | `String` |  |

### CustomerDocumentType

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `type` | `String` |  |
| `prefix` | `String` |  |
| `name` | `String` |  |
| `plural` | `String` |  |
| `context` | `String[]` |  |
| `has_total_price` | `Boolean` |  |
| `user_allowed` | `Boolean` |  |
| `user_write_allowed` | `Boolean` |  |
| `layout_options` | `CustomerDocumentLayoutOption` |  |

### CustomFields_Property

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `uuid` | `String!` |  |
| `type` | `CustomFields_PropertyTypeEnum!` |  |
| `label` | `String!` |  |
| `position` | `Int!` |  |
| `hint` | `String` |  |
| `options` | `String[]` |  |
| `unit` | `String` |  |
| `suffix` | `String` |  |
| `deleted` | `Boolean!` |  |

### CustomFields_PropertyValue

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `uuid` | `String!` |  |
| `value` | `String` |  |

### CustomFields_Record

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `schema` | `CustomFields_Schema!` |  |
| `companyId` | `Int!` |  |
| `relationId` | `Int!` |  |
| `properties` | `CustomFields_PropertyValue[]` |  |
| `createdByUserId` | `Int!` |  |
| `lastModifiedByUserId` | `Int` |  |

### CustomFields_Schema

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `schemaId` | `String!` |  |
| `companyId` | `Int!` |  |
| `relates` | `CustomFields_SchemaRelationTypeEnum!` |  |
| `properties` | `CustomFields_Property[]` |  |
| `createdByUserId` | `Int!` |  |
| `lastModifiedByUserId` | `Int` |  |

### DocumentLink

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `target` | `String` |  |
| `target_id` | `Int` |  |
| `target_relation` | `String` |  |
| `document_id` | `Int` |  |
| `field_service_job` | `FieldService_Job` |  |
| `target_url` | `String` |  |
| `id` | `Int` |  |

### Documents_CustomerDocumentDraft

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `customer_document_id` | `Int` |  |
| `customer_document` | `CustomerDocument` |  |
| `type` | `String` |  |
| `document_type_id` | `Int` |  |
| `name` | `String` |  |
| `status_code` | `Int` |  |
| `nr` | `String` |  |
| `date` | `Date` |  |
| `value` | `Float` |  |
| `data` | `Mixed` |  |
| `partner` | `Partner` |  |
| `partner_id` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `is_protected` | `Boolean` |  |
| `description` | `String` |  |
| `deleted` | `Boolean` |  |
| `id` | `Int` |  |
| `customer_invoice_id` *(deprecated)* | `Int` |  |

### Documents_CustomerDocumentNote

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `customerDocumentId` | `Int!` |  |
| `note` | `String!` |  |
| `created` | `DateTime!` |  |
| `modified` | `DateTime!` |  |

### Documents_DocumentType

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `is_active` | `Boolean` |  |
| `base_type` | `String` |  |
| `options` | `CustomerDocumentLayoutOption` |  |
| `booking_relevant` | `Boolean` |  |
| `file_upload_folder_id` | `Int` |  |
| `number_range_id` | `Int` |  |
| `parent_document_type_id` | `Int` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `context` | `String[]` |  |
| `has_total_price` | `Boolean` |  |
| `user_allowed` | `Boolean` |  |
| `user_write_allowed` | `Boolean` |  |
| `has_valid_payment_setup` | `Boolean` |  |
| `next_number` | `String` |  |

### Documents_SupplyCatalog

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `is_default` | `Boolean` |  |
| `name` | `String` |  |
| `service_connector` | `String` |  |
| `catalog_key` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyOperator

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `type` | `String` |  |
| `name` | `String` |  |
| `customer_id` | `Int` |  |
| `customer` | `Customer` |  |
| `service_integrations` | `ServiceIntegrations_ServiceIntegration[]` |  |
| `receiver` | `Mixed` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyProduct

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `String` |  |
| `company_id` | `Int` |  |
| `ean` | `String` |  |
| `matchcode` | `String` |  |
| `internal_identifier` | `String` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `manufacturer` | `String` |  |
| `manufacturer_nr` | `String` |  |
| `unit_type` | `String` |  |
| `base_price` | `Float` |  |
| `net_price_per_unit` | `Float` |  |
| `vat_percent` | `Float` |  |
| `supply_service_id` | `Int` |  |
| `nr` | `String` |  |
| `file_upload` | `FileUpload` |  |
| `file_upload_id` | `Int` |  |
| `supply_operator_id` | `Int` |  |
| `supplier_id` | `String` |  |
| `supply_product_sales_prices` | `Documents_SupplyProductSalesPrice[]` |  |
| `quantity_min` | `Float` |  |
| `quantity_interval` | `Float` |  |
| `price_quantity` | `Float` |  |
| `default_sales_price_id` | `Int` |  |
| `quantity` | `Float` |  |
| `time_minutes` | `Float` |  |
| `list_price` | `Float` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyProductBaseData

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` *(deprecated)* | `Int` |  |
| `product_id` | `String` |  |
| `company_id` | `Int` |  |
| `file_upload_id` | `Int` |  |
| `file_upload` | `FileUpload` |  |
| `supply_catalog_id` | `Int` |  |
| `supply_catalog` | `Documents_SupplyCatalog` |  |
| `supplier_id` | `String` |  |
| `name` | `String` |  |
| `ean` | `String` |  |
| `matchcode` | `String` |  |
| `description` | `String` |  |
| `manufacturer` | `String` |  |
| `manufacturer_nr` | `String` |  |
| `manufacturer_type_name` | `String` |  |
| `quantity_min` | `Float` |  |
| `quantity_interval` | `Float` |  |
| `price_quantity` | `Float` |  |
| `delivery_time` | `Int` |  |
| `unit_type` | `String` |  |
| `is_deleted` | `Boolean` |  |
| `category` | `String` |  |
| `external_url` | `String` |  |
| `image_src` | `String` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyProductSalesPrice

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `supply_sales_price_id` | `Int` |  |
| `supply_sales_price` | `Documents_SupplySalesPrice` |  |
| `net_price_per_unit` | `Float` |  |
| `label` | `String` |  |
| `hasDifferentPrice` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyProductVersion

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` *(deprecated)* | `Int` |  |
| `product_id` | `String` |  |
| `company_id` | `Int` |  |
| `base_data` | `Documents_SupplyProductBaseData` |  |
| `supply_operator_id` | `Int` |  |
| `supply_operator` | `Documents_SupplyOperator` |  |
| `sales_prices` | `Documents_SupplyProductSalesPrice[]` |  |
| `supply_surcharges` | `Documents_SupplySurcharge[]` |  |
| `internal_identifier` | `String` |  |
| `nr` | `String` |  |
| `base_price` | `Float` |  |
| `list_price` | `Float` |  |
| `vat_percent` | `Float` |  |
| `is_deleted` | `Boolean` |  |
| `default_sales_price_id` | `Int` |  |
| `price_quantity` | `Float` |  |
| `quantity_min` | `Float` |  |
| `quantity_interval` | `Float` |  |
| `delivery_time` | `Int` |  |
| `stock_materials` | `Stock_StockMaterial[]` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `attributes` | `JSON` |  |

### Documents_SupplySalesPrice

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `operator` | `String` |  |
| `sales_change` | `Float` |  |
| `name` | `String` |  |
| `is_default` | `Boolean` |  |
| `calculation_base` | `String` |  |
| `label` | `String` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplyService

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `company_id` | `Int` |  |
| `ean` | `String` |  |
| `internal_identifier` | `String` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `manufacturer` | `String` |  |
| `unit_type` | `String` |  |
| `net_price_per_unit` | `Float` |  |
| `vat_percent` | `Float` |  |
| `positions` | `Documents_SupplyServicePosition[]!` |  |
| `nr` | `String` |  |
| `file_upload` | `FileUpload` |  |
| `is_fixed_net_price` | `Boolean` |  |
| `quantity` | `Float` |  |
| `time_minutes` | `Float` |  |
| `is_deleted` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Documents_SupplySurcharge

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `created` | `DateTime` |  |
| `product_id` | `String` |  |
| `description` | `String` |  |
| `value` | `Float` |  |
| `is_percentual` | `Boolean` |  |
| `is_material_dependent` | `Boolean` |  |
| `calculated_value` | `Float` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |

### Documents_SupplyText

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `type` | `String` |  |
| `title` | `String` |  |
| `text` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### EmailTemplate

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `is_protected` | `Boolean` |  |
| `context` | `String` |  |
| `subject` | `String` |  |
| `body` | `String` |  |
| `extra` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `employee_id` | `Int` |  |
| `company_id` | `Int` |  |
| `file_upload_id` | `Int` |  |
| `deleted` | `Boolean` |  |
| `company` | `Company` |  |
| `file_upload` | `FileUpload` |  |
| `recipient` | `String` |  |
| `id` | `Int` |  |

### EmailTemplate_EmailTemplate

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `name` | `String!` |  |
| `context` | `EmailTemplate_EmailTemplateContext!` |  |
| `subject` | `String!` |  |
| `body` | `String!` |  |

### EmailTemplate_EmailTemplateConnection

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `totalCount` | `Int!` |  |
| `edges` | `EmailTemplate_EmailTemplateConnectionEdge[]!` |  |
| `pageInfo` | `EmailTemplate_EmailTemplateConnectionPageInfo!` |  |

### EmailTemplate_EmailTemplateConnectionEdge

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `node` | `EmailTemplate_EmailTemplate!` |  |
| `cursor` | `String!` |  |

### EmailTemplate_EmailTemplateConnectionPageInfo

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `startCursor` | `String` |  |
| `endCursor` | `String` |  |
| `hasNextPage` | `Boolean!` |  |

### Employee

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `first_name` | `String` |  |
| `last_name` | `String` |  |
| `phone` | `String` |  |
| `fax` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `profile_image` | `FileUpload` |  |
| `id` | `Int` |  |

### Employees_Absence

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `type` | `Employees_AbsenceTypeEnum` |  |
| `comment` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `company_id` | `Int` |  |
| `company` | `Company` |  |
| `partner_id` | `Int` |  |
| `partner` | `Partner` |  |
| `start` | `Date` |  |
| `end` | `Date` |  |
| `file_upload` | `FileUpload` |  |
| `id` | `Int` |  |
| `status` | `Employees_AbsenceStatusEnum` |  |
| `start_budget` | `Employees_AbsenceBudgetTypeEnum` |  |
| `end_budget` | `Employees_AbsenceBudgetTypeEnum` |  |
| `budget` | `Float` |  |
| `duration` | `Float` |  |

### Employees_PartnerBirthday

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `partner_id` | `Int` |  |
| `company_id` | `Int` |  |
| `next_birthday` | `Date` |  |
| `partner` | `Partner` |  |

### Employees_TimeTrackingBalance

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `expected` | `Int` |  |
| `requested` | `Int` |  |
| `confirmed` | `Int` |  |
| `absent` | `Int` |  |
| `overtime` | `Int` |  |
| `total` | `Int` |  |
| `waiting_for_confirmation` | `Int` |  |
| `not_sent` | `Int` |  |
| `total_unconfirmed` | `Int` |  |

### Employees_TrackingTime

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `uuid` | `String` |  |
| `project_match` | `ProjectMatch` |  |
| `project_match_id` | `Int` |  |
| `company_id` | `Int` |  |
| `tracking_region_id` | `Int` |  |
| `partner_id` | `Int` |  |
| `tracking_times_category_id` | `Int` |  |
| `tracking_workday_id` | `Int` |  |
| `partner` | `Partner` |  |
| `status_code` | `Int` |  |
| `start` | `DateTime` |  |
| `end` | `DateTime` |  |
| `comment` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `field_service_job_id` | `Int` |  |
| `duration_in_seconds` | `Int` |  |
| `customer_documents` | `CustomerDocument[]` |  |
| `tracking_times_category` | `Employees_TrackingTimesCategory` |  |
| `tracking_workday` | `Employees_TrackingWorkday` |  |
| `is_autogenerated` | `Boolean` |  |
| `location` | `TimeTracking_TrackingTimeLocation` |  |
| `ephemeral_id` *(deprecated)* | `Mixed` |  |
| `id` | `Int` |  |
| `category` *(deprecated)* | `String` | The category of the tracked time. |
| `category_name` *(deprecated)* | `String` | The name of the category of the tracked time. |

### Employees_TrackingTimes

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `uuid` | `String` |  |
| `project_match` | `ProjectMatch` |  |
| `project_match_id` | `Int` |  |
| `company_id` | `Int` |  |
| `tracking_region_id` | `Int` |  |
| `partner_id` | `Int` |  |
| `tracking_times_category_id` | `Int` |  |
| `tracking_workday_id` | `Int` |  |
| `partner` | `Partner` |  |
| `status_code` | `Int` |  |
| `start` | `DateTime` |  |
| `end` | `DateTime` |  |
| `comment` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `field_service_job_id` | `Int` |  |
| `duration_in_seconds` | `Int` |  |
| `customer_documents` | `CustomerDocument[]` |  |
| `tracking_times_category` | `Employees_TrackingTimesCategory` |  |
| `tracking_workday` | `Employees_TrackingWorkday` |  |
| `is_autogenerated` | `Boolean` |  |
| `location` | `TimeTracking_TrackingTimeLocation` |  |
| `ephemeral_id` *(deprecated)* | `Mixed` |  |
| `id` | `Int` |  |

### Employees_TrackingTimesCategory

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `internal_name` | `String` |  |
| `is_working_time` | `Boolean` |  |
| `is_active` | `Boolean` |  |
| `is_protected` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Employees_TrackingWorkday

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `date` | `Date` |  |
| `partner_id` | `Int` |  |
| `status_code` | `Int` |  |
| `daily_target` | `Int` |  |
| `worked_time` | `Int` |  |
| `break_time` | `Int` |  |
| `overtime` | `Int` |  |
| `tracking_times` | `Employees_TrackingTimes[]` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `start` | `DateTime` | The start date of the first tracking time. |
| `end` | `DateTime` | The end date of the last tracking time. |
| `is_break_rule_violated` | `Boolean` | Indicates whether the break rule is violated for this workday. |

### FieldService_Checklist

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `field_service_job_id` | `Int` |  |
| `project_match_id` | `Int` |  |
| `author_partner_id` | `Int` |  |
| `author_partner` *(deprecated)* | `Mixed` |  |
| `partner_id` | `Int` |  |
| `partner` | `Partner` |  |
| `status` | `String` |  |
| `name` | `String` |  |
| `data` | `JSON` |  |
| `created` | `DateTime` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |

### FieldService_ChecklistTemplate

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `data` | `JSON` |  |

### FieldService_Job

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `company` | `Company` |  |
| `partners` | `Partner[]` |  |
| `customer_id` | `Int` |  |
| `customer` | `Customer` |  |
| `contact_id` | `Int` |  |
| `contact` | `Customer` |  |
| `project_match_id` | `Int` |  |
| `project_match` | `ProjectMatch` |  |
| `address_id` | `Int` |  |
| `address` | `Address` |  |
| `histories` | `History[]` |  |
| `checklists` | `FieldService_Checklist[]` |  |
| `file_uploads` | `FileUpload[]` |  |
| `documents` | `CustomerDocument[]` |  |
| `type` | `String` |  |
| `status_code` | `Int` |  |
| `start` | `DateTime` |  |
| `end` | `DateTime` |  |
| `title` | `String` |  |
| `description` | `String` |  |
| `created` | `DateTime` |  |
| `localized_type` | `String` |  |
| `status_name` | `String` |  |
| `display_nr` | `String` |  |
| `tracking_times` | `Employees_TrackingTime[]` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `field_service_checklists` | `FieldService_Checklist[]` |  |

### FieldService_ServiceObject

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `company_id` | `Int` |  |
| `customer_id` | `Int` |  |
| `contact_id` | `Int` |  |
| `customer` | `Customer` |  |
| `project_match_id` | `Int` |  |
| `project_match` | `ProjectMatch` |  |
| `service_object_id` *(deprecated)* | `Mixed` |  |
| `address_id` | `Int` |  |
| `address` | `Address` |  |
| `partner_id` | `Int` |  |
| `partner` | `Partner` |  |
| `recurring_start` | `Date` |  |
| `recurring_last` | `Date` |  |
| `recurring_next` | `Date` |  |
| `recurring_period` | `String` |  |
| `recurring_num` | `Int` |  |
| `recurring_action` | `String` |  |
| `created` | `DateTime` |  |
| `status` | `String` |  |
| `recurring_end_num` | `Int` |  |
| `recurring_end_period` | `String` |  |
| `reminder_num` | `Int` |  |
| `reminder_period` | `String` |  |
| `reminder_last` | `Date` |  |
| `reminder_next` | `Date` |  |
| `last_action` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |

### FileUpload

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `uuid` | `String` |  |
| `project_id` | `Int` |  |
| `section` | `String` |  |
| `category` | `String` |  |
| `image_category` | `String` |  |
| `filename` | `String` |  |
| `type` | `String` |  |
| `icon` | `String` |  |
| `url` | `String` |  |
| `size` | `Int` |  |
| `is_deleted` | `Boolean` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `customer_document` | `CustomerDocument` |  |
| `preview_available` | `Boolean` |  |
| `file_upload_links` | `FileUploadLink[]` |  |
| `file_upload_matches` | `FileUploadMatch[]` |  |
| `id` | `Int` |  |
| `src` *(deprecated)* | `String` |  |
| `url_download` | `String!` |  |
| `temporary_url` | `String!` | Returns a temporary public URL for the file upload. The URL is valid for the specified expiration time. |
| `thumbnails` | `Thumbnail[]` |  |

### FileUpload_FileUpload

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `uuid` | `String!` |  |
| `filename` | `String!` |  |
| `category` | `String` |  |
| `type` | `String` |  |
| `size` | `Int` |  |
| `src` | `String` |  |
| `projectId` | `Int` |  |
| `companyId` | `Int` |  |
| `section` | `String` |  |
| `imageCategory` | `String` |  |
| `created` | `DateTime!` |  |
| `modified` | `DateTime!` |  |
| `thumbnails` | `FileUpload_Thumbnails` |  |

### FileUpload_Thumbnails

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `fit64` | `String` |  |
| `fit128` | `String` |  |
| `fit256` | `String` |  |
| `fit512` | `String` |  |
| `fit1024` | `String` |  |
| `logoM` | `String` |  |

### FileUploadFolder

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `type` | `String` |  |
| `company_id` | `Int` |  |
| `is_default_visible` | `Boolean` |  |
| `created` | `DateTime` |  |
| `is_deleted` | `Boolean` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |

### FileUploadLink

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `target` | `String` |  |
| `file_upload_id` | `Int` |  |
| `file_upload` | `FileUpload` |  |
| `target_id` | `Int` |  |
| `target_relation` | `String` |  |
| `customer_id` | `Int` |  |
| `project_match_id` | `Int` |  |
| `id` | `Int` |  |

### FileUploadMatch

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `file_upload_id` | `Int` |  |
| `project_match_id` | `Int` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### History

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `user_id` | `Int` |  |
| `target_project_match_id` | `Int` |  |
| `target_company_id` | `Int` |  |
| `target` | `String` |  |
| `target_id` | `Int` |  |
| `target_job` | `FieldService_Job` |  |
| `type_code` | `Int` |  |
| `associated_outbox_mail_id` | `Int` |  |
| `custom_title` | `String` |  |
| `custom_text` | `String` |  |
| `user` | `User` |  |
| `target_project_match` | `ProjectMatch` |  |
| `target_company` | `Company` |  |
| `associated_outbox_mail` | `OutboxMail` |  |
| `additional_file_uploads` | `FileUpload[]` |  |
| `role_visibility` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `id` | `Int` |  |
| `target_user` *(deprecated)* | `User` |  |
| `target_project` *(deprecated)* | `Project` |  |
| `target_user_id` *(deprecated)* | `Int` |  |
| `target_project_id` *(deprecated)* | `Int` |  |
| `type` *(deprecated)* | `String` |  |
| `weather_attachment` | `HistoryWeatherAttachment` |  |
| `is_editable` | `Boolean` |  |
| `author_name` | `String!` |  |

### HistoryWeatherAttachment

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `main` | `String` |  |
| `description` | `String` |  |
| `temp` | `Float` |  |
| `wind` | `Float` |  |
| `emoji` | `String` |  |
| `icon` | `String` |  |

### Holiday

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `date` | `Date` |  |
| `name` | `String` |  |
| `description` | `String` |  |
| `holiday` | `Boolean` |  |
| `state_id` | `Int` |  |
| `state` | `CountryState` |  |
| `country` | `Country` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `id` | `Int` |  |

### Leads_ProjectLead

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `project_id` | `Int` |  |
| `display_id` | `String` |  |
| `created` | `DateTime` |  |
| `customer_name` | `String` |  |
| `zipcode` | `String` |  |
| `city` | `String` |  |
| `anonymized_address` | `String` |  |
| `measure` | `Measure` |  |
| `partner` | `Partner` |  |
| `marked_company` | `Boolean` |  |
| `project_nr` | `String` |  |
| `partner_notes` | `String` |  |
| `modified` | `DateTime` |  |
| `file_uploads` | `FileUpload[]` |  |

### Measure

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `short` | `String` |  |
| `parent_measure_id` | `Int` |  |
| `projects` | `Project[]` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Notification

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `user_id` | `Int` |  |
| `title` | `String` |  |
| `body` | `String` |  |
| `collapse` | `String` |  |
| `target` | `String` |  |
| `target_id` | `Int` |  |
| `is_read` | `Boolean` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `id` | `Int` |  |

### OutboxMail

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `sender` | `String` |  |
| `recipient` | `String` |  |
| `cc` | `String` |  |
| `bcc` | `String` |  |
| `history` | `History` |  |
| `subject` | `String` |  |
| `body` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Partner

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `first_name` | `String` |  |
| `last_name` | `String` |  |
| `full_name` | `String` |  |
| `initial_last_name` | `String` |  |
| `name` | `String` |  |
| `user` *(deprecated)* | `User` |  |
| `phone` | `String` |  |
| `mobile` | `String` |  |
| `fax` | `String` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `company_branches` | `CompanyBranch[]` |  |
| `company` *(deprecated)* | `Company` |  |
| `user_id` | `Int` |  |
| `company_id` | `Int` |  |
| `profile_image` | `FileUpload` |  |
| `signature_image` | `FileUpload` |  |
| `account_type` | `String` |  |
| `title` | `String` |  |
| `signature` | `String` |  |
| `no_signature` | `Boolean` |  |
| `birth_date` | `Date` |  |
| `address` | `Address` |  |
| `id` | `Int` |  |
| `role` | `PartnerRoleEnum` |  |
| `status` | `PartnerStatusEnum` |  |
| `email` | `String` |  |

### Payment

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `paid_date` | `Date` |  |
| `value` | `Float` |  |
| `invoice_discount_value` | `Float` |  |
| `created` | `DateTime` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |

### Project

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `type` | `String` |  |
| `customer_id` | `Int` |  |
| `address_id` | `Int` |  |
| `current_project_status_id` | `Int` |  |
| `customer` | `Customer` |  |
| `address` | `Address` |  |
| `employee` | `Employee` |  |
| `project_matches` | `ProjectMatch[]` |  |
| `current_project_status` | `ProjectStatus` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `display_name` | `String` |  |
| `name` | `String` |  |
| `partner_source` | `String` |  |
| `measure` | `Measure` |  |
| `measure_id` | `Int` |  |
| `measure_short` | `String` |  |
| `id` | `Int` |  |

### Project_ProjectMatch

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `projectType` | `String!` |  |
| `statusCode` | `Int!` |  |
| `isActive` | `Boolean!` |  |
| `name` | `String!` |  |
| `customer` | `Customer_Customer!` |  |
| `contact` | `Customer_Customer` |  |

### ProjectMatch

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `project_type` | `String` |  |
| `measure_id` | `Int` |  |
| `measure` | `Measure` |  |
| `customer_id` | `Int` |  |
| `customer` | `Customer` |  |
| `address_id` | `Int` |  |
| `address` | `Address` |  |
| `company_id` | `Int` |  |
| `company_branch_id` | `Int` |  |
| `partner_id` | `Int` |  |
| `current_project_match_status_id` | `Int` |  |
| `marked_company` | `Boolean` |  |
| `marked_later` | `Boolean` |  |
| `company_branch` | `CompanyBranch` |  |
| `partner` | `Partner` |  |
| `current_project_match_status` | `ProjectMatchStatus` |  |
| `project_match_statuses` | `ProjectMatchStatus[]` |  |
| `file_uploads` | `FileUpload[]` |  |
| `customer_documents` | `CustomerDocument[]` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `histories` | `History[]` |  |
| `contact` | `Customer` |  |
| `contact_id` | `Int` |  |
| `project_match_assignments` | `ProjectMatchAssignment[]` |  |
| `name` | `String` |  |
| `partner_source` | `String` |  |
| `relative_id` | `Int` |  |
| `partner_notes` | `String` |  |
| `display_id` | `String` |  |
| `project_nr` | `String` |  |
| `project` | `Project` |  |
| `volume` | `Float` |  |
| `project_title` | `String` |  |
| `is_deleted` | `Boolean` |  |
| `project_id` | `Int` |  |
| `id` | `Int` |  |
| `available_actions` | `ProjectMatchAction[]` |  |
| `ppl_price` *(deprecated)* | `Float` |  |
| `type` | `ProjectType` |  |
| `type_id` | `Int` |  |
| `custom_fields_searchable` | `SearchableValue` |  |

### ProjectMatchAction

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `key` | `String` |  |
| `title` | `String` |  |
| `icon` | `String` |  |
| `color` | `String` |  |
| `data_action` | `String` |  |
| `data_url` | `String` |  |
| `event_tracking` | `String` |  |
| `data_event` | `String` |  |
| `data_event_params` | `String` |  |
| `template` | `String` |  |

### ProjectMatchAssignment

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `project_match_id` | `Int` |  |
| `user_id` | `Int` |  |
| `reason` | `String` |  |
| `user` | `User` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### ProjectMatchStatus

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `status_code` | `Int` |  |
| `maturity_date` | `DateTime` |  |
| `maturity_time` | `Mixed` |  |
| `previous_project_match_status_id` | `Int` |  |
| `show_as_skipped` | `Boolean` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `name` | `String` |  |
| `short_name` | `String` |  |
| `step` | `ProjectStatusStep` |  |
| `step_id` | `Int` |  |
| `id` | `Int` |  |

### ProjectStatus

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `status_code` | `Int` |  |
| `maturity_date` | `Date` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `name` | `String` |  |
| `short_name` | `String` |  |
| `id` | `Int` |  |

### ProjectStatusStep

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `status_code` | `Int` |  |
| `name` | `String` |  |
| `sort_order` | `Int` |  |
| `is_active` | `Boolean` |  |
| `project_type_id` | `Int` |  |
| `is_archiving` | `Boolean` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### ProjectType

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `company` | `Company` |  |
| `project_status_steps` | `ProjectStatusStep[]` |  |
| `is_default` | `Boolean` |  |
| `is_active` | `Boolean` |  |
| `name` | `String` |  |
| `name_plural` | `String` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Receipt_Receipt

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `ID!` |  |
| `type` | `String!` |  |
| `statusCode` | `Int!` |  |
| `number` | `String!` |  |
| `receiptDate` | `Date` |  |
| `dueDate` | `Date` |  |
| `paidDate` | `Date` |  |
| `exportDate` | `Date` |  |
| `netValue` | `Float!` |  |
| `value` | `Float!` |  |
| `paidSum` | `Float!` |  |
| `openAmount` | `Float!` |  |
| `taxId` | `Int!` |  |
| `createdAt` | `DateTime` |  |
| `modifiedAt` | `DateTime` |  |
| `fileUploadId` | `Int` |  |
| `customerId` | `Int` |  |
| `customer` | `Customer_Customer` |  |
| `fileUpload` | `FileUpload_FileUpload` |  |
| `receiptPositions` | `Receipt_ReceiptPosition![]!` |  |

### Receipt_ReceiptBookAccount

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `name` | `String!` |  |
| `num` | `String!` |  |

### Receipt_ReceiptConnection

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `totalCount` | `Int!` |  |
| `edges` | `Receipt_ReceiptConnectionEdge[]!` |  |
| `pageInfo` | `Receipt_ReceiptConnectionPageInfo!` |  |

### Receipt_ReceiptConnectionEdge

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `node` | `Receipt_Receipt!` |  |
| `cursor` | `String!` |  |

### Receipt_ReceiptConnectionPageInfo

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `startCursor` | `String` |  |
| `endCursor` | `String` |  |
| `hasNextPage` | `Boolean!` |  |

### Receipt_ReceiptCostCenter

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `name` | `String!` |  |

### Receipt_ReceiptPosition

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `ID!` |  |
| `description` | `String` |  |
| `value` | `Float!` |  |
| `vat` | `Int!` |  |
| `vatIncl` | `Boolean!` |  |
| `valueInclVat` | `Float!` |  |
| `valueExclVat` | `Float!` |  |
| `projectMatchId` | `Int` |  |
| `bookAccount` | `Receipt_ReceiptBookAccount` |  |
| `costCenter` | `Receipt_ReceiptCostCenter` |  |
| `projectMatch` | `Project_ProjectMatch` |  |

### Referral_ReferralCode

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `code` | `String` |  |
| `is_valid` | `Boolean` |  |
| `link` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### SearchableValue
> Represents aggregated searchable values for custom fields

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `values` | `String[]` | Array of individual searchable values |

### ServiceIntegrations_ServiceIntegration

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `company_id` | `Int` |  |
| `connector_name` | `String` |  |
| `enabled` | `Boolean` |  |
| `has_configurator` | `Boolean` |  |
| `has_import` | `Boolean` |  |
| `has_orders` | `Boolean` |  |
| `has_inquiry` | `Boolean` |  |
| `has_quotation` | `Boolean` |  |
| `has_idsconnect` | `Boolean` |  |
| `idsconnect_version` | `String` |  |
| `metadata` | `Mixed` |  |
| `supply_operator_id` | `Int` |  |
| `supply_operator` | `Documents_SupplyOperator` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Stock_StockMaterial

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int!` |  |
| `name` | `String!` |  |
| `description` | `String` |  |
| `item_number` | `String!` |  |
| `qr_id` | `String` |  |
| `category` | `String` |  |
| `unit_type` | `String!` |  |
| `total_stock` | `Float!` |  |
| `open_consignment_items_amount` | `Float!` |  |
| `open_order_items_amount` | `Float!` |  |
| `created` | `DateTime!` |  |
| `modified` | `DateTime!` |  |
| `min_stock` | `Float` |  |
| `target_stock` | `Float` |  |
| `stock_material_sources` | `Stock_StockMaterialSource[]` |  |
| `has_stock_material_sources` | `Boolean!` |  |
| `qr_payload` | `String` |  |

### Stock_StockMaterialSource

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `Int` |  |
| `product_id` | `String` |  |
| `stock_material_id` | `Int` |  |
| `company_id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Task

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `author_user_id` | `Int` |  |
| `author` | `User` |  |
| `company_id` | `Int` |  |
| `target_user_id` | `Int` |  |
| `target_user` | `User` |  |
| `title` | `String` |  |
| `comment` | `String` |  |
| `target_project_match_id` | `Int` |  |
| `target_project_match` | `ProjectMatch` |  |
| `due_date` | `DateTime` |  |
| `done_date` | `DateTime` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `start` | `DateTime` |  |
| `end` | `DateTime` |  |
| `ephemeral_id` *(deprecated)* | `Mixed` |  |
| `is_deleted` | `Boolean` |  |
| `id` | `Int` |  |

### Thumbnail

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `format` | `String!` |  |
| `url` | `String!` |  |

### TimeTracking_TrackingTimeLocation

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `ID!` |  |
| `trackingTimeUuid` | `String!` |  |
| `startPosition` | `TimeTracking_TrackingTimeLocationPosition` |  |
| `endPosition` | `TimeTracking_TrackingTimeLocationPosition` |  |
| `clearedAt` | `DateTime` |  |

### TimeTracking_TrackingTimeLocationPosition

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `ID!` |  |
| `latitude` | `Float!` |  |
| `longitude` | `Float!` |  |
| `horizontalAccuracy` | `Float!` |  |
| `capturedAt` | `DateTime!` |  |
| `createdAt` | `DateTime!` |  |
| `updatedAt` | `DateTime!` |  |

### TopNavigationNotification

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `is_read` | `Boolean!` |  |
| `id` | `Int!` |  |
| `body` | `String!` |  |
| `created` | `String!` |  |
| `title` | `String!` |  |
| `url` | `String!` |  |

### User

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `email` | `String` |  |
| `role` | `String` |  |
| `employee` | `Employee` |  |
| `partner` | `Partner` |  |
| `last_login` | `DateTime` |  |
| `locale` | `String` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |
| `acl` | `Acl[]` |  |
| `has_active_smtp_config` | `Boolean` |  |
| `adminUserId` | `Int` |  |
| `adminPermissions` | `String![]!` |  |
| `acl_permissions` *(deprecated)* | `String` |  |

### WageGroup

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `id` | `String` |  |
| `company_id` | `Int` |  |
| `name` | `String` |  |
| `wage_cost_price` | `Float` |  |
| `wage_per_hour` | `Float` |  |
| `profit_markup` | `Int` |  |
| `created` | `DateTime` |  |
| `modified` | `DateTime` |  |
| `net_price_per_unit` | `Float` |  |
| `unit_type` | `String` |  |
| `quantity` | `Float` |  |
| `time_minutes` | `Float` |  |
| `tracking_time_id` | `Int` |  |
| `activity` | `String` |  |

### Webhooks_Webhook

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `name` | `String` |  |
| `webhook_trigger` | `String` |  |
| `target_url` | `String` |  |
| `token` | `String` |  |
| `is_active` | `Boolean` |  |
| `id` | `Int` |  |
| `modified` | `DateTime` |  |
| `created` | `DateTime` |  |

### Webhooks_WebhookEventType

| Feld | Typ | Beschreibung |
|------|------|--------------|
| `event_type` | `String!` |  |
| `event_label` | `String!` |  |

## Input Types (66)

### AddressInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `street` | `String` | — |
| `city` | `String` | — |
| `zipcode` | `String` | — |
| `country_id` | `Int` | — |
| `full_address` | `String` | — |
| `basic_address` | `String` | — |
| `maps_link` | `String` | — |
| `latitude` | `Float` | — |
| `longitude` | `Float` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `line_1` | `String` | — |
| `line_2` | `String` | — |
| `state_id` | `Int` | — |

### CalendarEventInput

| Feld | Typ | Default |
|------|------|---------|
| `category_id` | `Int` | — |
| `project_match_id` | `Int` | — |
| `title` | `String` | — |
| `description` | `String` | — |
| `start` | `DateTime` | — |
| `end` | `DateTime` | — |
| `all_day` | `Boolean` | — |
| `deleted` | `Boolean` | — |
| `color` | `String` | — |
| `is_done` | `Boolean` | — |
| `is_recurring` | `Boolean` | — |
| `provider` | `String` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `partner_ids` | `Int[]` | — |
| `resource_ids` | `Int[]` | — |

### CalendarImportInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `uid` | `String` | — |
| `title` | `String!` | — |
| `resource` | `String!` | — |
| `url` | `String!` | — |
| `is_hidden` | `Boolean` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |

### CompanyInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String` | — |
| `legal_form` | `String` | — |
| `founding_date` | `Date` | — |
| `cooperation_date` | `Date` | — |
| `street` | `String` | — |
| `city` | `String` | — |
| `zipcode` | `String` | — |
| `default_phone` | `String` | — |
| `default_fax` | `String` | — |
| `is_test` | `Boolean` | — |
| `layout` | `String` | — |
| `address_id` | `Int` | — |
| `signup_wizard` | `Int` | — |
| `bank_name` | `String` | — |
| `iban` | `String` | — |
| `bic` | `String` | — |
| `account_holder` | `String` | — |
| `currency` | `String` | — |
| `currency_sign` | `String` | — |
| `tax` | `String` | — |
| `hrb_number` | `String` | — |
| `ust_id_number` | `String` | — |
| `website` | `String` | — |
| `default_mobile` | `String` | — |
| `support_enabled` | `Boolean` | — |
| `general_manager_title` | `String` | — |
| `general_manager` | `String` | — |
| `status_saas` | `String` | — |
| `ai_feature_consent` | `Boolean` | — |
| `location_tracking_consent` | `Boolean` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `address` | `AddressInput` | — |
| `measures` | `Int[]` | — |

### CreateEmailTemplateInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String!` | — |
| `context` | `String!` | — |
| `subject` | `String!` | — |
| `body` | `String!` | — |
| `file_upload_id` | `Int!` | — |

### CustomerAddressInput

| Feld | Typ | Default |
|------|------|---------|
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `address_id` | `Int` | — |
| `title` | `String` | — |
| `description` | `String` | — |
| `customer_id` | `Int` | — |
| `is_deleted` | `Boolean` | — |
| `id` | `Int` | — |
| `address` | `AddressInput` | — |

### CustomerDocumentInput

| Feld | Typ | Default |
|------|------|---------|
| `nr` | `String` | — |
| `status_code` | `Int` | — |
| `type` | `String` | — |
| `document_type_id` | `Int` | — |
| `project_match_id` | `Int` | — |
| `company_id` | `Int` | — |
| `contact_id` | `Int` | — |
| `partner_id` | `Int` | — |
| `customer_invoice_id` | `Int` | — |
| `file_upload_id` | `Int` | — |
| `file_upload_folder_id` | `Int` | — |
| `date` | `Date` | — |
| `value` | `Float` | — |
| `vat` | `Float` | — |
| `currency` | `String` | — |
| `published_customer_document_draft_id` | `Int` | — |
| `selected_document_id` | `Int` | — |
| `source` | `String` | — |
| `source_id` | `String` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `status_name` | `String` | — |
| `metadata` | `Mixed` | — |
| `localized_type` | `String` | — |
| `booking_relevant` | `Boolean` | — |
| `link_view` | `String` | — |
| `is_gaeb` | `Boolean` | — |
| `id` | `Int` | — |
| `show_vat` | `Boolean` | — |
| `use_next_number` | `Boolean` | — |

### CustomerInput

| Feld | Typ | Default |
|------|------|---------|
| `user_id` | `Int` | — |
| `type` | `String` | — |
| `title` | `String` | — |
| `title_custom` | `String` | — |
| `first_name` | `String` | — |
| `last_name` | `String` | — |
| `company_name` | `String` | — |
| `company_legal_form` | `String` | — |
| `phone_home` | `String` | — |
| `phone_mobile` | `String` | — |
| `phone_fax` | `String` | — |
| `url` | `String` | — |
| `address_id` | `Int` | — |
| `reachability` | `Int` | — |
| `source` | `String` | — |
| `position` | `String` | — |
| `category` | `String` | — |
| `company_id` | `Int` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `nr` | `String` | — |
| `parent_customer_id` | `Int` | — |
| `email` | `String` | — |
| `offer_options` | `JSON` | — |
| `is_deleted` | `Boolean` | — |
| `full_name` | `String` | — |
| `phone_home_formatted` | `String` | — |
| `phone_mobile_formatted` | `String` | — |
| `is_invoice_recipient` | `Boolean` | — |
| `reachability_string` | `String` | — |
| `initial_name` | `String` | — |
| `category_name` | `String` | — |
| `contact_match_id` | `Int` | — |
| `is_contact_person` | `Boolean` | — |
| `id` | `Int` | — |
| `address` | `AddressInput` | — |
| `partner_notes` | `String` | — |
| `birth_date` | `Date` | — |

### CustomFields_PropertyInput

| Feld | Typ | Default |
|------|------|---------|
| `type` | `CustomFields_PropertyTypeEnum` | — |
| `label` | `String!` | — |
| `position` | `Int!` | — |
| `options` | `String[]` | — |
| `suffix` | `String` | — |
| `hint` | `String` | — |

### CustomFields_PropertyUpdate

| Feld | Typ | Default |
|------|------|---------|
| `uuid` | `String!` | — |
| `label` | `String` | — |
| `position` | `Int` | — |
| `options` | `String[]` | — |
| `suffix` | `String` | — |
| `hint` | `String` | — |

### CustomFields_PropertyValueInput

| Feld | Typ | Default |
|------|------|---------|
| `propertyUuid` | `String!` | — |
| `value` | `String` | — |

### DateFilterInput

| Feld | Typ | Default |
|------|------|---------|
| `equals` | `DateTime` | — |
| `greaterThan` | `DateTime` | — |
| `greaterThanOrEqual` | `DateTime` | — |
| `lessThan` | `DateTime` | — |
| `lessThanOrEqual` | `DateTime` | — |

### Documents_AddExistingServiceActionInput

| Feld | Typ | Default |
|------|------|---------|
| `supplyServiceId` | `Int!` | — |
| `quantity` | `Float` | — |
| `source` | `Documents_SourceEnum` | — |
| `insertAfter` | `String` | — |

### Documents_AddExistingWageGroupActionInput

| Feld | Typ | Default |
|------|------|---------|
| `serviceUid` | `String!` | — |
| `wageGroupId` | `Int!` | — |
| `timeMinutes` | `Float` | — |
| `activity` | `String` | — |

### Documents_AddProductPositionActionInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String!` | — |
| `description` | `String` | — |
| `nr` | `String` | — |
| `unit_type` | `String!` | — |
| `image_url` | `String` | — |
| `quantity` | `Float!` | — |
| `list_price` | `Float` | — |
| `base_price` | `Float` | — |
| `net_price` | `Float!` | — |
| `vat_percent` | `Float!` | — |

### Documents_AddProductPositionByIdActionInput

| Feld | Typ | Default |
|------|------|---------|
| `product_id` | `String!` | — |
| `quantity` | `Float!` | — |

### Documents_AddTextActionInput

| Feld | Typ | Default |
|------|------|---------|
| `text` | `String!` | — |
| `pagebreak` | `Boolean` | — |

### Documents_AddTitleActionInput

| Feld | Typ | Default |
|------|------|---------|
| `text` | `String!` | — |
| `tier` | `Int` | — |
| `pagebreak` | `Boolean` | — |
| `insertAfter` | `String` | — |

### Documents_CreateDocumentInput

| Feld | Typ | Default |
|------|------|---------|
| `document_type_id` | `Int!` | — |
| `project_match_id` | `Int!` | — |
| `filename` | `String` | — |
| `publish` | `Boolean` | — |

### Documents_CreateSupplyServiceActionInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String!` | — |
| `unit_type` | `String!` | — |
| `net_price_per_unit` | `Float!` | — |
| `vat_percent` | `Float!` | — |
| `quantity` | `Float!` | — |
| `description` | `String` | — |
| `nr` | `String` | — |
| `ean` | `String` | — |
| `manufacturer` | `String` | — |
| `manufacturer_nr` | `String` | — |
| `source` | `Documents_SourceEnum` | — |
| `insert_after` | `String` | — |
| `is_fixed_net_price` | `Boolean` | — |

### Documents_DeleteSupplyProductActionInput

| Feld | Typ | Default |
|------|------|---------|
| `uid` | `String!` | — |

### Documents_DeleteSupplyServiceActionInput

| Feld | Typ | Default |
|------|------|---------|
| `uid` | `String!` | — |

### Documents_DocumentBuilderActionInput

| Feld | Typ | Default |
|------|------|---------|
| `set_recipient` | `Documents_SetRecipientActionInput` | — |
| `add_product_position` | `Documents_AddProductPositionActionInput` | — |
| `add_product_position_by_id` | `Documents_AddProductPositionByIdActionInput` | — |
| `add_text` | `Documents_AddTextActionInput` | — |
| `set_options` | `Documents_SetOptionsActionInput` | — |
| `add_title` | `Documents_AddTitleActionInput` | — |
| `add_existing_service` | `Documents_AddExistingServiceActionInput` | — |
| `update_supply_service` | `Documents_UpdateSupplyServiceActionInput` | — |
| `delete_supply_service` | `Documents_DeleteSupplyServiceActionInput` | — |
| `delete_supply_product` | `Documents_DeleteSupplyProductActionInput` | — |
| `add_existing_wage_group` | `Documents_AddExistingWageGroupActionInput` | — |
| `update_supply_product` | `Documents_UpdateSupplyProductActionInput` | — |
| `create_supply_service` | `Documents_CreateSupplyServiceActionInput` | — |

### Documents_SetOptionsActionInput

| Feld | Typ | Default |
|------|------|---------|
| `projectAddressDisplay` | `Boolean` | — |
| `subjectDisplay` | `Boolean` | — |
| `customBoxText` | `String` | — |

### Documents_SetRecipientActionInput

| Feld | Typ | Default |
|------|------|---------|
| `company_name` | `String!` | — |
| `company_legal_form` | `String` | — |
| `title` | `String` | — |
| `title_custom` | `String` | — |
| `first_name` | `String!` | — |
| `last_name` | `String!` | — |
| `street` | `String!` | — |
| `city` | `String!` | — |
| `zipcode` | `String!` | — |
| `country` | `String` | — |
| `address_line_1` | `String` | — |
| `address_line_2` | `String` | — |

### Documents_SignatureNodeInput

| Feld | Typ | Default |
|------|------|---------|
| `uid` | `String` | — |
| `type` | `String` | — |
| `title` | `String` | — |
| `mime` | `String` | — |
| `signatureDate` | `String` | — |
| `signature` | `String` | — |

### Documents_SupplyProductBaseDataInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `product_id` | `String` | — |
| `company_id` | `Int` | — |
| `file_upload_id` | `Int` | — |
| `supply_catalog_id` | `Int` | — |
| `supplier_id` | `String` | — |
| `name` | `String` | — |
| `ean` | `String` | — |
| `matchcode` | `String` | — |
| `description` | `String` | — |
| `manufacturer` | `String` | — |
| `manufacturer_nr` | `String` | — |
| `manufacturer_type_name` | `String` | — |
| `quantity_min` | `Float` | — |
| `quantity_interval` | `Float` | — |
| `price_quantity` | `Float` | — |
| `delivery_time` | `Float` | — |
| `unit_type` | `String` | — |
| `is_deleted` | `Boolean` | — |
| `category` | `String` | — |
| `external_url` | `String` | — |
| `image_src` | `String` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `file_upload_uuid` | `String` | — |

### Documents_SupplyProductSalesPriceInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `supply_sales_price_id` | `Int` | — |
| `net_price_per_unit` | `Float` | — |
| `label` | `String` | — |
| `hasDifferentPrice` | `Boolean` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |

### Documents_SupplyProductVersionInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `product_id` | `String` | — |
| `company_id` | `Int` | — |
| `supply_operator_id` | `Int` | — |
| `internal_identifier` | `String` | — |
| `nr` | `String` | — |
| `base_price` | `Float` | — |
| `list_price` | `Float` | — |
| `vat_percent` | `Float` | — |
| `is_deleted` | `Boolean` | — |
| `default_sales_price_id` | `Int` | — |
| `price_quantity` | `Float` | — |
| `quantity_min` | `Float` | — |
| `quantity_interval` | `Float` | — |
| `delivery_time` | `Int` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `base_data` | `Documents_SupplyProductBaseDataInput!` | — |
| `default_sales_price` | `Float` | — |
| `attributes` | `JSON` | — |
| `sales_prices` | `Documents_SupplyProductSalesPriceInput[]` | — |

### Documents_SupplyServiceInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `company_id` | `Int` | — |
| `ean` | `String` | — |
| `internal_identifier` | `String` | — |
| `name` | `String` | — |
| `description` | `String` | — |
| `manufacturer` | `String` | — |
| `unit_type` | `String` | — |
| `net_price_per_unit` | `Float` | — |
| `vat_percent` | `Float` | — |
| `positions` | `Mixed` | — |
| `nr` | `String` | — |
| `is_fixed_net_price` | `Boolean` | — |
| `quantity` | `Float` | — |
| `time_minutes` | `Float` | — |
| `is_deleted` | `Boolean` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |
| `file_upload_id` | `Int` | — |
| `file_upload_uuid` | `String` | — |
| `product_positions` | `Documents_SupplyServiceProductPositionInput[]!` | — |
| `wage_positions` | `Documents_SupplyServiceWagePositionInput[]!` | — |

### Documents_SupplyServiceProductPositionInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `String!` | — |
| `quantity` | `Float!` | — |
| `selected_sales_price_id` | `Int` | — |

### Documents_SupplyServiceWagePositionInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int!` | — |
| `quantity` | `Float!` | — |
| `activity` | `String` | — |

### Documents_UpdateSupplyProductActionInput

| Feld | Typ | Default |
|------|------|---------|
| `uid` | `String!` | — |
| `name` | `String` | — |
| `description` | `String` | — |
| `nr` | `String` | — |
| `unit_type` | `String` | — |
| `ean` | `String` | — |
| `manufacturer` | `String` | — |
| `manufacturer_nr` | `String` | — |
| `net_price_per_unit` | `Float` | — |
| `vat_percent` | `Float` | — |
| `quantity` | `Float` | — |

### Documents_UpdateSupplyServiceActionInput

| Feld | Typ | Default |
|------|------|---------|
| `uid` | `String!` | — |
| `name` | `String` | — |
| `description` | `String` | — |
| `nr` | `String` | — |
| `unitType` | `String` | — |
| `vatPercent` | `Float` | — |
| `quantity` | `Float` | — |
| `productPositions` | `Documents_UpdateSupplyServiceProductPositionsInput[]` | — |
| `wagePositions` | `Documents_UpdateSupplyServiceWagePositionInput[]` | — |

### Documents_UpdateSupplyServiceProductPositionsInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `String` | — |
| `name` | `String` | — |
| `description` | `String` | — |
| `nr` | `String` | — |
| `unitType` | `String` | — |
| `netPricePerUnit` | `Float` | — |
| `vatPercent` | `Float` | — |
| `quantity` | `Float!` | — |

### Documents_UpdateSupplyServiceWagePositionInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `name` | `String` | — |
| `activity` | `String` | — |
| `unitType` | `String` | — |
| `wagePerHour` | `Float` | — |
| `vatPercent` | `Float` | — |
| `timeMinutes` | `Float!` | — |

### EmailInput

| Feld | Typ | Default |
|------|------|---------|
| `context` | `String!` | — |
| `context_id` | `Int!` | — |
| `recipient_email` | `String!` | — |
| `subject` | `String` | — |
| `body` | `String` | — |
| `uuids` | `String[]` | — |

### EmailTemplate_EmailTemplateFiltersInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `IntFilterInput` | — |
| `context` | `StringFilterInput` | — |

### Employees_AbsenceInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `start` | `Date!` | — |
| `end` | `Date!` | — |
| `type` | `Employees_AbsenceTypeEnum!` | — |
| `status` | `Employees_AbsenceStatusEnum!` | — |
| `start_budget` | `Employees_AbsenceBudgetTypeEnum!` | — |
| `end_budget` | `Employees_AbsenceBudgetTypeEnum!` | — |
| `comment` | `String` | — |
| `file_upload_uuid` | `String` | — |

### Employees_TrackingTimeInput

| Feld | Typ | Default |
|------|------|---------|
| `uuid` | `String` | — |
| `project_match_id` | `Int` | — |
| `company_id` | `Int` | — |
| `tracking_region_id` | `Int` | — |
| `partner_id` | `Int` | — |
| `tracking_times_category_id` | `Int` | — |
| `tracking_workday_id` | `Int` | — |
| `status_code` | `Int` | — |
| `start` | `DateTime` | — |
| `end` | `DateTime` | — |
| `comment` | `String` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `field_service_job_id` | `Int` | — |
| `duration_in_seconds` | `Int` | — |
| `is_autogenerated` | `Boolean` | — |
| `id` | `Int` | — |

### FieldService_ChecklistInput

| Feld | Typ | Default |
|------|------|---------|
| `company_id` | `Int` | — |
| `field_service_job_id` | `Int` | — |
| `project_match_id` | `Int` | — |
| `author_partner_id` | `Int` | — |
| `partner_id` | `Int` | — |
| `status` | `String` | — |
| `name` | `String` | — |
| `data` | `JSON` | — |
| `created` | `DateTime` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |

### FieldService_ChecklistTemplateInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `name` | `String` | — |
| `description` | `String` | — |
| `data` | `JSON` | — |

### FieldService_JobInput

| Feld | Typ | Default |
|------|------|---------|
| `company_id` | `Int` | — |
| `customer_id` | `Int` | — |
| `contact_id` | `Int` | — |
| `project_match_id` | `Int` | — |
| `address_id` | `Int` | — |
| `type` | `String` | — |
| `status_code` | `Int` | — |
| `start` | `DateTime` | — |
| `end` | `DateTime` | — |
| `title` | `String` | — |
| `description` | `String` | — |
| `created` | `DateTime` | — |
| `localized_type` | `String` | — |
| `status_name` | `String` | — |
| `display_nr` | `String` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |
| `partners` | `Int[]` | — |
| `service_object_id` | `Int` | — |

### FieldService_ServiceObjectInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String` | — |
| `company_id` | `Int` | — |
| `customer_id` | `Int` | — |
| `contact_id` | `Int` | — |
| `project_match_id` | `Int` | — |
| `address_id` | `Int` | — |
| `partner_id` | `Int` | — |
| `recurring_start` | `Date` | — |
| `recurring_last` | `Date` | — |
| `recurring_next` | `Date` | — |
| `recurring_period` | `String` | — |
| `recurring_num` | `Int` | — |
| `recurring_action` | `String` | — |
| `created` | `DateTime` | — |
| `status` | `String` | — |
| `recurring_end_num` | `Int` | — |
| `recurring_end_period` | `String` | — |
| `reminder_num` | `Int` | — |
| `reminder_period` | `String` | — |
| `reminder_last` | `Date` | — |
| `reminder_next` | `Date` | — |
| `last_action` | `String` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |

### IntFilterInput

| Feld | Typ | Default |
|------|------|---------|
| `equals` | `Int` | — |
| `equalsAny` | `Int[]` | — |
| `greaterThan` | `Int` | — |
| `greaterThanOrEqual` | `Int` | — |
| `lessThan` | `Int` | — |
| `lessThanOrEqual` | `Int` | — |

### LogbookEntryInput

| Feld | Typ | Default |
|------|------|---------|
| `target` | `HistoryTargetEnum` | — |
| `target_id` | `Int` | — |
| `custom_text` | `String!` | — |
| `type_code` | `Int` | — |
| `target_users` | `Int[]` | — |
| `role_visibility` | `String[]` | — |

### PartnerInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `first_name` | `String!` | — |
| `last_name` | `String!` | — |
| `user` | `UserDataInput` | — |
| `email` | `String!` | — |
| `role` | `PartnerRoleEnum` | — |
| `status` | `PartnerStatusEnum` | — |
| `phone` | `String` | — |
| `mobile` | `String` | — |
| `fax` | `String` | — |
| `profile_image_uuid` | `String` | — |
| `title` | `String` | — |
| `signature` | `String` | — |
| `no_signature` | `Boolean` | — |
| `birth_date` | `Date` | — |
| `address` | `AddressInput` | — |

### PaymentInput

| Feld | Typ | Default |
|------|------|---------|
| `paid_date` | `Date` | — |
| `value` | `Float` | — |
| `invoice_discount_value` | `Float` | — |
| `created` | `DateTime` | — |
| `id` | `Int` | — |
| `modified` | `DateTime` | — |

### ProjectInput

| Feld | Typ | Default |
|------|------|---------|
| `type` | `String` | — |
| `customer_id` | `Int` | — |
| `address_id` | `Int` | — |
| `current_project_status_id` | `Int` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `display_name` | `String` | — |
| `name` | `String` | — |
| `partner_source` | `String` | — |
| `measure_id` | `Int` | — |
| `measure_short` | `String` | — |
| `id` | `Int` | — |
| `customer` | `CustomerInput` | — |
| `address` | `AddressInput` | — |

### ProjectMatchInput

| Feld | Typ | Default |
|------|------|---------|
| `project_type` | `String` | — |
| `measure_id` | `Int` | — |
| `customer_id` | `Int` | — |
| `address_id` | `Int` | — |
| `company_id` | `Int` | — |
| `company_branch_id` | `Int` | — |
| `partner_id` | `Int` | — |
| `current_project_match_status_id` | `Int` | — |
| `marked_company` | `Boolean` | — |
| `marked_later` | `Boolean` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `contact_id` | `Int` | — |
| `name` | `String` | — |
| `partner_source` | `String` | — |
| `relative_id` | `Int` | — |
| `partner_notes` | `String` | — |
| `display_id` | `String` | — |
| `project_nr` | `String` | — |
| `volume` | `Float` | — |
| `project_title` | `String` | — |
| `is_deleted` | `Boolean` | — |
| `project_id` | `Int` | — |
| `id` | `Int` | — |
| `current_project_match_status` | `ProjectMatchStatusInput` | — |
| `contact` | `CustomerInput` | — |
| `type_id` | `Int` | — |
| `step_id` | `Int` | — |

### ProjectMatchStatusInput

| Feld | Typ | Default |
|------|------|---------|
| `status_code` | `Int` | — |
| `maturity_date` | `DateTime` | — |
| `maturity_time` | `Mixed` | — |
| `previous_project_match_status_id` | `Int` | — |
| `show_as_skipped` | `Boolean` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `name` | `String` | — |
| `short_name` | `String` | — |
| `step_id` | `Int` | — |
| `id` | `Int` | — |

### ProjectTypeInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `is_default` | `Boolean` | — |
| `is_active` | `Boolean` | — |
| `name` | `String` | — |
| `name_plural` | `String` | — |
| `modified` | `DateTime` | — |
| `created` | `DateTime` | — |

### Receipt_CreateReceiptInput

| Feld | Typ | Default |
|------|------|---------|
| `type` | `String!` | — |
| `number` | `String` | — |
| `receiptDate` | `Date!` | — |
| `dueDate` | `Date!` | — |
| `customerId` | `Int!` | — |
| `fileUploadUuid` | `String` | — |
| `taxId` | `Int` | — |
| `statusCode` | `Int` | — |
| `receiptPositions` | `Receipt_CreateReceiptPositionInput![]!` | — |

### Receipt_CreateReceiptPositionInput

| Feld | Typ | Default |
|------|------|---------|
| `value` | `Float!` | — |
| `vat` | `Int` | — |
| `vatIncl` | `Boolean` | — |
| `bookAccountId` | `Int` | — |
| `costCenterId` | `Int` | — |
| `projectMatchId` | `Int` | — |
| `description` | `String` | — |

### Receipt_ReceiptFiltersInput

| Feld | Typ | Default |
|------|------|---------|
| `type` | `StringFilterInput` | — |
| `number` | `StringFilterInput` | — |
| `statusCode` | `IntFilterInput` | — |
| `customerName` | `StringFilterInput` | — |
| `customerCategory` | `StringFilterInput` | — |
| `costCenterId` | `IntFilterInput` | — |
| `receiptDate` | `DateFilterInput` | — |
| `dueDate` | `DateFilterInput` | — |
| `paidDate` | `DateFilterInput` | — |
| `exportDate` | `DateFilterInput` | — |

### Receipt_UpdateReceiptInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int!` | — |
| `type` | `String` | — |
| `number` | `String` | — |
| `receiptDate` | `Date` | — |
| `dueDate` | `Date` | — |
| `customerId` | `Int` | — |
| `fileUploadUuid` | `String` | — |
| `taxId` | `Int` | — |
| `statusCode` | `Int` | — |
| `receiptPositions` | `Receipt_UpdateReceiptPositionInput[]!` | — |

### Receipt_UpdateReceiptPositionInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `value` | `Float` | — |
| `vat` | `Int` | — |
| `vatIncl` | `Boolean` | — |
| `bookAccountId` | `Int` | — |
| `costCenterId` | `Int` | — |
| `projectMatchId` | `Int` | — |
| `description` | `String` | — |
| `deleted` | `Boolean` | — |

### Stock_ConflictResolutionInput

| Feld | Typ | Default |
|------|------|---------|
| `assignment` | `Stock_AssignmentConflictResolutionEnum` | — |
| `amount` | `Stock_AmountConflictResolutionEnum` | — |

### Stock_CreateSourceWithinMaterialInput

| Feld | Typ | Default |
|------|------|---------|
| `product_id` | `String!` | — |
| `conflict_resolution` | `Stock_ConflictResolutionInput` | — |

### Stock_StockMaterialInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int` | — |
| `name` | `String!` | — |
| `description` | `String` | — |
| `item_number` | `String` | — |
| `qr_id` | `String` | — |
| `category` | `String` | — |
| `unit_type` | `String` | — |
| `total_stock` | `Float` | — |
| `open_consignment_items_amount` | `Float` | — |
| `open_order_items_amount` | `Float` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `min_stock` | `Float` | — |
| `target_stock` | `Float` | — |
| `has_stock_material_sources` | `Boolean` | — |
| `material_sources` | `Stock_CreateSourceWithinMaterialInput[]` | — |

### StringFilterInput

| Feld | Typ | Default |
|------|------|---------|
| `contains` | `String` | — |
| `equals` | `String` | — |
| `equalsAny` | `String[]` | — |

### TaskInput

| Feld | Typ | Default |
|------|------|---------|
| `author_user_id` | `Int` | — |
| `company_id` | `Int` | — |
| `target_user_id` | `Int` | — |
| `title` | `String` | — |
| `comment` | `String` | — |
| `target_project_match_id` | `Int` | — |
| `due_date` | `DateTime` | — |
| `done_date` | `DateTime` | — |
| `created` | `DateTime` | — |
| `modified` | `DateTime` | — |
| `start` | `DateTime` | — |
| `end` | `DateTime` | — |
| `is_deleted` | `Boolean` | — |
| `id` | `Int` | — |

### UpdateEmailTemplateInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int!` | — |
| `name` | `String!` | — |
| `context` | `String!` | — |
| `subject` | `String!` | — |
| `body` | `String!` | — |
| `file_upload_id` | `Int!` | — |

### UserDataInput

| Feld | Typ | Default |
|------|------|---------|
| `title` | `String` | — |
| `first_name` | `String` | — |
| `last_name` | `String` | — |
| `email` | `String` | — |
| `phone` | `String` | — |
| `mobile` | `String` | — |
| `locale` | `String` | — |

### Webhooks_CreateWebhookInput

| Feld | Typ | Default |
|------|------|---------|
| `name` | `String` | — |
| `webhook_trigger` | `String` | — |
| `target_url` | `String` | — |
| `token` | `String` | — |

### Webhooks_UpdateWebhookInput

| Feld | Typ | Default |
|------|------|---------|
| `id` | `Int!` | — |
| `name` | `String` | — |
| `webhook_trigger` | `String` | — |
| `target_url` | `String` | — |
| `token` | `String` | — |
| `is_active` | `Boolean` | — |

## Enums (25)

### CalendarCategoryEnum

`all`, `events_jobs`, `events`, `jobs`, `absences`

### CalendarEventSelection

`own`, `all`

### Customer_CustomerCategory

`CUSTOMER`, `SUPPLIER`, `PARTNER`, `CONTACT`

### CustomerCategoryEnum

`supplier`, `customer`, `partner`, `other`, `contact`

### CustomerDocumentBookingCategoryEnum
> Possible values are `none` (Standard), `photovoltaic` (Umsatz für Photovoltaik) and `recipient_tax_debtor` (Umsatz nach §13b).

`none`, `recipient_tax_debtor`, `photovoltaic`

### CustomFields_PropertyTypeEnum

`text`, `selection`, `json`, `checkbox`, `url`

### CustomFields_SchemaRelationTypeEnum

`project`

### Documents_SourceEnum
> Source tracking for analytics (origin of the operation)

`API`, `WEB_APP`, `PARTNER_INTEGRATION`, `AUTOMATION`

### EmailTemplate_EmailTemplateContext

`COMPANY`, `CUSTOMER`, `CUSTOMER_DOCUMENT`, `CUSTOMER_DOCUMENT_CONFIRMATION`, `CUSTOMER_DOCUMENT_DELIVERY_NOTE`, `CUSTOMER_DOCUMENT_DUNNING`, `CUSTOMER_DOCUMENT_GENERIC`, `CUSTOMER_DOCUMENT_INFORMATION`, `CUSTOMER_DOCUMENT_INVOICE`, `CUSTOMER_DOCUMENT_INVOICE_NOTICE`, `CUSTOMER_DOCUMENT_LETTER`, `CUSTOMER_DOCUMENT_MAINTENANCE`, `CUSTOMER_DOCUMENT_MEASUREMENT`, `CUSTOMER_DOCUMENT_OFFER`, `CUSTOMER_DOCUMENT_ORDER_FORM`, `CUSTOMER_DOCUMENT_REPAIR`, `CUSTOMER_DOCUMENT_REVERSAL_INVOICE`, `CUSTOMER_PRIVACY`, `INVOICE`, `INVOICE_NOTICE`, `JOB`, `JOB_CONTACT`, `MATCH`, `MATCHING`, `PARTNER`, `PARTNER_CUSTOMER`, `PARTNER_EMPLOYEE`, `PARTNER_EXTERNAL`, `PARTNER_PROCESS_FILES`, `PAYMENT_REMINDER`, `PROJECT`, `PROJECT_START`, `SERVICE_OBJECT`, `SUBSCRIPTION`, `SYSTEM`, `UNKNOWN`

### EmailTemplate_EmailTemplateSortingInput

`ID_ASC`, `ID_DESC`

### Employees_AbsenceBudgetTypeEnum

`full_day`, `half_day`

### Employees_AbsenceStatusEnum

`draft`, `submitted`, `approved`, `rejected`, `deleted`

### Employees_AbsenceTypeEnum

`parental_leave`, `sick_child`, `sick`, `sick_note_once`, `sick_note_multiple`, `maternity`, `paid_special_leave`, `overtime_compensation`, `unpaid_leave`, `vacation`

### Employees_TrackingTimeStatusEnum

`new`, `submitted`, `confirmed`, `deleted`

### HistoryTargetEnum

`project_match`, `field_service_job`

### InvoiceStyle

`parted`, `full`, `cumulative`, `downpayment`

### LinkTargetEnum

`ava_project`, `field_service_checklist`, `field_service_job`, `project_match`

### PartnerRoleEnum

`lite_user`, `worker`, `sales`, `accounting`, `branch_manager`, `manager`

### PartnerStatusEnum

`active`, `deleted`

### ProjectExportOptionEnum

`details`, `partner`, `documents`, `images`, `times`, `history`

### Receipt_ReceiptSortingInput

`RECEIPT_DATE_ASC`, `RECEIPT_DATE_DESC`, `DUE_DATE_ASC`, `DUE_DATE_DESC`, `NUMBER_ASC`, `NUMBER_DESC`, `NET_VALUE_ASC`, `NET_VALUE_DESC`, `PAID_DATE_ASC`, `PAID_DATE_DESC`, `CUSTOMER_NAME_ASC`, `CUSTOMER_NAME_DESC`

### SearchCategoryEnum

`contacts`, `documents`, `jobs`, `partners`, `project_matches`, `calendar_events`

### Stock_AmountConflictResolutionEnum

`transferAmount`, `discardAmount`

### Stock_AssignmentConflictResolutionEnum

`overwriteAssignment`, `discardAssignment`

### ThumbnailFormat

`fit_64`, `fit_128`, `fit_256`, `fit_512`, `fit_1024`, `logo_m`

## Custom Scalars (4)

- `Date`
- `DateTime`
- `JSON`
- `Mixed`

## Unions (2)

- **Documents_SupplyServicePosition** = `Documents_SupplyProduct` | `WageGroup`
- **SearchResult** = `Customer` | `CustomerDocument` | `FieldService_Job` | `Partner` | `ProjectMatch` | `CalendarEvent`
