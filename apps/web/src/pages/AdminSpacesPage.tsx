import { useState, type FormEvent } from 'react';
import { apiPatch, apiPost } from '../api/http';
import type { Space } from '../api/types';
import { ErrorState } from '../components/FeedbackState';
import { useApiResource } from '../hooks/useApiResource';
import { toSpaceAdminErrorMessage, validateSpaceDraft } from '../spaces/messages';

type SpaceDraft = {
  name: string;
  type: string;
  campus: string;
  capacity: string;
  usageRules: string;
};

function emptyDraft(): SpaceDraft {
  return { name: '', type: '', campus: '', capacity: '20', usageRules: '' };
}

function draftFromSpace(space: Space): SpaceDraft {
  return {
    name: space.name,
    type: space.type,
    campus: space.campus,
    capacity: String(space.capacity),
    usageRules: space.usageRules,
  };
}

function payloadFromDraft(draft: SpaceDraft) {
  return {
    name: draft.name.trim(),
    type: draft.type.trim(),
    campus: draft.campus.trim(),
    capacity: Number(draft.capacity),
    usageRules: draft.usageRules.trim(),
  };
}

export function AdminSpacesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [createDraft, setCreateDraft] = useState<SpaceDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SpaceDraft>(emptyDraft);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const spaces = useApiResource<Space[]>('/spaces', refreshKey);
  const list = spaces.status === 'success' ? spaces.data : [];

  function refreshList() {
    setRefreshKey((value) => value + 1);
  }

  async function createSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSpaceDraft(createDraft);
    if (validation) {
      setError(validation);
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const created = await apiPost<Space>('/spaces', payloadFromDraft(createDraft));
      setCreateDraft(emptyDraft());
      refreshList();
      setSuccess(`${created.name} quedó activo en el catálogo.`);
    } catch (cause) {
      setError(toSpaceAdminErrorMessage(cause));
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(space: Space) {
    const validation = validateSpaceDraft(editDraft);
    if (validation) {
      setError(validation);
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setBusyId(space.id);
    try {
      const updated = await apiPatch<Space>(`/spaces/${space.id}`, payloadFromDraft(editDraft));
      setEditingId(null);
      refreshList();
      setSuccess(`Se actualizó ${updated.name}.`);
    } catch (cause) {
      setError(toSpaceAdminErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(space: Space, isActive: boolean) {
    setError('');
    setSuccess('');
    setBusyId(space.id);
    try {
      await apiPatch<Space>(`/spaces/${space.id}`, { isActive });
      if (editingId === space.id) {
        setEditingId(null);
      }
      refreshList();
      setSuccess(
        isActive
          ? `${space.name} volvió a estar activo.`
          : `${space.name} quedó inactivo. Los estudiantes ya no lo ven y no admite reservas nuevas.`,
      );
    } catch (cause) {
      setError(toSpaceAdminErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  if (spaces.status === 'loading') {
    return (
      <p className="muted" role="status">
        Cargando espacios…
      </p>
    );
  }

  if (spaces.status === 'error') {
    const description =
      spaces.httpStatus === 403
        ? 'Solo el personal autorizado puede gestionar espacios.'
        : spaces.message;
    return <ErrorState title="Espacios" description={description} />;
  }

  return (
    <section>
      <h2>Espacios</h2>
      <p className="muted">
        Crea, edita o desactiva escenarios. Un espacio inactivo no aparece en el catálogo estudiantil ni admite
        reservas nuevas.
      </p>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="success-text" role="status">
          {success}
        </p>
      ) : null}

      <form className="space-admin-form" onSubmit={(event) => void createSpace(event)}>
        <h3>Nuevo espacio</h3>
        <SpaceFields
          idPrefix="create"
          draft={createDraft}
          disabled={creating}
          onChange={setCreateDraft}
        />
        <button type="submit" className="primary-button" disabled={creating}>
          {creating ? 'Creando…' : 'Crear espacio'}
        </button>
      </form>

      {list.length === 0 ? (
        <p className="muted">Aún no hay espacios registrados.</p>
      ) : (
        <ul className="reservation-list">
          {list.map((space) => {
            const editing = editingId === space.id;
            const busy = busyId === space.id;
            return (
              <li key={space.id} className="reservation-card">
                {editing ? (
                  <form
                    className="space-admin-form space-admin-form--inline"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveEdit(space);
                    }}
                  >
                    <SpaceFields
                      idPrefix={`edit-${space.id}`}
                      draft={editDraft}
                      disabled={busy}
                      onChange={setEditDraft}
                    />
                    <div className="reservation-card__actions">
                      <button type="submit" className="primary-button" disabled={busy}>
                        {busy ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{space.name}</strong>
                      <p className="muted">
                        {space.type} · {space.campus} · {space.capacity} personas
                      </p>
                      <p>{space.usageRules}</p>
                    </div>
                    <div className="reservation-card__actions">
                      <span className={space.isActive ? 'status-badge status-badge--approved' : 'status-badge'}>
                        {space.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(space.id);
                          setEditDraft(draftFromSpace(space));
                          setError('');
                          setSuccess('');
                        }}
                      >
                        Editar
                      </button>
                      {space.isActive ? (
                        <button
                          type="button"
                          className="danger-button"
                          disabled={busy}
                          onClick={() => void setActive(space, false)}
                        >
                          {busy ? 'Guardando…' : 'Desactivar'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={busy}
                          onClick={() => void setActive(space, true)}
                        >
                          {busy ? 'Guardando…' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SpaceFields({
  idPrefix,
  draft,
  disabled,
  onChange,
}: {
  idPrefix: string;
  draft: SpaceDraft;
  disabled: boolean;
  onChange: (draft: SpaceDraft) => void;
}) {
  function update(field: keyof SpaceDraft, value: string) {
    onChange({ ...draft, [field]: value });
  }

  return (
    <div className="space-admin-fields">
      <label>
        Nombre
        <input
          id={`${idPrefix}-name`}
          name={`${idPrefix}-name`}
          value={draft.name}
          disabled={disabled}
          onChange={(event) => update('name', event.target.value)}
          required
          minLength={2}
        />
      </label>
      <label>
        Tipo
        <input
          id={`${idPrefix}-type`}
          name={`${idPrefix}-type`}
          value={draft.type}
          disabled={disabled}
          onChange={(event) => update('type', event.target.value)}
          placeholder="pista, cancha, coliseo"
          required
          minLength={2}
        />
      </label>
      <label>
        Campus
        <input
          id={`${idPrefix}-campus`}
          name={`${idPrefix}-campus`}
          value={draft.campus}
          disabled={disabled}
          onChange={(event) => update('campus', event.target.value)}
          required
          minLength={2}
        />
      </label>
      <label>
        Capacidad
        <input
          id={`${idPrefix}-capacity`}
          name={`${idPrefix}-capacity`}
          type="number"
          min={1}
          step={1}
          value={draft.capacity}
          disabled={disabled}
          onChange={(event) => update('capacity', event.target.value)}
          required
        />
      </label>
      <label className="space-admin-fields__rules">
        Reglas de uso
        <textarea
          id={`${idPrefix}-usageRules`}
          name={`${idPrefix}-usageRules`}
          value={draft.usageRules}
          disabled={disabled}
          onChange={(event) => update('usageRules', event.target.value)}
          required
          rows={3}
        />
      </label>
    </div>
  );
}
