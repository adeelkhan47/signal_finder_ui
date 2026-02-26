import { useState, useEffect } from 'react';
import type { Channel, ChannelCreate } from '../types/channel';
import {
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  editChannel,
  type ChannelEditBody,
} from '../services/channelsApi';

interface ChannelsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChannelsDialog({ open, onClose }: ChannelsDialogProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ChannelEditBody>({
    name: '',
    nick_name: '',
    latitude: '',
    longitude: '',
    status: true,
  });
  const [newChannel, setNewChannel] = useState<ChannelCreate>({
    name: '',
    nick_name: '',
    folder: '',
    latitude: '',
    longitude: '',
    status: true,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChannels();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channels');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleToggleStatus = async (ch: Channel) => {
    try {
      const updated = await updateChannel(ch.id, { status: !ch.status });
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, ...updated } : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleCreate = async () => {
    if (!newChannel.name.trim() || !newChannel.nick_name.trim()) return;
    setError(null);
    try {
      const created = await createChannel(newChannel);
      setChannels((prev) => [...prev, created].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      setNewChannel({
        name: '',
        nick_name: '',
        folder: '',
        latitude: '',
        longitude: '',
        status: true,
      });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const startEdit = (ch: Channel) => {
    setEditingId(ch.id);
    setEditForm({
      id: ch.id,
      name: ch.name ?? '',
      nick_name: ch.nick_name ?? '',
      latitude: ch.latitude ?? '',
      longitude: ch.longitude ?? '',
      status: ch.status ?? true,
    });
  };

  const handleEdit = async () => {
    if (editingId == null) return;
    if (!editForm.name.trim() || !editForm.nick_name.trim()) return;
    setError(null);
    try {
      const updated = await editChannel({ ...editForm, id: editingId });
      setChannels((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, ...updated } : c))
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Edit failed');
    }
  };

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="channels-dialog-title">
      <div className="dialog channels-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 id="channels-dialog-title" className="dialog-title">Channels</h2>
        </div>
        {error && (
          <div className="dialog-error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-body">
          {loading ? (
            <div className="loading">Loading channels…</div>
          ) : (
            <>
              <div className="channels-table-wrap">
                <table className="channels-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Name</th>
                      <th>Nick name</th>
                      <th>Active</th>
                      <th>Data folder</th>
                      <th>latitude</th>
                      <th>longitude</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch) => (
                      <tr key={ch.id}>
                        {editingId === ch.id ? (
                          <>
                            <td>{ch.order ?? ch.id}</td>
                            <td>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                className="channel-inline-input"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editForm.nick_name}
                                onChange={(e) => setEditForm((p) => ({ ...p, nick_name: e.target.value }))}
                                className="channel-inline-input"
                              />
                            </td>
                            <td>
                              <label className="channel-inline-check">
                                <input
                                  type="checkbox"
                                  checked={editForm.status}
                                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.checked }))}
                                />
                                On
                              </label>
                            </td>
                            <td>{ch.folder || '—'}</td>
                            <td>
                              <input
                                type="text"
                                value={editForm.latitude}
                                onChange={(e) => setEditForm((p) => ({ ...p, latitude: e.target.value }))}
                                className="channel-inline-input"
                                placeholder="lat"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editForm.longitude}
                                onChange={(e) => setEditForm((p) => ({ ...p, longitude: e.target.value }))}
                                className="channel-inline-input"
                                placeholder="lon"
                              />
                            </td>
                            <td>
                              <button type="button" className="channel-btn-primary" onClick={handleEdit}>
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{ch.order ?? ch.id}</td>
                            <td>{ch.name || '—'}</td>
                            <td>{ch.nick_name || '—'}</td>
                            <td>
                              <button
                                type="button"
                                className={`channel-toggle ${ch.status ? 'active' : ''}`}
                                onClick={() => handleToggleStatus(ch)}
                                title={ch.status ? 'Disable' : 'Enable'}
                                aria-pressed={ch.status}
                              >
                                {ch.status ? 'On' : 'Off'}
                              </button>
                            </td>
                            <td>{ch.folder || '—'}</td>
                            <td>{ch.latitude || '—'}</td>
                            <td>{ch.longitude || '—'}</td>
                            <td>
                              <button
                                type="button"
                                className="channel-edit"
                                onClick={() => startEdit(ch)}
                                title="Edit channel"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="channel-delete"
                                onClick={() => handleDelete(ch.id)}
                                title="Delete channel"
                              >
                                Delete
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {adding ? (
                <div className="channel-form">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newChannel.name}
                    onChange={(e) => setNewChannel((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Nick name"
                    value={newChannel.nick_name}
                    onChange={(e) => setNewChannel((p) => ({ ...p, nick_name: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Folder"
                    value={newChannel.folder}
                    onChange={(e) => setNewChannel((p) => ({ ...p, folder: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Latitude"
                    value={newChannel.latitude}
                    onChange={(e) => setNewChannel((p) => ({ ...p, latitude: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Longitude"
                    value={newChannel.longitude}
                    onChange={(e) => setNewChannel((p) => ({ ...p, longitude: e.target.value }))}
                  />
                  <label className="channel-form-status">
                    <input
                      type="checkbox"
                      checked={newChannel.status}
                      onChange={(e) => setNewChannel((p) => ({ ...p, status: e.target.checked }))}
                    />
                    Active
                  </label>
                  <button type="button" className="channel-btn-primary" onClick={handleCreate}>
                    Save
                  </button>
                  <button type="button" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="channel-add"
                  onClick={() => setAdding(true)}
                >
                  Add channel
                </button>
              )}
            </>
          )}
        </div>
        <div className="dialog-footer">
          <button type="button" className="dialog-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
