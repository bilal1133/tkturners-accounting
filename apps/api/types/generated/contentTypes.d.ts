import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiFinanceAccountFinanceAccount
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_accounts';
  info: {
    description: 'Manual ledger accounts';
    displayName: 'Finance Account';
    pluralName: 'finance-accounts';
    singularName: 'finance-account';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    account_kind: Schema.Attribute.Enumeration<
      ['CASH', 'LOAN_RECEIVABLE_CONTROL']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'CASH'>;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    is_system: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-account.finance-account'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    opening_balance_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    owner_user_id: Schema.Attribute.BigInteger;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceApprovalRecordFinanceApprovalRecord
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_approval_records';
  info: {
    description: 'Approval timeline entries';
    displayName: 'Finance Approval Record';
    pluralName: 'finance-approval-records';
    singularName: 'finance-approval-record';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.Enumeration<['APPROVE', 'REJECT']> &
      Schema.Attribute.Required;
    actor_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    comment: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-approval-record.finance-approval-record'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    transaction_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceAttachmentFinanceAttachment
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_attachments';
  info: {
    description: 'Attachment metadata';
    displayName: 'Finance Attachment';
    pluralName: 'finance-attachments';
    singularName: 'finance-attachment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    file_key: Schema.Attribute.String & Schema.Attribute.Required;
    file_name: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-attachment.finance-attachment'
    > &
      Schema.Attribute.Private;
    mime_type: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    size_bytes: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    transaction_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceAuditLogFinanceAuditLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_audit_logs';
  info: {
    description: 'Immutable audit events';
    displayName: 'Finance Audit Log';
    pluralName: 'finance-audit-logs';
    singularName: 'finance-audit-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    actor_user_id: Schema.Attribute.BigInteger;
    after_json: Schema.Attribute.JSON;
    before_json: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entity_id: Schema.Attribute.String & Schema.Attribute.Required;
    entity_type: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-audit-log.finance-audit-log'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceCategoryFinanceCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_categories';
  info: {
    description: 'Workspace-scoped transaction categories';
    displayName: 'Finance Category';
    pluralName: 'finance-categories';
    singularName: 'finance-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_system: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-category.finance-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['INCOME', 'EXPENSE', 'BOTH']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'EXPENSE'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceCounterpartyFinanceCounterparty
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_counterparties';
  info: {
    description: 'Clients and vendors';
    displayName: 'Finance Counterparty';
    pluralName: 'finance-counterparties';
    singularName: 'finance-counterparty';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    kind: Schema.Attribute.Enumeration<
      ['CLIENT', 'VENDOR', 'BOTH', 'UNKNOWN', 'EMPLOYEE']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'UNKNOWN'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-counterparty.finance-counterparty'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceCurrencyFinanceCurrency
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_currencies';
  info: {
    description: 'Supported currencies';
    displayName: 'Finance Currency';
    pluralName: 'finance-currencies';
    singularName: 'finance-currency';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decimals: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<2>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-currency.finance-currency'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinanceDepartmentFinanceDepartment
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_departments';
  info: {
    description: 'Employee department master records';
    displayName: 'Finance Department';
    pluralName: 'finance-departments';
    singularName: 'finance-department';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-department.finance-department'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceEmployeeLoanFinanceEmployeeLoan
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_employee_loans';
  info: {
    description: 'Employee loan master';
    displayName: 'Finance Employee Loan';
    pluralName: 'finance-employee-loans';
    singularName: 'finance-employee-loan';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    annual_interest_bps: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    approved_at: Schema.Attribute.DateTime;
    approved_by_user_id: Schema.Attribute.BigInteger;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    disbursement_account_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    disbursement_date: Schema.Attribute.Date;
    disbursement_transaction_id: Schema.Attribute.BigInteger;
    employee_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    installment_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-employee-loan.finance-employee-loan'
    > &
      Schema.Attribute.Private;
    next_due_date: Schema.Attribute.Date;
    outstanding_interest_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    outstanding_principal_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    principal_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    receivable_control_account_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'APPROVED'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceEmployeeFinanceEmployee
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_employees';
  info: {
    description: 'Employee payroll master records';
    displayName: 'Finance Employee';
    pluralName: 'finance-employees';
    singularName: 'finance-employee';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    base_salary_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    default_allowances_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    default_funding_account_id: Schema.Attribute.BigInteger;
    default_non_loan_deductions_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    default_payout_account_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    department_id: Schema.Attribute.BigInteger;
    email: Schema.Attribute.Email;
    employee_code: Schema.Attribute.String & Schema.Attribute.Required;
    full_name: Schema.Attribute.String & Schema.Attribute.Required;
    join_date: Schema.Attribute.Date;
    linked_counterparty_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-employee.finance-employee'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    payroll_currency: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    settlement_iban: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<['ACTIVE', 'INACTIVE']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ACTIVE'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceLoanRepaymentFinanceLoanRepayment
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_loan_repayments';
  info: {
    description: 'Loan repayment postings';
    displayName: 'Finance Loan Repayment';
    pluralName: 'finance-loan-repayments';
    singularName: 'finance-loan-repayment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    employee_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    interest_income_transaction_id: Schema.Attribute.BigInteger;
    interest_paid_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    linked_payroll_entry_id: Schema.Attribute.BigInteger;
    loan_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-loan-repayment.finance-loan-repayment'
    > &
      Schema.Attribute.Private;
    principal_paid_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    principal_transfer_transaction_id: Schema.Attribute.BigInteger;
    publishedAt: Schema.Attribute.DateTime;
    repayment_date: Schema.Attribute.Date & Schema.Attribute.Required;
    source: Schema.Attribute.Enumeration<['PAYROLL', 'MANUAL']> &
      Schema.Attribute.Required;
    total_paid_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceLoanScheduleFinanceLoanSchedule
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_loan_schedules';
  info: {
    description: 'Loan installment schedule and repayments';
    displayName: 'Finance Loan Schedule';
    pluralName: 'finance-loan-schedules';
    singularName: 'finance-loan-schedule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    due_date: Schema.Attribute.Date & Schema.Attribute.Required;
    installment_no: Schema.Attribute.Integer & Schema.Attribute.Required;
    interest_due_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    interest_paid_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    linked_payroll_entry_id: Schema.Attribute.BigInteger;
    loan_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-loan-schedule.finance-loan-schedule'
    > &
      Schema.Attribute.Private;
    principal_due_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    principal_paid_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['DUE', 'PARTIAL', 'PAID']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'DUE'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinanceNoteFinanceNote extends Struct.CollectionTypeSchema {
  collectionName: 'finance_notes';
  info: {
    description: 'Notes on transactions';
    displayName: 'Finance Note';
    pluralName: 'finance-notes';
    singularName: 'finance-note';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-note.finance-note'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    transaction_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinancePayrollComponentFinancePayrollComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_payroll_components';
  info: {
    description: 'Component breakdown for payroll entry';
    displayName: 'Finance Payroll Component';
    pluralName: 'finance-payroll-components';
    singularName: 'finance-payroll-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    component_code: Schema.Attribute.String & Schema.Attribute.Required;
    component_type: Schema.Attribute.Enumeration<
      ['EARNING', 'DEDUCTION', 'INFO']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_system: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-payroll-component.finance-payroll-component'
    > &
      Schema.Attribute.Private;
    payroll_entry_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sort_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinancePayrollEntryFinancePayrollEntry
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_payroll_entries';
  info: {
    description: 'Employee-level payroll line in a run';
    displayName: 'Finance Payroll Entry';
    pluralName: 'finance-payroll-entries';
    singularName: 'finance-payroll-entry';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actual_loan_deduction_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    allowances_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    base_salary_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    employee_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    loan_id: Schema.Attribute.BigInteger;
    loan_interest_income_transaction_id: Schema.Attribute.BigInteger;
    loan_principal_repayment_transaction_id: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-payroll-entry.finance-payroll-entry'
    > &
      Schema.Attribute.Private;
    net_paid_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    non_loan_deductions_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    payout_additional_fee_count: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    payout_additional_fee_total_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    payout_from_account_id: Schema.Attribute.BigInteger;
    payout_from_amount_minor: Schema.Attribute.BigInteger;
    payout_from_currency: Schema.Attribute.String;
    payout_fx_rate: Schema.Attribute.Decimal;
    payout_to_account_id: Schema.Attribute.BigInteger;
    payout_to_amount_minor: Schema.Attribute.BigInteger;
    payout_to_currency: Schema.Attribute.String;
    payout_transfer_fee_transaction_id: Schema.Attribute.BigInteger;
    payout_transfer_transaction_id: Schema.Attribute.BigInteger;
    payroll_run_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    planned_loan_deduction_minor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    salary_expense_transaction_id: Schema.Attribute.BigInteger;
    status: Schema.Attribute.Enumeration<['DRAFT', 'APPROVED', 'PAID']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinancePayrollRunFinancePayrollRun
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_payroll_runs';
  info: {
    description: 'Monthly payroll workflow';
    displayName: 'Finance Payroll Run';
    pluralName: 'finance-payroll-runs';
    singularName: 'finance-payroll-run';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approved_at: Schema.Attribute.DateTime;
    approved_by_user_id: Schema.Attribute.BigInteger;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cutoff_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-payroll-run.finance-payroll-run'
    > &
      Schema.Attribute.Private;
    paid_at: Schema.Attribute.DateTime;
    payday_date: Schema.Attribute.Date & Schema.Attribute.Required;
    period_month: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['DRAFT', 'APPROVED', 'PAID']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceSlackDraftFinanceSlackDraft
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_slack_drafts';
  info: {
    description: 'Slack parser confirmation drafts';
    displayName: 'Finance Slack Draft';
    pluralName: 'finance-slack-drafts';
    singularName: 'finance-slack-draft';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    confidence: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    created_transaction_id: Schema.Attribute.BigInteger;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    draft_token: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    expires_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-slack-draft.finance-slack-draft'
    > &
      Schema.Attribute.Private;
    missing_fields_json: Schema.Attribute.JSON & Schema.Attribute.Required;
    parsed_payload_json: Schema.Attribute.JSON & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    raw_text: Schema.Attribute.Text & Schema.Attribute.Required;
    slack_channel_id: Schema.Attribute.String;
    slack_team_id: Schema.Attribute.String;
    slack_user_id: Schema.Attribute.String;
    state: Schema.Attribute.Enumeration<
      ['PENDING', 'CONFIRMED', 'CANCELED', 'EXPIRED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PENDING'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceSubscriptionRunFinanceSubscriptionRun
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_subscription_runs';
  info: {
    description: 'Subscription generation runs';
    displayName: 'Finance Subscription Run';
    pluralName: 'finance-subscription-runs';
    singularName: 'finance-subscription-run';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    generated_transaction_id: Schema.Attribute.BigInteger;
    initiated_by_user_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-subscription-run.finance-subscription-run'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    run_date: Schema.Attribute.Date & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['GENERATED', 'SKIPPED', 'FAILED']> &
      Schema.Attribute.Required;
    subscription_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinanceSubscriptionFinanceSubscription
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_subscriptions';
  info: {
    description: 'Recurring expenses';
    displayName: 'Finance Subscription';
    pluralName: 'finance-subscriptions';
    singularName: 'finance-subscription';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    account_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    amount_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    category_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    description: Schema.Attribute.Text;
    frequency: Schema.Attribute.Enumeration<['MONTHLY', 'ANNUAL', 'CUSTOM']> &
      Schema.Attribute.Required;
    interval_count: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-subscription.finance-subscription'
    > &
      Schema.Attribute.Private;
    next_run_date: Schema.Attribute.Date & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vendor_counterparty_id: Schema.Attribute.BigInteger &
      Schema.Attribute.Required;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceTagFinanceTag extends Struct.CollectionTypeSchema {
  collectionName: 'finance_tags';
  info: {
    description: 'Transaction tags';
    displayName: 'Finance Tag';
    pluralName: 'finance-tags';
    singularName: 'finance-tag';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-tag.finance-tag'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceTransactionLineFinanceTransactionLine
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_transaction_lines';
  info: {
    description: 'Account movement lines';
    displayName: 'Finance Transaction Line';
    pluralName: 'finance-transaction-lines';
    singularName: 'finance-transaction-line';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    account_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    amount_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    direction: Schema.Attribute.Enumeration<['IN', 'OUT']> &
      Schema.Attribute.Required;
    line_role: Schema.Attribute.Enumeration<['PRIMARY', 'COUNTERPART']> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-transaction-line.finance-transaction-line'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    transaction_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinanceTransactionTagFinanceTransactionTag
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_transaction_tags';
  info: {
    description: 'Transaction-tag links';
    displayName: 'Finance Transaction Tag';
    pluralName: 'finance-transaction-tags';
    singularName: 'finance-transaction-tag';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-transaction-tag.finance-transaction-tag'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    tag_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    transaction_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFinanceTransactionFinanceTransaction
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_transactions';
  info: {
    description: 'Ledger transactions';
    displayName: 'Finance Transaction';
    pluralName: 'finance-transactions';
    singularName: 'finance-transaction';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount_minor: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    approved_at: Schema.Attribute.DateTime;
    approved_by_user_id: Schema.Attribute.BigInteger;
    base_amount_minor: Schema.Attribute.BigInteger;
    category_id: Schema.Attribute.BigInteger;
    counterparty_id: Schema.Attribute.BigInteger;
    created_by_user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.Required;
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    fx_rate_to_base: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-transaction.finance-transaction'
    > &
      Schema.Attribute.Private;
    metadata_json: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.Enumeration<['WEB', 'SLACK', 'SYSTEM']> &
      Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['PENDING', 'APPROVED', 'REJECTED']> &
      Schema.Attribute.Required;
    transaction_date: Schema.Attribute.Date & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<['INCOME', 'EXPENSE', 'TRANSFER']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceWorkspaceMemberFinanceWorkspaceMember
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_workspace_members';
  info: {
    description: 'Workspace role assignments';
    displayName: 'Finance Workspace Member';
    pluralName: 'finance-workspace-members';
    singularName: 'finance-workspace-member';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-workspace-member.finance-workspace-member'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<['ADMIN', 'ACCOUNTANT', 'VIEWER']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
    workspace_id: Schema.Attribute.BigInteger & Schema.Attribute.Required;
  };
}

export interface ApiFinanceWorkspaceFinanceWorkspace
  extends Struct.CollectionTypeSchema {
  collectionName: 'finance_workspaces';
  info: {
    description: 'Workspace configuration';
    displayName: 'Finance Workspace';
    pluralName: 'finance-workspaces';
    singularName: 'finance-workspace';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allow_self_approval: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    base_currency: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::finance-workspace.finance-workspace'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    timezone: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    web_entry_default_status: Schema.Attribute.Enumeration<
      ['PENDING', 'APPROVED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'APPROVED'>;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::finance-account.finance-account': ApiFinanceAccountFinanceAccount;
      'api::finance-approval-record.finance-approval-record': ApiFinanceApprovalRecordFinanceApprovalRecord;
      'api::finance-attachment.finance-attachment': ApiFinanceAttachmentFinanceAttachment;
      'api::finance-audit-log.finance-audit-log': ApiFinanceAuditLogFinanceAuditLog;
      'api::finance-category.finance-category': ApiFinanceCategoryFinanceCategory;
      'api::finance-counterparty.finance-counterparty': ApiFinanceCounterpartyFinanceCounterparty;
      'api::finance-currency.finance-currency': ApiFinanceCurrencyFinanceCurrency;
      'api::finance-department.finance-department': ApiFinanceDepartmentFinanceDepartment;
      'api::finance-employee-loan.finance-employee-loan': ApiFinanceEmployeeLoanFinanceEmployeeLoan;
      'api::finance-employee.finance-employee': ApiFinanceEmployeeFinanceEmployee;
      'api::finance-loan-repayment.finance-loan-repayment': ApiFinanceLoanRepaymentFinanceLoanRepayment;
      'api::finance-loan-schedule.finance-loan-schedule': ApiFinanceLoanScheduleFinanceLoanSchedule;
      'api::finance-note.finance-note': ApiFinanceNoteFinanceNote;
      'api::finance-payroll-component.finance-payroll-component': ApiFinancePayrollComponentFinancePayrollComponent;
      'api::finance-payroll-entry.finance-payroll-entry': ApiFinancePayrollEntryFinancePayrollEntry;
      'api::finance-payroll-run.finance-payroll-run': ApiFinancePayrollRunFinancePayrollRun;
      'api::finance-slack-draft.finance-slack-draft': ApiFinanceSlackDraftFinanceSlackDraft;
      'api::finance-subscription-run.finance-subscription-run': ApiFinanceSubscriptionRunFinanceSubscriptionRun;
      'api::finance-subscription.finance-subscription': ApiFinanceSubscriptionFinanceSubscription;
      'api::finance-tag.finance-tag': ApiFinanceTagFinanceTag;
      'api::finance-transaction-line.finance-transaction-line': ApiFinanceTransactionLineFinanceTransactionLine;
      'api::finance-transaction-tag.finance-transaction-tag': ApiFinanceTransactionTagFinanceTransactionTag;
      'api::finance-transaction.finance-transaction': ApiFinanceTransactionFinanceTransaction;
      'api::finance-workspace-member.finance-workspace-member': ApiFinanceWorkspaceMemberFinanceWorkspaceMember;
      'api::finance-workspace.finance-workspace': ApiFinanceWorkspaceFinanceWorkspace;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
