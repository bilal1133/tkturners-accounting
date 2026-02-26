import type { Schema, Struct } from '@strapi/strapi';

export interface ContactTypeCustomer extends Struct.ComponentSchema {
  collectionName: 'components_contact_type_customers';
  info: {
    displayName: 'customer';
  };
  attributes: {
    company_name: Schema.Attribute.String;
    company_vat: Schema.Attribute.String;
    description: Schema.Attribute.String;
  };
}

export interface ContactTypeEmployee extends Struct.ComponentSchema {
  collectionName: 'components_contact_type_employees';
  info: {
    displayName: 'employee';
  };
  attributes: {
    active: Schema.Attribute.Boolean;
    address: Schema.Attribute.String;
    bank_account: Schema.Attribute.String;
    birth_day: Schema.Attribute.Date;
    cnic: Schema.Attribute.BigInteger;
    currency: Schema.Attribute.Relation<'manyToOne', 'api::currency.currency'>;
    department: Schema.Attribute.Enumeration<
      [
        'Management',
        'Engineering',
        'HouseKeeping',
        'Marketing',
        'Bussiness Development',
      ]
    >;
    fuel_allowance: Schema.Attribute.Decimal;
    gym_allowance: Schema.Attribute.Decimal;
    joining_date: Schema.Attribute.Date;
    loans: Schema.Attribute.Relation<'oneToMany', 'api::loan.loan'>;
    other_documents: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    position: Schema.Attribute.String;
    profile_picture: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    rental_allowance: Schema.Attribute.Decimal;
    salary: Schema.Attribute.Decimal;
  };
}

export interface ContactTypeVendor extends Struct.ComponentSchema {
  collectionName: 'components_contact_type_vendors';
  info: {
    displayName: 'vendor';
  };
  attributes: {
    description: Schema.Attribute.String;
  };
}

export interface EmployeeEmployee extends Struct.ComponentSchema {
  collectionName: 'components_employee_employees';
  info: {
    displayName: 'employee';
  };
  attributes: {
    bonus: Schema.Attribute.Decimal;
    contact: Schema.Attribute.Relation<'manyToOne', 'api::contact.contact'>;
    converted_gross_pay: Schema.Attribute.Decimal;
    converted_loan_deduction: Schema.Attribute.Decimal;
    converted_net_pay: Schema.Attribute.Decimal;
    employee_name: Schema.Attribute.String;
    fuel_allowance: Schema.Attribute.Decimal;
    gross_pay: Schema.Attribute.Decimal;
    gym_allowance: Schema.Attribute.Decimal;
    loan_amount_to_deduct: Schema.Attribute.Decimal;
    loan_ref: Schema.Attribute.Relation<'manyToOne', 'api::loan.loan'>;
    loan_repayment_transaction: Schema.Attribute.Relation<
      'oneToOne',
      'api::transaction.transaction'
    >;
    net_pay: Schema.Attribute.Decimal;
    overtime_amount: Schema.Attribute.Decimal;
    payee_account: Schema.Attribute.Relation<
      'manyToOne',
      'api::account.account'
    >;
    payroll_status: Schema.Attribute.Enumeration<['draft', 'processed']>;
    rental_allowance: Schema.Attribute.Decimal;
    salary_transaction: Schema.Attribute.Relation<
      'oneToOne',
      'api::transaction.transaction'
    >;
  };
}

export interface TypeExpense extends Struct.ComponentSchema {
  collectionName: 'components_type_expenses';
  info: {
    displayName: 'expense';
  };
  attributes: {
    account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    amount: Schema.Attribute.Decimal;
    currency: Schema.Attribute.Relation<'manyToOne', 'api::currency.currency'>;
  };
}

export interface TypeIncome extends Struct.ComponentSchema {
  collectionName: 'components_type_incomes';
  info: {
    displayName: 'income';
  };
  attributes: {
    account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    amount: Schema.Attribute.Decimal;
    currency: Schema.Attribute.Relation<'manyToOne', 'api::currency.currency'>;
  };
}

export interface TypeTransfer extends Struct.ComponentSchema {
  collectionName: 'components_type_transfers';
  info: {
    displayName: 'transfer';
  };
  attributes: {
    from_account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    from_amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    to_account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    to_amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
  };
}

export interface TypeType extends Struct.ComponentSchema {
  collectionName: 'components_type_types';
  info: {
    displayName: 'type';
  };
  attributes: {};
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'contact-type.customer': ContactTypeCustomer;
      'contact-type.employee': ContactTypeEmployee;
      'contact-type.vendor': ContactTypeVendor;
      'employee.employee': EmployeeEmployee;
      'type.expense': TypeExpense;
      'type.income': TypeIncome;
      'type.transfer': TypeTransfer;
      'type.type': TypeType;
    }
  }
}
