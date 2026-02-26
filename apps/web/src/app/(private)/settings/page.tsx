'use client';

import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { Category, Department } from '@/lib/types';
import { validateWithSchema } from '@/lib/validation';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';

type SettingsPayload = {
  base_currency: string;
  timezone: string;
  web_entry_default_status: 'APPROVED' | 'PENDING';
  allow_self_approval: boolean;
};

const settingsSchema = z.object({
  base_currency: z.string().trim().min(3, 'Base currency is required.').max(3, 'Use a 3-letter currency code.'),
  timezone: z.string().trim().min(1, 'Timezone is required.'),
  web_entry_default_status: z.enum(['APPROVED', 'PENDING']),
  allow_self_approval: z.boolean(),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(80, 'Category name is too long.'),
  type: z.enum(['INCOME', 'EXPENSE', 'BOTH']),
});

const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required.').max(120, 'Department name is too long.'),
  code: z.string().trim().max(32, 'Code cannot exceed 32 characters.'),
  is_active: z.boolean(),
});

export default function SettingsPage() {
  const { token, refreshMe } = useAuth();
  const [form, setForm] = useState<SettingsPayload>({
    base_currency: 'USD',
    timezone: 'UTC',
    web_entry_default_status: 'APPROVED',
    allow_self_approval: true,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryForm, setCategoryForm] = useState<{ name: string; type: Category['type'] }>({
    name: '',
    type: 'EXPENSE',
  });
  const [editingCategory, setEditingCategory] = useState<{
    id: number;
    name: string;
    type: Category['type'];
  } | null>(null);
  const [categoriesBusy, setCategoriesBusy] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentForm, setDepartmentForm] = useState<{ name: string; code: string; is_active: boolean }>({
    name: '',
    code: '',
    is_active: true,
  });
  const [editingDepartment, setEditingDepartment] = useState<{
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  } | null>(null);
  const [departmentsBusy, setDepartmentsBusy] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      apiRequest<SettingsPayload>('/finance/settings', { token }),
      apiRequest<Category[]>('/finance/categories', { token }),
      apiRequest<Department[]>('/finance/departments', { token }),
    ])
      .then(([settingsPayload, categoriesPayload, departmentsPayload]) => {
        setForm(settingsPayload);
        setCategories(categoriesPayload);
        setDepartments(departmentsPayload);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load settings');
      });
  }, [token]);

  const reloadCategories = async () => {
    if (!token) return;
    const categoryPayload = await apiRequest<Category[]>('/finance/categories', { token });
    setCategories(categoryPayload);
  };

  const reloadDepartments = async () => {
    if (!token) return;
    const departmentPayload = await apiRequest<Department[]>('/finance/departments', { token });
    setDepartments(departmentPayload);
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', type: 'EXPENSE' });
  };

  const closeDepartmentModal = () => {
    setIsDepartmentModalOpen(false);
    setEditingDepartment(null);
    setDepartmentForm({ name: '', code: '', is_active: true });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(settingsSchema, {
      ...form,
      base_currency: form.base_currency,
      timezone: form.timezone,
      web_entry_default_status: form.web_entry_default_status,
      allow_self_approval: Boolean(form.allow_self_approval),
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      await apiRequest('/finance/settings', {
        token,
        method: 'PATCH',
        body: parsed.data,
      });
      await refreshMe();
      closeSettingsModal();
      setSaved('Settings updated.');
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings');
      setSaved(null);
    }
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(categorySchema, {
      name: editingCategory ? editingCategory.name : categoryForm.name,
      type: editingCategory ? editingCategory.type : categoryForm.type,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      setCategoriesBusy(true);
      if (editingCategory) {
        await apiRequest(`/finance/categories/${editingCategory.id}`, {
          token,
          method: 'PATCH',
          body: parsed.data,
        });
        setSaved('Category updated.');
      } else {
        await apiRequest('/finance/categories', {
          token,
          method: 'POST',
          body: parsed.data,
        });
        setSaved('Category created.');
      }
      closeCategoryModal();
      await reloadCategories();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save category');
      setSaved(null);
    } finally {
      setCategoriesBusy(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    if (!token) return;

    const confirmed = window.confirm('Delete this category?');
    if (!confirmed) return;

    try {
      setCategoriesBusy(true);
      await apiRequest(`/finance/categories/${categoryId}`, {
        token,
        method: 'DELETE',
      });
      await reloadCategories();
      setSaved('Category deleted.');
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete category');
      setSaved(null);
    } finally {
      setCategoriesBusy(false);
    }
  };

  const submitDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const parsed = validateWithSchema(departmentSchema, {
      name: editingDepartment ? editingDepartment.name : departmentForm.name,
      code: editingDepartment ? editingDepartment.code : departmentForm.code,
      is_active: editingDepartment ? editingDepartment.is_active : departmentForm.is_active,
    });

    if (!parsed.success) {
      setError(parsed.message);
      return;
    }

    try {
      setDepartmentsBusy(true);
      if (editingDepartment) {
        await apiRequest(`/finance/departments/${editingDepartment.id}`, {
          token,
          method: 'PATCH',
          body: {
            name: parsed.data.name,
            code: parsed.data.code || null,
            is_active: parsed.data.is_active,
          },
        });
        setSaved('Department updated.');
      } else {
        await apiRequest('/finance/departments', {
          token,
          method: 'POST',
          body: {
            name: parsed.data.name,
            code: parsed.data.code || null,
          },
        });
        setSaved('Department created.');
      }

      closeDepartmentModal();
      await reloadDepartments();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save department');
      setSaved(null);
    } finally {
      setDepartmentsBusy(false);
    }
  };

  const deleteDepartment = async (departmentId: number) => {
    if (!token) return;

    const confirmed = window.confirm('Delete this department?');
    if (!confirmed) return;

    try {
      setDepartmentsBusy(true);
      await apiRequest(`/finance/departments/${departmentId}`, {
        token,
        method: 'DELETE',
      });
      setEditingDepartment(null);
      await reloadDepartments();
      setSaved('Department deleted. If linked employees exist, it was deactivated.');
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete department');
      setSaved(null);
    } finally {
      setDepartmentsBusy(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        badge="WORKSPACE CONFIG"
        title="Settings"
        subtitle="Configure workspace behavior, categories, departments, and Slack setup."
        actions={
          <button className="primary-button" type="button" onClick={() => setIsSettingsModalOpen(true)}>
            Edit Workspace Defaults
          </button>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}
      {saved ? <p className="success-text">{saved}</p> : null}

      <Modal open={isSettingsModalOpen} onClose={closeSettingsModal} title="Workspace Defaults" size="md">
        <form className="page" onSubmit={submit}>
          <div className="form-grid">
            <FormField label="Base Currency">
              <select
                value={form.base_currency}
                onChange={(event) => setForm((prev) => ({ ...prev, base_currency: event.target.value }))}
              >
                <option>USD</option>
                <option>PKR</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>AED</option>
              </select>
            </FormField>

            <FormField label="Timezone">
              <input value={form.timezone} onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))} />
            </FormField>

            <FormField label="Web Entry Default Status">
              <select
                value={form.web_entry_default_status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    web_entry_default_status: event.target.value as SettingsPayload['web_entry_default_status'],
                  }))
                }
              >
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
              </select>
            </FormField>

            <FormField label="Allow Self Approval">
              <select
                value={String(form.allow_self_approval)}
                onChange={(event) => setForm((prev) => ({ ...prev, allow_self_approval: event.target.value === 'true' }))}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
          </div>

          <FormActions>
            <button className="primary-button" type="submit">
              Save Settings
            </button>
            <button className="ghost-button" type="button" onClick={closeSettingsModal}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <div className="card">
        <h3>Slack Connection</h3>
        <p className="muted-text">Configured through environment variables on API deployment.</p>
        <ul>
          <li>`SLACK_SIGNING_SECRET`</li>
          <li>`SLACK_BOT_TOKEN`</li>
          <li>`SLACK_FINANCE_CHANNEL_ID`</li>
        </ul>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h3>Categories</h3>
            <p className="section-subtitle">Create and manage custom categories used in transactions and subscriptions.</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', type: 'EXPENSE' });
              setIsCategoryModalOpen(true);
            }}
          >
            Add Category
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.type}</td>
                  <td>{category.is_system ? 'System' : 'Custom'}</td>
                  <td>
                    {category.is_system ? (
                      <span className="muted-text">Locked</span>
                    ) : (
                      <div className="table-actions">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setEditingCategory({
                              id: category.id,
                              name: category.name,
                              type: category.type,
                            });
                            setIsCategoryModalOpen(true);
                          }}
                          disabled={categoriesBusy}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => deleteCategory(category.id)}
                          disabled={categoriesBusy}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isCategoryModalOpen}
        onClose={closeCategoryModal}
        title={editingCategory ? `Edit Category #${editingCategory.id}` : 'Add Category'}
        size="sm"
      >
        <form className="page" onSubmit={submitCategory}>
          <div className="form-grid">
            <FormField label="Category Name">
              <input
                value={editingCategory ? editingCategory.name : categoryForm.name}
                onChange={(event) => {
                  const value = event.target.value;
                  if (editingCategory) {
                    setEditingCategory((prev) => (prev ? { ...prev, name: value } : prev));
                  } else {
                    setCategoryForm((prev) => ({ ...prev, name: value }));
                  }
                }}
                placeholder="e.g. Tax, Travel, Legal"
              />
            </FormField>

            <FormField label="Type">
              <select
                value={editingCategory ? editingCategory.type : categoryForm.type}
                onChange={(event) => {
                  const value = event.target.value as Category['type'];
                  if (editingCategory) {
                    setEditingCategory((prev) => (prev ? { ...prev, type: value } : prev));
                  } else {
                    setCategoryForm((prev) => ({ ...prev, type: value }));
                  }
                }}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="BOTH">Both</option>
              </select>
            </FormField>
          </div>

          <FormActions>
            <button className="primary-button" type="submit" disabled={categoriesBusy}>
              {categoriesBusy ? 'Saving...' : editingCategory ? 'Save Category' : 'Create Category'}
            </button>
            <button className="ghost-button" type="button" onClick={closeCategoryModal} disabled={categoriesBusy}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>

      <section className="card">
        <div className="section-head">
          <div>
            <h3>Departments</h3>
            <p className="section-subtitle">Assign employees to departments to track payroll spend by team.</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingDepartment(null);
              setDepartmentForm({ name: '', code: '', is_active: true });
              setIsDepartmentModalOpen(true);
            }}
          >
            Add Department
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id}>
                  <td>{department.name}</td>
                  <td>{department.code || '-'}</td>
                  <td>{department.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingDepartment({
                            id: department.id,
                            name: department.name,
                            code: department.code || '',
                            is_active: department.is_active,
                          });
                          setIsDepartmentModalOpen(true);
                        }}
                        disabled={departmentsBusy}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => deleteDepartment(department.id)}
                        disabled={departmentsBusy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isDepartmentModalOpen}
        onClose={closeDepartmentModal}
        title={editingDepartment ? `Edit Department #${editingDepartment.id}` : 'Add Department'}
        size="sm"
      >
        <form className="page" onSubmit={submitDepartment}>
          <div className="form-grid">
            <FormField label="Department Name">
              <input
                value={editingDepartment ? editingDepartment.name : departmentForm.name}
                onChange={(event) => {
                  const value = event.target.value;
                  if (editingDepartment) {
                    setEditingDepartment((prev) => (prev ? { ...prev, name: value } : prev));
                  } else {
                    setDepartmentForm((prev) => ({ ...prev, name: value }));
                  }
                }}
                placeholder="e.g. Engineering, Operations"
              />
            </FormField>

            <FormField label="Code (optional)">
              <input
                value={editingDepartment ? editingDepartment.code : departmentForm.code}
                onChange={(event) => {
                  const value = event.target.value;
                  if (editingDepartment) {
                    setEditingDepartment((prev) => (prev ? { ...prev, code: value } : prev));
                  } else {
                    setDepartmentForm((prev) => ({ ...prev, code: value }));
                  }
                }}
                placeholder="e.g. ENG, OPS"
              />
            </FormField>

            {editingDepartment ? (
              <FormField label="Active">
                <select
                  value={String(editingDepartment.is_active)}
                  onChange={(event) =>
                    setEditingDepartment((prev) =>
                      prev ? { ...prev, is_active: event.target.value === 'true' } : prev
                    )
                  }
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </FormField>
            ) : null}
          </div>

          <FormActions>
            <button className="primary-button" type="submit" disabled={departmentsBusy}>
              {departmentsBusy ? 'Saving...' : editingDepartment ? 'Save Department' : 'Create Department'}
            </button>
            <button className="ghost-button" type="button" onClick={closeDepartmentModal} disabled={departmentsBusy}>
              Cancel
            </button>
          </FormActions>
        </form>
      </Modal>
    </section>
  );
}
