import React, { useEffect, useState } from "react";
import { ExternalLink, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../services/api";

const emptyForm = { id: "", title: "", description: "", image: "", url: "", username: "", password: "", status: "Active", displayOrder: 0 };

const readImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith("image/")) return reject(new Error("Please select an image file."));
  if (file.size > 5 * 1024 * 1024) return reject(new Error("Image must be smaller than 5 MB."));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Unable to read the image."));
  reader.readAsDataURL(file);
});

export const EResourceManager = () => {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadResources = async () => {
    setLoading(true);
    try {
      setResources(await api.eResources.list());
    } catch (requestError) {
      setError(requestError.message || "Unable to load E-Resources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadResources(); }, []);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      updateForm("image", await readImage(file));
      setError("");
    } catch (imageError) {
      setError(imageError.message);
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.image) return setError("Please upload an image or logo.");
    try {
      new URL(form.url);
      if (!["http:", "https:"].includes(new URL(form.url).protocol)) throw new Error();
    } catch (_) {
      setError("Website URL must be a valid HTTP or HTTPS URL.");
      return;
    }
    setSaving(true);
    try {
      const saved = form.id ? await api.eResources.update(form) : await api.eResources.create(form);
      setResources((current) => form.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder));
      setForm(emptyForm);
      setIsFormOpen(false);
    } catch (saveError) {
      setError(saveError.message || "Unable to save E-Resource.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource) => {
    const result = await Swal.fire({ title: "Delete E-Resource?", text: `Delete ${resource.title}?`, icon: "warning", showCancelButton: true, confirmButtonText: "Delete", cancelButtonText: "Cancel", confirmButtonColor: "#e11d48", cancelButtonColor: "#64748b", reverseButtons: true });
    if (!result.isConfirmed) return;
    try {
      await api.eResources.remove(resource.id);
      setResources((current) => current.filter((item) => item.id !== resource.id));
      if (form.id === resource.id) {
        setForm(emptyForm);
        setIsFormOpen(false);
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete E-Resource.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">E-Resources Management</h2>
          <p className="mt-1 text-xs text-slate-500">Manage the electronic libraries shown to clients. Only Active resources appear in the client portal.</p>
        </div>
        <button type="button" onClick={() => { setForm(emptyForm); setError(""); setIsFormOpen(true); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-blue-800 sm:w-auto">
          <Plus size={14} /> Add E-Resource
        </button>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

      {isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) { setIsFormOpen(false); setForm(emptyForm); } }}>
      <form onSubmit={handleSubmit} className="my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-blue-800">{form.id ? "Edit E-Resource" : "Add E-Resource"}</h3>
          <button type="button" onClick={() => { setForm(emptyForm); setIsFormOpen(false); }} className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-slate-800"><X size={13} /> Close</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Title / Name<input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Resource title" /></label>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Website URL<input required type="url" value={form.url} onChange={(event) => updateForm("url", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://example.com" /></label>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Username<input required={!form.id} value={form.username || ""} onChange={(event) => updateForm("username", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Resource username" /></label>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Password<input required={!form.id} type="text" value={form.password || ""} onChange={(event) => updateForm("password", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Resource password" /></label>
          <label className="lg:col-span-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Description<textarea required value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold normal-case text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Explain what clients can access." /></label>
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-blue-200 bg-white p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Image / Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2">{form.image ? <img src={form.image} alt="Preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus size={22} className="text-slate-300" />}</div>
              <label className="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-slate-700"><ImagePlus size={13} className="mr-1 inline" /> {form.image ? "Replace" : "Upload"}<input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800"><option>Active</option><option>Inactive</option></select></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Display Order<input type="number" min="0" value={form.displayOrder} onChange={(event) => updateForm("displayOrder", Number(event.target.value) || 0)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800" /></label>
          </div>
        </div>
        <button disabled={saving} type="submit" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-blue-800 disabled:opacity-50"><Save size={14} /> {saving ? "Saving..." : form.id ? "Update E-Resource" : "Save E-Resource"}</button>
      </form>
      </div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Credentials</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs">{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr> : resources.map((resource) => <tr key={resource.id} className="align-top hover:bg-slate-50">
            <td className="px-4 py-3"><div className="flex min-w-[180px] items-center gap-3"><img src={resource.image} alt="" className="h-10 w-14 rounded bg-slate-100 object-contain p-1" /><span className="font-black uppercase text-slate-800">{resource.title}</span></div></td>
            <td className="max-w-xs px-4 py-3 text-slate-500">{resource.description}</td>
            <td className="px-4 py-3 text-slate-600"><div className="font-semibold">{resource.username || "Not set"}</div><div className="text-[10px] text-slate-400">{resource.password ? "Password saved" : "No password"}</div></td>
            <td className="max-w-[220px] px-4 py-3"><a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate font-semibold text-blue-700 hover:underline"><ExternalLink size={12} /> {resource.url}</a></td>
            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${resource.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{resource.status}</span></td>
            <td className="px-4 py-3"><div className="flex justify-center gap-1"><button type="button" onClick={() => { setForm(resource); setError(""); setIsFormOpen(true); }} title="Edit resource" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button><button type="button" onClick={() => handleDelete(resource)} title="Delete resource" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};
