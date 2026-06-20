import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthPanel } from './AuthPanel';
import type { Fact } from '../data/sampleFacts';

export interface FactDraft {
  lat: number;
  lng: number;
  country_code: string;
  country_name: string;
}

interface AddFactPanelProps {
  draft: FactDraft | null;
  editing: Fact | null;
  user: User | null;
  onClose: () => void;
  onSaved: (fact: Fact) => void;
  onDeleted: (id: string) => void;
}

function formatYearHint(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

export function AddFactPanel({
  draft,
  editing,
  user,
  onClose,
  onSaved,
  onDeleted,
}: AddFactPanelProps) {
  const lat = editing ? editing.lat : draft?.lat ?? 0;
  const lng = editing ? editing.lng : draft?.lng ?? 0;
  const countryCode = editing ? editing.country_code : draft?.country_code ?? '';
  const countryName = editing ? editing.country_name : draft?.country_name ?? '';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [year, setYear] = useState(editing?.year != null ? String(editing.year) : '');
  const [referenceUrl, setReferenceUrl] = useState(editing?.reference_url ?? '');
  const [referenceLabel, setReferenceLabel] = useState(editing?.reference_label ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(editing?.image_url ?? null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setFormError(null);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fact-images')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setFormError(`Image upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('fact-images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      setFormError('Title and body are required.');
      return;
    }

    const parsedYear = year.trim() === '' ? null : Number.parseInt(year, 10);
    if (parsedYear !== null && Number.isNaN(parsedYear)) {
      setFormError('Year must be a whole number (use a minus sign for BCE).');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      title: title.trim(),
      body: body.trim(),
      year: parsedYear,
      image_url: imageUrl,
      reference_url: referenceUrl.trim() || null,
      reference_label: referenceLabel.trim() || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from('facts')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single();

      setSaving(false);
      if (error) {
        setFormError(`Could not save fact: ${error.message}`);
        return;
      }
      onSaved(data as Fact);
    } else {
      const { data, error } = await supabase
        .from('facts')
        .insert({
          ...payload,
          country_code: countryCode,
          country_name: countryName,
          lat,
          lng,
          created_by: user.id,
        })
        .select()
        .single();

      setSaving(false);
      if (error) {
        setFormError(`Could not save fact: ${error.message}`);
        return;
      }
      onSaved(data as Fact);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    setFormError(null);
    const { error } = await supabase.from('facts').delete().eq('id', editing.id);
    setDeleting(false);
    if (error) {
      setFormError(`Could not delete fact: ${error.message}`);
      return;
    }
    onDeleted(editing.id);
  }

  const inputClass =
    'w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <aside className="fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900/95 backdrop-blur border-l border-slate-700 z-30 flex flex-col">
      <div className="p-5 border-b border-slate-700 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {editing ? 'Edit fact' : 'Add fact'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {countryName || 'Unknown'}
            <span className="text-slate-600"> · </span>
            {lat.toFixed(2)}, {lng.toFixed(2)}
          </p>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {!user ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Sign in to add a fact to the globe.</p>
            <AuthPanel user={user} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Great Pyramid of Giza completed"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Body</label>
              <textarea
                className={`${inputClass} resize-y min-h-[96px]`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened, and why it matters."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Year <span className="text-slate-600">(optional · negative for BCE)</span>
              </label>
              <input
                className={inputClass}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="-2560"
                inputMode="numeric"
              />
              {year.trim() !== '' && !Number.isNaN(Number.parseInt(year, 10)) && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatYearHint(Number.parseInt(year, 10))}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Image</label>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Fact preview"
                  className="w-full rounded-lg mb-2 object-cover max-h-40"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
              />
              {uploading && <p className="text-xs text-slate-400 mt-1">Uploading…</p>}
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="text-xs text-slate-500 hover:text-slate-300 mt-1"
                >
                  Remove image
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Reference URL <span className="text-slate-600">(optional)</span>
              </label>
              <input
                className={inputClass}
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/…"
                type="url"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Reference label <span className="text-slate-600">(optional)</span>
              </label>
              <input
                className={inputClass}
                value={referenceLabel}
                onChange={(e) => setReferenceLabel(e.target.value)}
                placeholder="Wikipedia"
              />
            </div>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors"
              >
                {saving ? 'Saving…' : 'Save fact'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-200 text-sm font-medium px-3 py-2 rounded transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
