'use client';

import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/api';
import { Category, Department } from '@/lib/types';

type SettingsPayload = {
  base_currency: string;
  timezone: string;
  web_entry_default_status: 'APPROVED' | 'PENDING';
  allow_self_approval: boolean;
};

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
  const [departmentForm, setDepartmentForm] = useState<{ name: string; code: string }>({
    name: '',
    code: '',
  });
  const [editingDepartment, setEditingDepartment] = useState<{
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  } | null>(null);
  const [departmentsBusy, setDepartmentsBusy] = useState(false);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    try {
      await apiRequest('/finance/settings', {
        token,
        method: 'PATCH',
        body: form,
      });
      await refreshMe();
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

    const name = categoryForm.name.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }

    try {
      setCategoriesBusy(true);
      await apiRequest('/finance/categories', {
        token,
        method: 'POST',
        body: {
          name,
          type: categoryForm.type,
        },
      });
      setCategoryForm({ name: '', type: categoryForm.type });
      await reloadCategories();
      setSaved('Category created.');
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create category');
      setSaved(null);
    } finally {
      setCategoriesBusy(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    if (!token) return;

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

  const saveCategoryEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editingCategory) return;

    const name = editingCategory.name.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }

    try {
      setCategoriesBusy(true);
      await apiRequest(`/finance/categories/${editingCategory.id}`, {
        token,
        method: 'PATCH',
        body: {
          name,
          type: editingCategory.type,
        },
      });
      await reloadCategories();
      setEditingCategory(null);
      setSaved('Category updated.');
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update category');
      setSaved(null);
    } finally {
      setCategoriesBusy(false);
    }
  };

  const submitDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    const name = departmentForm.name.trim();
    if (!name) {
      setError('Department name is required.');
      return;
    }

    try {
      setDepartmentsBusy(true);
      await apiRequest('/finance/departments', {
        token,
        method: 'POST',
        body: {
          name,
          code: departmentForm.code.trim() || null,
        },
      });
      setDepartmentForm({ name: '', code: '' });
      await reloadDepartments();
      setSaved('Department created.');
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create department');
      setSaved(null);
    } finally {
      setDepartmentsBusy(false);
    }
  };

  const saveDepartmentEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editingDepartment) return;

    const name = editingDepartment.name.trim();
    if (!name) {
      setError('Department name is required.');
      return;
    }

    try {
      setDepartmentsBusy(true);
      await apiRequest(`/finance/departments/${editingDepartment.id}`, {
        token,
        method: 'PATCH',
        body: {
          name,
          code: editingDepartment.code.trim() || null,
          is_active: editingDepartment.is_active,
        },
      });
      setEditingDepartment(null);
      await reloadDepartments();
      setSaved('Department updated.');
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update department');
      setSaved(null);
    } finally {
      setDepartmentsBusy(false);
    }
  };

  const deleteDepartment = async (departmentId: number) => {
    if (!token) return;

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
      <header className="page-head">
        <div>
          <p className="badge">WORKSPACE CONFIG</p>
          <h2>Settings</h2>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {saved ? <p>{saved}</p> : null}

      <form className="card" onSubmit={submit}>
        <h3>Global Defaults</h3>
        <div className="form-grid">
          <label>
            Base Currency
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
          </label>
          <label>
            Timezone
            <input
              value={form.timezone}
              onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
            />
          </label>
          <label>
            Web Entry Default Status
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
          </label>
          <label>
            Allow Self Approval
            <select
              value={String(form.allow_self_approval)}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, allow_self_approval: event.target.value === 'true' }))
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
        <button className="primary-button" type="submit">
          Save Settings
        </button>
      </form>

      <div className="card">
        <h3>Slack Connection</h3>
        <p>Configured through environment variables on API deployment.</p>
        <ul>
          <li>`SLACK_SIGNING_SECRET`</li>
          <li>`SLACK_BOT_TOKEN`</li>
          <li>`SLACK_FINANCE_CHANNEL_ID`</li>
        </ul>
      </div>

      <section className="card">
        <h3>Categories</h3>
        <p>Create and manage custom categories used in transactions and subscriptions.</p>

        <form className="form-grid" onSubmit={submitCategory}>
          <label>
            Category Name
            <input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Tax, Travel, Legal"
            />
          </label>
          <label>
            Type
            <select
              value={categoryForm.type}
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  type: event.target.value as Category['type'],
                }))
              }
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="BOTH">Both</option>
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="primary-button" type="submit" disabled={categoriesBusy}>
              {categoriesBusy ? 'Saving...' : 'Add Category'}
            </button>
          </div>
        </form>

        {editingCategory ? (
          <form className="form-grid" style={{ marginTop: '0.75rem' }} onSubmit={saveCategoryEdit}>
            <label>
              Edit Category Name
              <input
                value={editingCategory.name}
                onChange={(event) =>
                  setEditingCategory((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Edit Type
              <select
                value={editingCategory.type}
                onChange={(event) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, type: event.target.value as Category['type'] } : prev
                  )
                }
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="BOTH">Both</option>
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
              <button className="primary-button" type="submit" disabled={categoriesBusy}>
                {categoriesBusy ? 'Saving...' : 'Save Edit'}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={categoriesBusy}
                onClick={() => setEditingCategory(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
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
                      <span>Locked</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() =>
                            setEditingCategory({
                              id: category.id,
                              name: category.name,
                              type: category.type,
                            })
                          }
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

      <section className="card">
        <h3>Departments</h3>
        <p>Assign employees to departments to track payroll spend by team.</p>

        <form className="form-grid" onSubmit={submitDepartment}>
          <label>
            Department Name
            <input
              value={departmentForm.name}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Engineering, Operations"
            />
          </label>
          <label>
            Code (optional)
            <input
              value={departmentForm.code}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="e.g. ENG, OPS"
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="primary-button" type="submit" disabled={departmentsBusy}>
              {departmentsBusy ? 'Saving...' : 'Add Department'}
            </button>
          </div>
        </form>

        {editingDepartment ? (
          <form className="form-grid" style={{ marginTop: '0.75rem' }} onSubmit={saveDepartmentEdit}>
            <label>
              Edit Department Name
              <input
                value={editingDepartment.name}
                onChange={(event) =>
                  setEditingDepartment((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Edit Code
              <input
                value={editingDepartment.code}
                onChange={(event) =>
                  setEditingDepartment((prev) => (prev ? { ...prev, code: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Active
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
            </label>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
              <button className="primary-button" type="submit" disabled={departmentsBusy}>
                {departmentsBusy ? 'Saving...' : 'Save Edit'}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={departmentsBusy}
                onClick={() => setEditingDepartment(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          setEditingDepartment({
                            id: department.id,
                            name: department.name,
                            code: department.code || '',
                            is_active: department.is_active,
                          })
                        }
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
    </section>
  );
}
